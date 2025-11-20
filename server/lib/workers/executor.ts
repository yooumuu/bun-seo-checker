import { eq } from "drizzle-orm";
import { db } from "../db";
import { scanJobs } from "../db/schema";
import { aggregateSummaries } from "../analyzers/html";
import { scanSinglePage, type SingleScanResult } from "../analyzers/single";
import { scanSite } from "../analyzers/site";
import { recordTaskEvent } from "./events";
import { env } from "../config";
import type { ScanScheduler } from "./scheduler";

export class JobCancelledError extends Error {
    constructor(jobId: number) {
        super(`Job ${jobId} was cancelled`);
        this.name = "JobCancelledError";
    }
}

export async function runScanJob(jobId: number, scheduler: ScanScheduler) {
    const job = await db
        .select()
        .from(scanJobs)
        .where(eq(scanJobs.id, jobId))
        .then((rows) => rows[0]);

    if (!job) {
        return;
    }

    const startTime = new Date();

    await db
        .update(scanJobs)
        .set({
            status: "running",
            startedAt: startTime,
            error: null,
        })
        .where(eq(scanJobs.id, jobId));

    await recordTaskEvent(jobId, "started", {
        targetUrl: job.targetUrl,
        mode: job.mode,
    });

    try {
        let pagesTotal = 0;
        let pagesFinished = 0;
        let summaryPayload: ReturnType<typeof aggregateSummaries>;
        let processedPages = 0;

        const emitPageEvent = async (page: SingleScanResult) => {
            // Check for cancellation before processing each page
            if (scheduler.isCancelRequested(jobId)) {
                throw new JobCancelledError(jobId);
            }

            processedPages += 1;

            // Update progress in database for real-time tracking
            await db
                .update(scanJobs)
                .set({
                    pagesFinished: processedPages,
                })
                .where(eq(scanJobs.id, jobId));

            await recordTaskEvent(jobId, "page_completed", {
                pageId: page.pageId,
                url: page.url,
                httpStatus: page.httpStatus,
                loadTimeMs: page.loadTimeMs,
                pagesFinished: processedPages,
            });
        };

        if (job.mode === "site") {
            // Set initial pagesTotal estimate for site scans
            const maxPages = job.options?.maxPages ?? env.SCANNER_MAX_PAGES;
            await db
                .update(scanJobs)
                .set({
                    pagesTotal: maxPages,
                })
                .where(eq(scanJobs.id, jobId));

            const result = await scanSite(job, emitPageEvent);
            pagesTotal = result.pagesTotal;
            pagesFinished = result.pagesFinished;
            summaryPayload = result.issueSummary;
        } else {
            // For single page scans, use totalSteps as pagesTotal for progress tracking
            const totalSteps = 6;
            await db
                .update(scanJobs)
                .set({
                    pagesTotal: totalSteps,
                    pagesFinished: 0,
                })
                .where(eq(scanJobs.id, jobId));

            const onSinglePageProgress = async (step: number, total: number, message: string) => {
                // Check for cancellation
                if (scheduler.isCancelRequested(jobId)) {
                    throw new JobCancelledError(jobId);
                }

                // Update progress in database
                await db
                    .update(scanJobs)
                    .set({
                        pagesFinished: step,
                    })
                    .where(eq(scanJobs.id, jobId));

                // Emit progress event
                await recordTaskEvent(jobId, "page_completed", {
                    pagesFinished: step,
                    message,
                });
            };

            const result = await scanSinglePage(job, job.targetUrl, onSinglePageProgress);
            pagesTotal = 1;
            pagesFinished = 1;
            summaryPayload = aggregateSummaries([result.issueSummary]);
        }

        await db
            .update(scanJobs)
            .set({
                status: "completed",
                completedAt: new Date(),
                pagesTotal,
                pagesFinished,
                issuesSummary: summaryPayload,
            })
            .where(eq(scanJobs.id, jobId));

        await recordTaskEvent(jobId, "completed", {
            pagesFinished,
            pagesTotal,
            status: "completed",
        });
    } catch (error) {
        const isCancelled = error instanceof JobCancelledError;
        const status = isCancelled ? "failed" : "failed";
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await db
            .update(scanJobs)
            .set({
                status,
                error: isCancelled ? "Job was cancelled by user" : errorMessage,
                completedAt: new Date(),
            })
            .where(eq(scanJobs.id, jobId));

        await recordTaskEvent(jobId, isCancelled ? "cancelled" : "failed", {
            error: isCancelled ? "Job was cancelled by user" : errorMessage,
        });

        if (!isCancelled) {
            throw error;
        }
    }
}
