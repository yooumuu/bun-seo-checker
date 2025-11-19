import { aggregateSummaries, type IssueSummary } from "./html";
import { scanSinglePage, type SingleScanResult } from "./single";
import { env } from "../config";
import type { scanJobs } from "../db/schema/scan_jobs";

type ScanJobRecord = typeof scanJobs.$inferSelect;

type SiteScanOverrides = {
    userAgent?: string | null;
    timeoutMs?: number | null;
};

const normalizeUrl = (url: string) => {
    try {
        const parsed = new URL(url);
        parsed.hash = "";
        const normalized = parsed.toString().replace(/\/$/, "");
        return normalized;
    } catch {
        return url;
    }
};

const fetchSitemapUrls = async (
    baseUrl: string,
    max: number,
    overrides: SiteScanOverrides
) => {
    try {
        const origin = new URL(baseUrl).origin;
        const sitemapUrl = `${origin}/sitemap.xml`;
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            overrides.timeoutMs ?? env.SCANNER_REQUEST_TIMEOUT_MS
        );

        try {
            const response = await fetch(sitemapUrl, {
                headers: {
                    "User-Agent": overrides.userAgent ?? env.SCANNER_USER_AGENT,
                },
                signal: controller.signal,
            });
            if (!response.ok) {
                return [];
            }
            const xml = await response.text();
            const urls: string[] = [];
            const locRegex = /<loc>([\s\S]*?)<\/loc>/gi;
            let match: RegExpExecArray | null;
            while ((match = locRegex.exec(xml)) && urls.length < max) {
                const loc = match[1]?.trim();
                if (loc) {
                    urls.push(loc);
                }
            }
            return urls;
        } finally {
            clearTimeout(timeout);
        }
    } catch {
        return [];
    }
};

type QueueItem = {
    url: string;
    depth: number;
};

export const scanSite = async (
    job: ScanJobRecord,
    onPage?: (result: SingleScanResult) => void | Promise<void>
) => {
    const depthLimit =
        job.options?.siteDepth ?? env.SCANNER_DEFAULT_SITE_DEPTH;
    const maxPages = job.options?.maxPages ?? env.SCANNER_MAX_PAGES;
    const overrides: SiteScanOverrides = {
        userAgent: job.options?.userAgent,
        timeoutMs: job.options?.requestTimeoutMs,
    };
    const sitemapUrls = await fetchSitemapUrls(
        job.targetUrl,
        maxPages,
        overrides
    );
    const queue: QueueItem[] = [{ url: job.targetUrl, depth: 0 }];
    sitemapUrls.forEach((url) => {
        queue.push({ url, depth: 1 });
    });

    const visited = new Set<string>();
    const summaries: IssueSummary[] = [];
    let processed = 0;

    while (queue.length > 0 && processed < maxPages) {
        const current = queue.shift()!;
        const normalizedCurrent = normalizeUrl(current.url);
        if (visited.has(normalizedCurrent)) {
            continue;
        }

        visited.add(normalizedCurrent);
        const result = await scanSinglePage(job, current.url);
        if (onPage) {
            await onPage(result);
        }
        summaries.push(result.issueSummary);
        processed += 1;

        if (current.depth + 1 > depthLimit) {
            continue;
        }

        for (const nextUrl of result.discoveredUrls) {
            const normalizedChild = normalizeUrl(nextUrl);
            if (!visited.has(normalizedChild)) {
                queue.push({
                    url: nextUrl,
                    depth: current.depth + 1,
                });
            }
        }
    }

    const aggregated = aggregateSummaries(summaries);

    return {
        issueSummary: aggregated,
        pagesTotal: processed,
        pagesFinished: processed,
    };
};
