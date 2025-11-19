const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/i;
const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
const canonicalRegex = /<link[^>]+rel=["']canonical["'][^>]*>/i;
const metaTagRegex = (name: string) =>
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, "i");
const ldJsonRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i;
const anchorRegex = /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi;

const decodeHtmlEntities = (value: string) =>
    value
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .trim();

const extractAttribute = (snippet: string, attribute: string) => {
    const regex = new RegExp(
        `${attribute}\\s*=\\s*("([^"]*)"|'([^']*)')`,
        "i"
    );
    const match = snippet.match(regex);
    return match ? decodeHtmlEntities(match[2] ?? match[3] ?? "") : null;
};

const extractMetaContent = (html: string, name: string) => {
    const match = html.match(metaTagRegex(name));
    if (!match) return null;
    return extractAttribute(match[0], "content");
};

export type SeoAnalysis = {
    title: string | null;
    metaDescription: string | null;
    canonical: string | null;
    h1: string | null;
    robotsTxtBlocked: boolean;
    schemaOrg: unknown;
    score: number;
};

export type LinkAnalysis = {
    internalLinks: number;
    externalLinks: number;
    utmSummary: {
        trackedLinks: number;
        missingUtm: number;
        examples: Array<{ url: string; params: string[] }>;
    };
    brokenLinks: number;
    redirects: number;
    discoveredInternalUrls: string[];
};

export type TrackingEventAnalysis = {
    element: string;
    trigger: string;
    platform: string;
    status: string;
};

type SeoIssueMap = Record<string, boolean> & {
    missingTitle: boolean;
    missingDescription: boolean;
    missingH1: boolean;
    missingCanonical: boolean;
    robotsBlocked: boolean;
};

type LinkIssueMap = Record<string, number> & {
    internalLinks: number;
    externalLinks: number;
    utmMissing: number;
    utmTracked: number;
};

type TrackingIssueMap = Record<string, boolean> & {
    mixpanelMissing: boolean;
    gaMissing: boolean;
};

type IssueSummaryMeta = {
    seoScore: number;
};

export type IssueSummary = {
    seo: SeoIssueMap;
    links: LinkIssueMap;
    tracking: TrackingIssueMap;
    totals: {
        seoIssues: number;
        linkIssues: number;
        trackingIssues: number;
    };
    meta: IssueSummaryMeta;
};

export const analyzeSeo = (html: string): SeoAnalysis => {
    const titleMatch = html.match(titleRegex);
    const h1Match = html.match(h1Regex);
    const canonicalMatch = html.match(canonicalRegex);
    const ldJsonMatch = html.match(ldJsonRegex);

    const robotsMeta = extractMetaContent(html, "robots");

    const title = titleMatch?.[1]
        ? decodeHtmlEntities(titleMatch[1])
        : null;
    const metaDescription = extractMetaContent(html, "description");
    const h1 = h1Match?.[1]
        ? decodeHtmlEntities(h1Match[1])
        : null;
    const canonical = canonicalMatch
        ? extractAttribute(canonicalMatch[0], "href")
        : null;

    let schemaOrg: unknown = null;
    if (ldJsonMatch) {
        try {
            schemaOrg = ldJsonMatch[1] ? JSON.parse(ldJsonMatch[1]) : null;
        } catch {
            schemaOrg = ldJsonMatch[1]?.trim() ?? null;
        }
    }

    const robotsTxtBlocked =
        robotsMeta?.toLowerCase().includes("noindex") ?? false;

    let score = 100;
    if (!title) score -= 30;
    if (!metaDescription) score -= 20;
    if (!h1) score -= 20;
    if (!canonical) score -= 10;
    if (robotsTxtBlocked) score -= 20;
    if (!schemaOrg) score -= 5;

    return {
        title,
        metaDescription,
        canonical,
        h1,
        robotsTxtBlocked,
        schemaOrg,
        score: Math.max(score, 0),
    };
};

export const analyzeLinks = (
    html: string,
    baseUrl: string
): LinkAnalysis => {
    const base = new URL(baseUrl);
    const examples: Array<{ url: string; params: string[] }> = [];
    const discoveredInternal = new Set<string>();
    let internal = 0;
    let external = 0;
    let tracked = 0;
    let missing = 0;

    let match: RegExpExecArray | null;
    while ((match = anchorRegex.exec(html))) {
        const href = decodeHtmlEntities(match[1] ?? match[2] ?? "");
        if (!href) continue;
        try {
            const normalized = new URL(href, base).toString();
            const linkUrl = new URL(normalized);
            const isInternal = linkUrl.hostname === base.hostname;
            const utmParams = Array.from(linkUrl.searchParams.keys()).filter(
                (key) => key.toLowerCase().startsWith("utm_")
            );

            if (isInternal) internal += 1;
            else external += 1;

            if (utmParams.length > 0) {
                tracked += 1;
                if (examples.length < 10) {
                    examples.push({
                        url: normalized,
                        params: utmParams,
                    });
                }
            } else if (isInternal) {
                missing += 1;
            }

            if (isInternal && discoveredInternal.size < 200) {
                linkUrl.hash = "";
                const normalizedPath = linkUrl.toString().replace(/\/$/, "");
                discoveredInternal.add(normalizedPath);
            }
        } catch {
            continue;
        }
    }

    return {
        internalLinks: internal,
        externalLinks: external,
        utmSummary: {
            trackedLinks: tracked,
            missingUtm: missing,
            examples,
        },
        brokenLinks: 0,
        redirects: 0,
        discoveredInternalUrls: Array.from(discoveredInternal),
    };
};

export const analyzeTracking = (html: string): TrackingEventAnalysis[] => {
    const events: TrackingEventAnalysis[] = [];

    if (/mixpanel\.track/i.test(html) || /data-mixpanel/i.test(html)) {
        events.push({
            element: "script",
            trigger: "load",
            platform: "mixpanel",
            status: "detected",
        });
    }

    if (/gtag\(/i.test(html) || /ga\(['"]send/i.test(html)) {
        events.push({
            element: "script",
            trigger: "load",
            platform: "ga",
            status: "detected",
        });
    }

    return events;
};

export const buildIssueSummary = (
    seo: SeoAnalysis,
    links: LinkAnalysis,
    tracking: TrackingEventAnalysis[]
): IssueSummary => {
    const mixpanelPresent = tracking.some(
        (event) => event.platform === "mixpanel"
    );
    const gaPresent = tracking.some((event) => event.platform === "ga");

    const seoMap: SeoIssueMap = {
        missingTitle: !seo.title,
        missingDescription: !seo.metaDescription,
        missingH1: !seo.h1,
        missingCanonical: !seo.canonical,
        robotsBlocked: seo.robotsTxtBlocked,
    };

    const linkMap: LinkIssueMap = {
        internalLinks: links.internalLinks,
        externalLinks: links.externalLinks,
        utmMissing: links.utmSummary.missingUtm,
        utmTracked: links.utmSummary.trackedLinks,
    };

    const trackingMap: TrackingIssueMap = {
        mixpanelMissing: !mixpanelPresent,
        gaMissing: !gaPresent,
    };

    const totals = {
        seoIssues: Object.values(seoMap).filter(Boolean).length,
        linkIssues: links.utmSummary.missingUtm,
        trackingIssues:
            Number(trackingMap.mixpanelMissing) + Number(trackingMap.gaMissing),
    };

    return {
        seo: seoMap,
        links: linkMap,
        tracking: trackingMap,
        totals,
        meta: {
            seoScore: seo.score,
        },
    };
};

export type AggregatedIssueSummary = {
    seo: Record<string, number>;
    links: LinkIssueMap;
    tracking: Record<string, number>;
    totals: {
        seoIssues: number;
        linkIssues: number;
        trackingIssues: number;
    };
    pagesAnalysed: number;
    scorecard: {
        seoAverageScore: number;
        utmCoveragePercent: number;
        trackingCoverage: {
            mixpanel: number;
            ga: number;
            average: number;
        };
        overallHealthPercent: number;
    };
};

export const aggregateSummaries = (
    summaries: IssueSummary[]
): AggregatedIssueSummary => {
    const aggregatedSeo: Record<string, number> = {};
    const aggregatedLinks: LinkIssueMap = {
        internalLinks: 0,
        externalLinks: 0,
        utmMissing: 0,
        utmTracked: 0,
    };
    const aggregatedTracking: Record<string, number> = {};
    const totals = { seoIssues: 0, linkIssues: 0, trackingIssues: 0 };
    let seoScoreTotal = 0;

    if (summaries.length === 0) {
        return {
            seo: aggregatedSeo,
            links: aggregatedLinks,
            tracking: aggregatedTracking,
            totals,
            pagesAnalysed: 0,
            scorecard: {
                seoAverageScore: 0,
                utmCoveragePercent: 0,
                trackingCoverage: {
                    mixpanel: 0,
                    ga: 0,
                    average: 0,
                },
                overallHealthPercent: 0,
            },
        };
    }

    for (const summary of summaries) {
        totals.seoIssues += summary.totals.seoIssues;
        totals.linkIssues += summary.totals.linkIssues;
        totals.trackingIssues += summary.totals.trackingIssues;
        seoScoreTotal += summary.meta.seoScore ?? 0;

        for (const [key, value] of Object.entries(summary.seo)) {
            aggregatedSeo[key] = (aggregatedSeo[key] ?? 0) + (value ? 1 : 0);
        }

        aggregatedLinks.internalLinks += summary.links.internalLinks ?? 0;
        aggregatedLinks.externalLinks += summary.links.externalLinks ?? 0;
        aggregatedLinks.utmMissing += summary.links.utmMissing ?? 0;
        aggregatedLinks.utmTracked += summary.links.utmTracked ?? 0;

        for (const [key, value] of Object.entries(summary.tracking)) {
            aggregatedTracking[key] =
                (aggregatedTracking[key] ?? 0) + (value ? 1 : 0);
        }
    }

    const pagesAnalysed = summaries.length;
    const seoAverageScore = pagesAnalysed
        ? Math.round(seoScoreTotal / pagesAnalysed)
        : 0;
    const totalTrackedLinks = aggregatedLinks.utmTracked ?? 0;
    const totalMissingLinks = aggregatedLinks.utmMissing ?? 0;
    const linkDenominator = totalTrackedLinks + totalMissingLinks;
    const utmCoveragePercent =
        linkDenominator > 0
            ? Math.round((totalTrackedLinks / linkDenominator) * 100)
            : 0;

    const mixpanelMissing = aggregatedTracking.mixpanelMissing ?? 0;
    const gaMissing = aggregatedTracking.gaMissing ?? 0;
    const mixpanelCoverage = pagesAnalysed
        ? Math.round(((pagesAnalysed - mixpanelMissing) / pagesAnalysed) * 100)
        : 0;
    const gaCoverage = pagesAnalysed
        ? Math.round(((pagesAnalysed - gaMissing) / pagesAnalysed) * 100)
        : 0;
    const trackingCoverageAverage = Math.round(
        (mixpanelCoverage + gaCoverage) / 2
    );

    const overallHealthPercent = Math.round(
        (seoAverageScore + utmCoveragePercent + trackingCoverageAverage) / 3
    );

    return {
        seo: aggregatedSeo,
        links: aggregatedLinks,
        tracking: aggregatedTracking,
        totals,
        pagesAnalysed,
        scorecard: {
            seoAverageScore,
            utmCoveragePercent,
            trackingCoverage: {
                mixpanel: mixpanelCoverage,
                ga: gaCoverage,
                average: trackingCoverageAverage,
            },
            overallHealthPercent,
        },
    };
};
