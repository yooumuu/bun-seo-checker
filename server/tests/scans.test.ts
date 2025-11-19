import { describe, expect, it } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import type { ScanJob } from "../shared/types";
import { db } from "../lib/db";
import {
    linkMetrics,
    scanJobs,
    scanPages,
    seoMetrics,
    trackingEvents,
} from "../lib/db/schema";
import type { IssueSummary } from "../lib/analyzers/html";

const baseIssueSummary: IssueSummary = {
    seo: {
        missingTitle: false,
        missingDescription: false,
        missingH1: false,
        missingCanonical: false,
        robotsBlocked: false,
    },
    links: {
        internalLinks: 2,
        externalLinks: 1,
        utmMissing: 0,
        utmTracked: 1,
    },
    tracking: {
        mixpanelMissing: false,
        gaMissing: true,
    },
    totals: {
        seoIssues: 0,
        linkIssues: 0,
        trackingIssues: 1,
    },
    meta: {
        seoScore: 88,
    },
};

const createJobFixture = async () => {
    const [job] = await db
        .insert(scanJobs)
        .values({
            targetUrl: "https://fixture.test",
            mode: "single",
            status: "completed",
            pagesTotal: 1,
            pagesFinished: 1,
        })
        .returning();

    if (!job) {
        throw new Error("Failed to create job fixture");
    }

    const [page] = await db
        .insert(scanPages)
        .values({
            jobId: job.id,
            url: `${job.targetUrl}/page`,
            status: "completed",
            httpStatus: 200,
            loadTimeMs: 1250,
            issueCounts: baseIssueSummary,
        })
        .returning();

    if (!page) {
        throw new Error("Failed to create page fixture");
    }

    await db.insert(seoMetrics).values({
        pageId: page.id,
        title: "Fixture Page",
        metaDescription: "Fixture description",
        canonical: `${job.targetUrl}/page`,
        h1: "Fixture",
        robotsTxtBlocked: false,
        schemaOrg: null,
        score: 88,
    });

    await db.insert(linkMetrics).values({
        pageId: page.id,
        internalLinks: 4,
        externalLinks: 1,
        utmParams: { trackedLinks: 1, missingUtm: 0, examples: [] },
        brokenLinks: 0,
        redirects: 0,
    });

    await db.insert(trackingEvents).values({
        pageId: page.id,
        element: "script",
        trigger: "load",
        platform: "mixpanel",
        status: "detected",
    });

    return { job, page };
};

const cleanupJobFixture = async (jobId: number) => {
    const pages = await db
        .select({ id: scanPages.id })
        .from(scanPages)
        .where(eq(scanPages.jobId, jobId));
    const pageIds = pages.map((row) => row.id);

    if (pageIds.length > 0) {
        await db
            .delete(trackingEvents)
            .where(inArray(trackingEvents.pageId, pageIds));
        await db
            .delete(seoMetrics)
            .where(inArray(seoMetrics.pageId, pageIds));
        await db
            .delete(linkMetrics)
            .where(inArray(linkMetrics.pageId, pageIds));
        await db.delete(scanPages).where(inArray(scanPages.id, pageIds));
    }

    await db.delete(scanJobs).where(eq(scanJobs.id, jobId));
};

describe("Scans API", () => {
    it("should create a new scan job", async () => {
        const res = await app.request("/api/scans", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                targetUrl: "https://example.com",
                mode: "single",
            }),
        });

        expect(res.status).toBe(201);
        const job = (await res.json()) as ScanJob;
        expect(job).toHaveProperty("id");
        expect(job.targetUrl).toBe("https://example.com");
        expect(job.mode).toBe("single");
        expect(job.status).toBe("pending");
    });

    it("should reject invalid URLs", async () => {
        const res = await app.request("/api/scans", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                targetUrl: "not-a-url",
                mode: "single",
            }),
        });

        expect(res.status).toBe(400);
        const body = (await res.json()) as { jobs: ScanJob[]; pagination: { total: number; limit: number; offset: number } };
        expect(body).toHaveProperty("message");
    });

    it("should list scan jobs", async () => {
        const res = await app.request("/api/scans");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty("jobs");
        expect(Array.isArray(body.jobs)).toBe(true);
        expect(body).toHaveProperty("pagination");
    });

    it("should filter scan jobs by search and mode", async () => {
        await app.request("/api/scans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                targetUrl: "https://filter-me.com/page",
                mode: "site",
            }),
        });

        const res = await app.request(
            "/api/scans?search=filter-me.com&mode=site&limit=5&offset=0"
        );
        expect(res.status).toBe(200);
        const body = (await res.json()) as { jobs: ScanJob[] };
        expect(body.jobs.length).toBeGreaterThan(0);
        body.jobs.forEach((job) => {
            expect(job.targetUrl).toContain("filter-me.com");
            expect(job.mode).toBe("site");
        });
    });

    it("should get a scan job by id", async () => {
        // First create a job
        const createRes = await app.request("/api/scans", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                targetUrl: "https://test.com",
                mode: "site",
            }),
        });
        const createdJob = (await createRes.json()) as ScanJob;

        // Then get it
        const res = await app.request(`/api/scans/${createdJob.id}`);
        expect(res.status).toBe(200);
        const job = (await res.json()) as ScanJob;
        expect(job.id).toBe(createdJob.id);
        expect(job.targetUrl).toBe("https://test.com");
    });

    it("should list pages for a scan job", async () => {
        const { job, page } = await createJobFixture();
        try {
            const res = await app.request(
                `/api/scans/${job.id}/pages?limit=5&offset=0&sort=createdAt`
            );
            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                pages: { id: number; trackingEvents: unknown[] }[];
                pagination: { total: number };
            };
            expect(body.pages.length).toBeGreaterThan(0);
            expect(body.pagination.total).toBeGreaterThan(0);
            const firstPage = body.pages.find((item) => item.id === page.id);
            expect(firstPage).toBeTruthy();
            expect(firstPage?.trackingEvents.length).toBe(1);
        } finally {
            await cleanupJobFixture(job.id);
        }
    });

    it("should get a single page detail", async () => {
        const { job, page } = await createJobFixture();
        try {
            const res = await app.request(
                `/api/scans/${job.id}/pages/${page.id}`
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.id).toBe(page.id);
            expect(body.seo.title).toBe("Fixture Page");
            expect(body.links.internalLinks).toBe(4);
            expect(body.trackingEvents.length).toBe(1);
        } finally {
            await cleanupJobFixture(job.id);
        }
    });

    it("should delete a completed job", async () => {
        const { job } = await createJobFixture();
        const res = await app.request(`/api/scans/${job.id}`, {
            method: "DELETE",
        });
        expect(res.status).toBe(204);
        const remaining = await db
            .select()
            .from(scanJobs)
            .where(eq(scanJobs.id, job.id));
        expect(remaining.length).toBe(0);
    });
});
