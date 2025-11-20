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
    type LinkAnalysis,
    type TrackingEventAnalysis,
} from "./html";
import { env } from "../config";
import { browserWorker, type DeviceProfile } from "../workers/browserWorker";

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

            let html = "";
            let status = 0;
            let loadTimeMs = 0;
            let seo: ReturnType<typeof analyzeSeo>;
            let links: ReturnType<typeof analyzeLinks>;
            let tracking: ReturnType<typeof analyzeTracking>;

            if (env.SCANNER_USE_BROWSER) {
                const profiles = env.SCANNER_DEVICE_PROFILES.split(",") as DeviceProfile[];
                const primaryProfile = profiles[0] || "desktop";

                if (primaryProfile !== "desktop") {
                    await tx.update(scanPages)
                        .set({ deviceVariant: primaryProfile })
                        .where(eq(scanPages.id, page.id));
                }

                const start = Date.now();
                let primaryResult: Awaited<ReturnType<typeof browserWorker.scanPage>> | null = null;
                const allLinks: Array<Awaited<ReturnType<typeof browserWorker.scanPage>>['links'][0] & { deviceVariant: DeviceProfile }> = [];
                const allTracking: Array<Awaited<ReturnType<typeof browserWorker.scanPage>>['trackingEvents'][0] & { deviceVariant: DeviceProfile }> = [];

                for (const profile of profiles) {
                    try {
                        const result = await browserWorker.scanPage(pageUrl, profile);
                        if (profile === primaryProfile) {
                            primaryResult = result;
                            loadTimeMs = Date.now() - start;
                            html = result.html;
                            status = 200;
                        }

                        result.links.forEach(l => {
                            if (l.visible) {
                                allLinks.push({ ...l, deviceVariant: profile });
                            }
                        });
                        result.trackingEvents.forEach(t => allTracking.push({ ...t, deviceVariant: profile }));
                    } catch (err) {
                        console.error(`Scan failed for profile ${profile}`, err);
                        if (profile === primaryProfile) throw err;
                    }
                }

                if (!primaryResult) throw new Error("Primary scan failed");

                seo = analyzeSeo(html);

                let trackedCount = 0;
                let missingCount = 0;
                let internalCount = 0;
                let externalCount = 0;
                const examples: LinkAnalysis["utmSummary"]["examples"] = [];
                const discoveredInternal = new Set<string>();
                const origin = new URL(pageUrl).origin;

                // Counts from Primary Profile only
                for (const link of primaryResult.links) {
                    if (!link.visible) continue;
                    const isInternal = link.url.startsWith(origin);
                    if (isInternal) {
                        internalCount++;
                        if (discoveredInternal.size < 200) discoveredInternal.add(link.url);
                    } else {
                        externalCount++;
                    }
                }

                // UTM Summary from ALL Profiles
                for (const link of allLinks) {
                    const isInternal = link.url.startsWith(origin);
                    const hasUtm = Object.keys(link.utmParams).length > 0;

                    if (hasUtm) {
                        trackedCount++;
                        examples.push({
                            url: link.url,
                            params: Object.keys(link.utmParams),
                            text: link.text || null,
                            heading: link.heading ? { tag: null, text: link.heading } : null,
                            deviceVariant: link.deviceVariant,
                            selector: link.selector,
                            triggeredEvents: link.triggeredEvents?.map(e => ({
                                element: "link",
                                trigger: e.type,
                                platform: e.platform,
                                status: "fired",
                                eventName: typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload),
                                deviceVariant: link.deviceVariant,
                                payload: e.payload
                            })) || [],
                        });
                    } else if (isInternal) {
                        missingCount++;
                        examples.push({
                            url: link.url,
                            params: [],
                            text: link.text || null,
                            heading: link.heading ? { tag: null, text: link.heading } : null,
                            deviceVariant: link.deviceVariant,
                            selector: link.selector,
                            triggeredEvents: link.triggeredEvents?.map(e => ({
                                element: "link",
                                trigger: e.type,
                                platform: e.platform,
                                status: "fired",
                                eventName: typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload),
                                deviceVariant: link.deviceVariant,
                                payload: e.payload
                            })) || [],
                        });
                    }
                }

                links = {
                    internalLinks: internalCount,
                    externalLinks: externalCount,
                    utmSummary: {
                        trackedLinks: trackedCount,
                        missingUtm: missingCount,
                        examples,
                    },
                    brokenLinks: 0,
                    redirects: 0,
                    discoveredInternalUrls: Array.from(discoveredInternal),
                };

                tracking = allTracking.map((e) => ({
                    element: "script",
                    trigger: e.type,
                    platform: e.platform,
                    status: "fired",
                    eventName: typeof e.payload === 'string' ? e.payload : JSON.stringify(e.payload),
                    deviceVariant: e.deviceVariant,
                    payload: e.payload,
                }));
            } else {
                const fetchResult = await fetchPage(pageUrl, {
                    userAgent: job.options?.userAgent,
                    timeoutMs: job.options?.requestTimeoutMs,
                });
                html = fetchResult.html;
                status = fetchResult.status;
                loadTimeMs = fetchResult.loadTimeMs;

                seo = analyzeSeo(html);
                links = analyzeLinks(html, pageUrl);
                tracking = analyzeTracking(html);
            }

            // 分析 JSON-LD 结构化数据
            const { analyzeJsonLd } = await import("./jsonld.js");
            const jsonLdAnalysis = analyzeJsonLd(html);
            seo.jsonLdAnalysis = jsonLdAnalysis;

            const issueSummary = buildIssueSummary(seo, links, tracking);

            await tx
                .update(scanPages)
                .set({
                    status: "completed",
                    httpStatus: status,
                    loadTimeMs: loadTimeMs,
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
                jsonLdScore: jsonLdAnalysis.score,
                jsonLdTypes: jsonLdAnalysis.types,
                jsonLdIssues: {
                    errors: jsonLdAnalysis.errors,
                    warnings: jsonLdAnalysis.warnings,
                    schemas: jsonLdAnalysis.schemas.map(s => ({
                        type: s.type,
                        score: s.score,
                        errors: s.errors,
                        warnings: s.warnings,
                    })),
                },
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
                        deviceVariant: event.deviceVariant ?? "desktop",
                        payload: event.payload ?? null,
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
                httpStatus: status,
                loadTimeMs: loadTimeMs,
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
