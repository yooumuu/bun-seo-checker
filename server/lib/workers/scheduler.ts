import { inArray } from "drizzle-orm";
import { db } from "../db";
import { scanJobs } from "../db/schema";
import { runScanJob } from "./executor";
import { env } from "../config";
import { recordTaskEvent } from "./events";

type JobId = number;

export class ScanScheduler {
    private readonly concurrency = env.SCAN_WORKERS_MAX_CONCURRENCY;
    private readonly queue: JobId[] = [];
    private readonly enqueued = new Set<JobId>();
    private readonly running = new Set<JobId>();
    private readonly cancelRequested = new Set<JobId>();
    private started = false;

    start() {
        if (this.started) return;
        this.started = true;
        this.resumePendingJobs().catch((error) => {
            console.error("[scheduler] Failed to resume jobs", error);
        });
    }

    enqueue(jobId: JobId) {
        if (this.enqueued.has(jobId) || this.running.has(jobId)) {
            return;
        }
        this.queue.push(jobId);
        this.enqueued.add(jobId);
        recordTaskEvent(jobId, "queued", { status: "pending" }).catch(() => {});
        this.drain();
    }

    getState() {
        return {
            queue: [...this.queue],
            running: [...this.running],
            cancelRequested: [...this.cancelRequested],
        };
    }

    cancel(jobId: JobId): boolean {
        // If it's in the queue (not yet running), remove it
        const queueIndex = this.queue.indexOf(jobId);
        if (queueIndex !== -1) {
            this.queue.splice(queueIndex, 1);
            this.enqueued.delete(jobId);
            return true;
        }

        // If it's currently running, request cancellation
        if (this.running.has(jobId)) {
            this.cancelRequested.add(jobId);
            return true;
        }

        return false;
    }

    isCancelRequested(jobId: JobId): boolean {
        return this.cancelRequested.has(jobId);
    }

    private async resumePendingJobs() {
        try {
            const pendingJobs = await db
                .select({ id: scanJobs.id })
                .from(scanJobs)
                .where(inArray(scanJobs.status, ["pending", "running"]))
                .orderBy(scanJobs.createdAt);

            pendingJobs.forEach(({ id }) => this.enqueue(id));
        } catch (error) {
            console.error("[scheduler] Error loading pending jobs", error);
        }
    }

    private drain() {
        if (!this.started) return;

        while (this.running.size < this.concurrency && this.queue.length > 0) {
            const jobId = this.queue.shift()!;
            this.enqueued.delete(jobId);
            this.run(jobId);
        }
    }

    private run(jobId: JobId) {
        this.running.add(jobId);

        runScanJob(jobId, this)
            .catch((error) => {
                console.error(`[scheduler] Job ${jobId} failed`, error);
            })
            .finally(() => {
                this.running.delete(jobId);
                this.cancelRequested.delete(jobId);
                this.drain();
            });
    }
}
