import { eq } from "drizzle-orm";
import { db } from "../db";
import { scanJobs } from "../db/schema";
import { aggregateSummaries } from "../analyzers/html";
import { scanSinglePage, type SingleScanResult } from "../analyzers/single";
import { scanSite } from "../analyzers/site";
import { recordTaskEvent } from "./events";

export async function runScanJob(jobId: number) {
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
                issuesSummary: {
                    pagesAnalysed: pagesFinished,
                    ...summaryPayload,
                },
            })
            .where(eq(scanJobs.id, jobId));

        await recordTaskEvent(jobId, "completed", {
            pagesFinished,
            pagesTotal,
            status: "completed",
        });
    } catch (error) {
        await db
            .update(scanJobs)
            .set({
                status: "failed",
                error: error instanceof Error ? error.message : "Unknown error",
                completedAt: new Date(),
            })
            .where(eq(scanJobs.id, jobId));

        await recordTaskEvent(jobId, "failed", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
    }
}
