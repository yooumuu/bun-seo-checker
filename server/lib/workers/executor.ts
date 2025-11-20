import { eq } from "drizzle-orm";
import { db } from "../db";
import { scanJobs } from "../db/schema";
import { aggregateSummaries } from "../analyzers/html";
import { scanSinglePage, type SingleScanResult } from "../analyzers/single";
import { scanSite } from "../analyzers/site";
import { recordTaskEvent } from "./events";
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
            await recordTaskEvent(jobId, "page_completed", {
                pageId: page.pageId,
                url: page.url,
                httpStatus: page.httpStatus,
                loadTimeMs: page.loadTimeMs,
                pagesFinished: processedPages,
            });
        };

        if (job.mode === "site") {
            const result = await scanSite(job, emitPageEvent);
            pagesTotal = result.pagesTotal;
            pagesFinished = result.pagesFinished;
            summaryPayload = result.issueSummary;
        } else {
            const result = await scanSinglePage(job);
            await emitPageEvent(result);
            pagesTotal = result.pagesTotal;
            pagesFinished = result.pagesFinished;
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
