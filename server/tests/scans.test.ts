import { describe, expect, it } from "bun:test";
import app from "../app";
import type { ScanJob } from "../shared/types";

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
});
