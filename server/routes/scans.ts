import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, count, desc, eq, ilike, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db";
import {
    linkMetrics,
    scanJobs,
    scanPages,
    seoMetrics,
    taskEvents,
    trackingEvents,
} from "../lib/db/schema";
import { scanScheduler } from "../lib/workers";
import { getRecentTaskEvents, subscribeToTaskEvents } from "../lib/workers/events";
import { streamSSE } from "hono/streaming";
import {
    getPageForJob,
    listPagesForJob,
} from "../lib/services/scanPages";

const jobOptionsSchema = z
    .object({
        siteDepth: z.coerce.number().int().min(1).max(10).optional(),
        maxPages: z.coerce.number().int().min(1).max(1000).optional(),
        userAgent: z.string().min(1).max(256).optional(),
        requestTimeoutMs: z
            .coerce.number()
            .int()
            .min(1000)
            .max(120000)
            .optional(),
    })
    .partial();

const createScanJobSchema = z.object({
    targetUrl: z.string().url(),
    mode: z.enum(["single", "site"]),
    options: jobOptionsSchema.optional(),
});

const listScansSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().min(1).max(256).optional(),
    mode: z.enum(["single", "site"]).optional(),
    status: z.enum(["pending", "running", "completed", "failed"]).optional(),
    sort: z
        .enum(["createdAt", "startedAt", "completedAt", "pagesTotal", "pagesFinished"])
        .default("createdAt"),
    direction: z.enum(["asc", "desc"]).default("desc"),
});

const paramIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

const pageStatusEnum = ["pending", "processing", "completed", "failed"] as const;

const listPagesQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    search: z.string().min(1).max(512).optional(),
    status: z.enum(pageStatusEnum).optional(),
    sort: z
        .enum(["createdAt", "url", "httpStatus", "loadTimeMs", "seoScore"])
        .default("createdAt"),
    direction: z.enum(["asc", "desc"]).default("desc"),
});

const pageParamSchema = z.object({
    id: z.coerce.number().int().positive(),
    pageId: z.coerce.number().int().positive(),
});

const sortColumns = {
    createdAt: scanJobs.createdAt,
    startedAt: scanJobs.startedAt,
    completedAt: scanJobs.completedAt,
    pagesTotal: scanJobs.pagesTotal,
    pagesFinished: scanJobs.pagesFinished,
} as const;

const app = new Hono()
    .get("/queue/state", async (c) => {
        const state = scanScheduler.getState();
        return c.json(state);
    })
    .post(
        "/",
        zValidator("json", createScanJobSchema),
        async (c) => {
            const data = c.req.valid("json");
            const normalizedOptions =
                data.options && Object.keys(data.options).length > 0
                    ? data.options
                    : null;
            const [job] = await db
                .insert(scanJobs)
                .values({
                    targetUrl: data.targetUrl,
                    mode: data.mode,
                    status: "pending",
                    options: normalizedOptions,
                })
                .returning();

            if (!job) {
                c.status(500);
                return c.json({ error: "Failed to create job" });
            }

            scanScheduler.enqueue(job.id);

            return c.json(job, 201);
        }
    )
    .get(
        "/progress/live",
        async (c) => {
            return streamSSE(c, async (stream) => {
                const recent = await getRecentTaskEvents();
                await stream.writeSSE({
                    data: JSON.stringify({ type: "init", events: recent }),
                });

                const unsubscribe = subscribeToTaskEvents((event) => {
                    stream
                        .writeSSE({
                            data: JSON.stringify({ type: "event", event }),
                        })
                        .catch(() => { });
                });

                stream.onAbort(() => {
                    unsubscribe();
                });

                // Keep the connection open
                await new Promise((resolve) => {
                    stream.onAbort(() => resolve(true));
                });
            });
        }
    )
    .get(
        "/",
        zValidator("query", listScansSchema),
        async (c) => {
            const { limit, offset, search, mode, status, sort, direction } =
                c.req.valid("query");

            const filters = [];
            if (search) {
                filters.push(ilike(scanJobs.targetUrl, `%${search}%`));
            }
            if (mode) {
                filters.push(eq(scanJobs.mode, mode));
            }
            if (status) {
                filters.push(eq(scanJobs.status, status));
            }

            const whereClause = filters.length ? and(...filters) : undefined;

            const orderColumn = sortColumns[sort];
            const orderBy = direction === "asc" ? asc(orderColumn) : desc(orderColumn);

            const listQuery = whereClause
                ? db.select().from(scanJobs).where(whereClause)
                : db.select().from(scanJobs);

            const countQuery = whereClause
                ? db.select({ total: count() }).from(scanJobs).where(whereClause)
                : db.select({ total: count() }).from(scanJobs);

            const [jobs, countRows] = await Promise.all([
                listQuery.orderBy(orderBy).limit(limit).offset(offset),
                countQuery,
            ]);
            const total = countRows[0]?.total ?? 0;

            return c.json({
                jobs,
                pagination: {
                    total,
                    limit,
                    offset,
                },
            });
        }
    )
    .get(
        "/:id",
        zValidator("param", paramIdSchema),
        async (c) => {
            const { id } = c.req.valid("param");

            const job = await db
                .select()
                .from(scanJobs)
                .where(eq(scanJobs.id, id))
                .then((rows) => rows[0]);

            if (!job) {
                c.status(404);
                return c.json({ error: "Job not found" });
            }

            return c.json(job);
        }
    )
    .get(
        "/:id/pages",
        zValidator("param", paramIdSchema),
        zValidator("query", listPagesQuerySchema),
        async (c) => {
            const { id } = c.req.valid("param");
            const query = c.req.valid("query");

            const jobExists = await db
                .select({ id: scanJobs.id })
                .from(scanJobs)
                .where(eq(scanJobs.id, id))
                .limit(1)
                .then((rows) => rows[0]);
            if (!jobExists) {
                c.status(404);
                return c.json({ error: "Job not found" });
            }

            const result = await listPagesForJob(id, query);
            return c.json(result);
        }
    )
    .get(
        "/:id/pages/:pageId",
        zValidator("param", pageParamSchema),
        async (c) => {
            const { id, pageId } = c.req.valid("param");

            const jobExists = await db
                .select({ id: scanJobs.id })
                .from(scanJobs)
                .where(eq(scanJobs.id, id))
                .limit(1)
                .then((rows) => rows[0]);
            if (!jobExists) {
                c.status(404);
                return c.json({ error: "Job not found" });
            }

            const page = await getPageForJob(id, pageId);
            if (!page) {
                c.status(404);
                return c.json({ error: "Page not found" });
            }

            return c.json(page);
        }
    )
    .delete(
        "/:id",
        zValidator("param", paramIdSchema),
        async (c) => {
            const { id } = c.req.valid("param");

            const job = await db
                .select()
                .from(scanJobs)
                .where(eq(scanJobs.id, id))
                .limit(1)
                .then((rows) => rows[0]);

            if (!job) {
                c.status(404);
                return c.json({ error: "Job not found" });
            }

            if (job.status === "running" || job.status === "pending") {
                c.status(409);
                return c.json({
                    error: "Job is still running. Stop the scan before deleting.",
                });
            }

            await db.transaction(async (tx) => {
                const pageIds = await tx
                    .select({ id: scanPages.id })
                    .from(scanPages)
                    .where(eq(scanPages.jobId, id));
                const ids = pageIds.map((row) => row.id);

                if (ids.length > 0) {
                    await tx
                        .delete(trackingEvents)
                        .where(inArray(trackingEvents.pageId, ids));
                    await tx
                        .delete(seoMetrics)
                        .where(inArray(seoMetrics.pageId, ids));
                    await tx
                        .delete(linkMetrics)
                        .where(inArray(linkMetrics.pageId, ids));
                }

                await tx.delete(taskEvents).where(eq(taskEvents.jobId, id));
                await tx.delete(scanPages).where(eq(scanPages.jobId, id));
                await tx.delete(scanJobs).where(eq(scanJobs.id, id));
            });

            c.status(204);
            return c.body(null);
        }
    )
    .post(
        "/:id/cancel",
        zValidator("param", paramIdSchema),
        async (c) => {
            const { id } = c.req.valid("param");

            const job = await db
                .select()
                .from(scanJobs)
                .where(eq(scanJobs.id, id))
                .limit(1)
                .then((rows) => rows[0]);

            if (!job) {
                c.status(404);
                return c.json({ error: "Job not found" });
            }

            if (job.status !== "running" && job.status !== "pending") {
                c.status(409);
                return c.json({
                    error: "Job is not running. Only running or pending jobs can be cancelled.",
                });
            }

            const cancelled = scanScheduler.cancel(id);

            if (!cancelled) {
                c.status(500);
                return c.json({ error: "Failed to cancel job" });
            }

            return c.json({ success: true, message: "Job cancellation requested" });
        }
    )
    .post(
        "/:id/retry",
        zValidator("param", paramIdSchema),
        async (c) => {
            const { id } = c.req.valid("param");

            const job = await db
                .select()
                .from(scanJobs)
                .where(eq(scanJobs.id, id))
                .limit(1)
                .then((rows) => rows[0]);

            if (!job) {
                c.status(404);
                return c.json({ error: "Job not found" });
            }

            if (job.status !== "failed") {
                c.status(409);
                return c.json({
                    error: "Job is not failed. Only failed jobs can be retried.",
                });
            }

            // Reset job status to pending and clear error
            await db
                .update(scanJobs)
                .set({
                    status: "pending",
                    error: null,
                    startedAt: null,
                    completedAt: null,
                })
                .where(eq(scanJobs.id, id));

            // Re-enqueue the job
            scanScheduler.enqueue(id);

            return c.json({ success: true, message: "Job retry initiated" });
        }
    );

export default app;
