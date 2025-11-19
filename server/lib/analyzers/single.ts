import { eq } from "drizzle-orm";
import { db } from "../db";
import {
    linkMetrics,
    scanPages,
    scanJobs,
    seoMetrics,
    trackingEvents,
} from "../db/schema/scan_jobs";
import {
    analyzeLinks,
    analyzeSeo,
    analyzeTracking,
    buildIssueSummary,
    type IssueSummary,
} from "./html";
import { env } from "../config";

type ScanJobRecord = typeof scanJobs.$inferSelect;

type FetchResult = {
    html: string;
    status: number;
    loadTimeMs: number;
};

type FetchOverrides = {
    userAgent?: string | null;
    timeoutMs?: number | null;
};

const fetchPage = async (
    url: string,
    overrides?: FetchOverrides
): Promise<FetchResult> => {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        overrides?.timeoutMs ?? env.SCANNER_REQUEST_TIMEOUT_MS
    );

    const started = Date.now();
    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": overrides?.userAgent ?? env.SCANNER_USER_AGENT,
            },
            redirect: "follow",
            signal: controller.signal,
        });
        const html = await response.text();

        return {
            html,
            status: response.status,
            loadTimeMs: Date.now() - started,
        };
    } finally {
        clearTimeout(timeout);
    }
};

export type SingleScanResult = {
    issueSummary: IssueSummary;
    pageId: number;
    pagesTotal: number;
    pagesFinished: number;
    discoveredUrls: string[];
    url: string;
    httpStatus?: number;
    loadTimeMs?: number;
};

export const scanSinglePage = async (
    job: ScanJobRecord,
    pageUrl = job.targetUrl
): Promise<SingleScanResult> => {
    return db.transaction(async (tx) => {
        const [page] = await tx
            .insert(scanPages)
            .values({
                jobId: job.id,
                url: pageUrl,
                status: "processing",
            })
            .returning();

        if (!page) {
            throw new Error("Failed to create scan page record");
        }

        try {
            const fetchResult = await fetchPage(pageUrl, {
                userAgent: job.options?.userAgent,
                timeoutMs: job.options?.requestTimeoutMs,
            });
            const seo = analyzeSeo(fetchResult.html);
            const links = analyzeLinks(fetchResult.html, pageUrl);
            const tracking = analyzeTracking(fetchResult.html);
            const issueSummary = buildIssueSummary(seo, links, tracking);

            await tx
                .update(scanPages)
                .set({
                    status: "completed",
                    httpStatus: fetchResult.status,
                    loadTimeMs: fetchResult.loadTimeMs,
                    issueCounts: issueSummary,
                })
                .where(eq(scanPages.id, page.id));

            await tx.insert(seoMetrics).values({
                pageId: page.id,
                title: seo.title,
                metaDescription: seo.metaDescription,
                canonical: seo.canonical,
                h1: seo.h1,
                robotsTxtBlocked: seo.robotsTxtBlocked,
                schemaOrg: seo.schemaOrg,
                score: seo.score,
            });

            await tx.insert(linkMetrics).values({
                pageId: page.id,
                internalLinks: links.internalLinks,
                externalLinks: links.externalLinks,
                utmParams: links.utmSummary,
                brokenLinks: links.brokenLinks,
                redirects: links.redirects,
            });

            if (tracking.length > 0) {
                await tx.insert(trackingEvents).values(
                    tracking.map((event) => ({
                        pageId: page.id,
                        element: event.element,
                        trigger: event.trigger,
                        eventName: event.eventName ?? null,
                        platform: event.platform,
                        status: event.status,
                    }))
                );
            }

            return {
                issueSummary,
                pageId: page.id,
                pagesTotal: 1,
                pagesFinished: 1,
                discoveredUrls: links.discoveredInternalUrls,
                url: pageUrl,
                httpStatus: fetchResult.status,
                loadTimeMs: fetchResult.loadTimeMs,
            };
        } catch (error) {
            await tx
                .update(scanPages)
                .set({
                    status: "failed",
                    issueCounts: {
                        error: error instanceof Error ? error.message : "Unknown error",
                    },
                })
                .where(eq(scanPages.id, page.id));

            throw error;
        }
    });
};
