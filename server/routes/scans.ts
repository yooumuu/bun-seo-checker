import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db";
import { scanJobs } from "../lib/db/schema";
import { scanScheduler } from "../lib/workers";
import { getRecentTaskEvents, subscribeToTaskEvents } from "../lib/workers/events";
import { streamSSE } from "hono/streaming";

const createScanJobSchema = z.object({
    targetUrl: z.string().url(),
    mode: z.enum(["single", "site"]),
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

const sortColumns = {
    createdAt: scanJobs.createdAt,
    startedAt: scanJobs.startedAt,
    completedAt: scanJobs.completedAt,
    pagesTotal: scanJobs.pagesTotal,
    pagesFinished: scanJobs.pagesFinished,
} as const;

const app = new Hono()
    .post(
        "/",
        zValidator("json", createScanJobSchema),
        async (c) => {
            const data = c.req.valid("json");
            const [job] = await db
                .insert(scanJobs)
                .values({
                    targetUrl: data.targetUrl,
                    mode: data.mode,
                    status: "pending",
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
                        .catch(() => {});
                });

                stream.onAbort(() => {
                    unsubscribe();
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
    );

export default app;
