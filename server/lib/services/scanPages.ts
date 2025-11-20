import {
    and,
    asc,
    count,
    desc,
    eq,
    ilike,
    inArray,
    type AnyColumn,
} from "drizzle-orm";
import { db } from "../db";
import {
    linkMetrics,
    scanPages,
    seoMetrics,
    trackingEvents,
} from "../db/schema";
import type { IssueSummary, LinkAnalysis } from "../analyzers/html";

type TrackingEventRecord = typeof trackingEvents.$inferSelect;

const pageSortColumns = {
    createdAt: scanPages.createdAt,
    url: scanPages.url,
    httpStatus: scanPages.httpStatus,
    loadTimeMs: scanPages.loadTimeMs,
    seoScore: seoMetrics.score,
} satisfies Record<string, AnyColumn>;

export type ListPagesOptions = {
    limit: number;
    offset: number;
    status?: typeof scanPages.$inferSelect.status;
    search?: string;
    sort: keyof typeof pageSortColumns;
    direction: "asc" | "desc";
};

export type PageWithMetrics = {
    id: number;
    jobId: number;
    url: string;
    status: typeof scanPages.$inferSelect.status;
    httpStatus: number | null;
    loadTimeMs: number | null;
    createdAt: Date;
    issueCounts: IssueSummary | null;
    seo: {
        title: string | null;
        metaDescription: string | null;
        canonical: string | null;
        h1: string | null;
        robotsTxtBlocked: boolean | null;
        schemaOrg: unknown;
        score: number | null;
        jsonLdScore: number | null;
        jsonLdTypes: string[] | null;
        jsonLdIssues: {
            errors: string[];
            warnings: string[];
            schemas: Array<{
                type: string;
                score: number;
                errors: string[];
                warnings: string[];
                requiredFields: Record<string, boolean>;
                recommendedFields: Record<string, boolean>;
            }>;
        } | null;
    } | null;
    links: {
        internalLinks: number | null;
        externalLinks: number | null;
        utmSummary: LinkAnalysis["utmSummary"] | null;
        brokenLinks: number | null;
        redirects: number | null;
    } | null;
    trackingEvents: TrackingEventRecord[];
};

export const listPagesForJob = async (
    jobId: number,
    options: ListPagesOptions
) => {
    const conditions = [eq(scanPages.jobId, jobId)];
    if (options.status) {
        conditions.push(eq(scanPages.status, options.status));
    }
    if (options.search) {
        conditions.push(ilike(scanPages.url, `%${options.search}%`));
    }

    const whereClause =
        conditions.length === 1 ? conditions[0]! : and(...conditions);
    const orderColumn = pageSortColumns[options.sort];
    const orderExpression =
        options.direction === "asc"
            ? asc(orderColumn)
            : desc(orderColumn);

    const baseQuery = db
        .select({
            page: scanPages,
            seoId: seoMetrics.id,
            seo: {
                title: seoMetrics.title,
                metaDescription: seoMetrics.metaDescription,
                canonical: seoMetrics.canonical,
                h1: seoMetrics.h1,
                robotsTxtBlocked: seoMetrics.robotsTxtBlocked,
                schemaOrg: seoMetrics.schemaOrg,
                score: seoMetrics.score,
                jsonLdScore: seoMetrics.jsonLdScore,
                jsonLdTypes: seoMetrics.jsonLdTypes,
                jsonLdIssues: seoMetrics.jsonLdIssues,
            },
            linksId: linkMetrics.id,
            links: {
                internalLinks: linkMetrics.internalLinks,
                externalLinks: linkMetrics.externalLinks,
                utmSummary: linkMetrics.utmParams,
                brokenLinks: linkMetrics.brokenLinks,
                redirects: linkMetrics.redirects,
            },
        })
        .from(scanPages)
        .leftJoin(seoMetrics, eq(seoMetrics.pageId, scanPages.id))
        .leftJoin(linkMetrics, eq(linkMetrics.pageId, scanPages.id))
        .where(whereClause)
        .orderBy(orderExpression)
        .limit(options.limit)
        .offset(options.offset);

    const countQuery = db
        .select({ total: count() })
        .from(scanPages)
        .where(whereClause);

    const [rows, totalRows] = await Promise.all([baseQuery, countQuery]);
    const total = totalRows[0]?.total ?? 0;

    const pageIds = rows.map((row) => row.page.id);
    const tracking = pageIds.length
        ? await db
              .select()
              .from(trackingEvents)
              .where(inArray(trackingEvents.pageId, pageIds))
        : [];

    const trackingByPage = new Map<number, TrackingEventRecord[]>();
    for (const event of tracking) {
        const arr = trackingByPage.get(event.pageId) ?? [];
        arr.push(event);
        trackingByPage.set(event.pageId, arr);
    }

    const pages: PageWithMetrics[] = rows.map((row) => {
        const seo =
            row.seoId === null
                ? null
                : {
                      title: row.seo?.title ?? null,
                      metaDescription: row.seo?.metaDescription ?? null,
                      canonical: row.seo?.canonical ?? null,
                      h1: row.seo?.h1 ?? null,
                      robotsTxtBlocked: row.seo?.robotsTxtBlocked ?? null,
                      schemaOrg: row.seo?.schemaOrg ?? null,
                      score: row.seo?.score ?? null,
                      jsonLdScore: row.seo?.jsonLdScore ?? null,
                      jsonLdTypes: row.seo?.jsonLdTypes ?? null,
                      jsonLdIssues: row.seo?.jsonLdIssues as any ?? null,
                  };

        const links =
            row.linksId === null
                ? null
                : {
                      internalLinks: row.links?.internalLinks ?? null,
                      externalLinks: row.links?.externalLinks ?? null,
                      utmSummary: (row.links?.utmSummary ??
                          null) as LinkAnalysis["utmSummary"] | null,
                      brokenLinks: row.links?.brokenLinks ?? null,
                      redirects: row.links?.redirects ?? null,
                  };

        return {
            id: row.page.id,
            jobId: row.page.jobId,
            url: row.page.url,
            status: row.page.status,
            httpStatus: row.page.httpStatus,
            loadTimeMs: row.page.loadTimeMs,
            createdAt: row.page.createdAt ?? new Date(),
            issueCounts: (row.page.issueCounts ??
                null) as IssueSummary | null,
            seo,
            links,
            trackingEvents: trackingByPage.get(row.page.id) ?? [],
        };
    });

    return {
        pages,
        pagination: {
            total,
            limit: options.limit,
            offset: options.offset,
        },
    };
};

export const getPageForJob = async (jobId: number, pageId: number) => {
    const row = await db
        .select({
            page: scanPages,
            seoId: seoMetrics.id,
            seo: {
                title: seoMetrics.title,
                metaDescription: seoMetrics.metaDescription,
                canonical: seoMetrics.canonical,
                h1: seoMetrics.h1,
                robotsTxtBlocked: seoMetrics.robotsTxtBlocked,
                schemaOrg: seoMetrics.schemaOrg,
                score: seoMetrics.score,
                jsonLdScore: seoMetrics.jsonLdScore,
                jsonLdTypes: seoMetrics.jsonLdTypes,
                jsonLdIssues: seoMetrics.jsonLdIssues,
            },
            linksId: linkMetrics.id,
            links: {
                internalLinks: linkMetrics.internalLinks,
                externalLinks: linkMetrics.externalLinks,
                utmSummary: linkMetrics.utmParams,
                brokenLinks: linkMetrics.brokenLinks,
                redirects: linkMetrics.redirects,
            },
        })
        .from(scanPages)
        .leftJoin(seoMetrics, eq(seoMetrics.pageId, scanPages.id))
        .leftJoin(linkMetrics, eq(linkMetrics.pageId, scanPages.id))
        .where(and(eq(scanPages.jobId, jobId), eq(scanPages.id, pageId)))
        .limit(1)
        .then((rows) => rows[0]);

    if (!row) {
        return null;
    }

    const tracking = await db
        .select()
        .from(trackingEvents)
        .where(eq(trackingEvents.pageId, row.page.id));

    return {
        id: row.page.id,
        jobId: row.page.jobId,
        url: row.page.url,
        status: row.page.status,
        httpStatus: row.page.httpStatus,
        loadTimeMs: row.page.loadTimeMs,
        createdAt: row.page.createdAt ?? new Date(),
        issueCounts: (row.page.issueCounts ?? null) as IssueSummary | null,
        seo:
            row.seoId === null
                ? null
                : {
                      title: row.seo?.title ?? null,
                      metaDescription: row.seo?.metaDescription ?? null,
                      canonical: row.seo?.canonical ?? null,
                      h1: row.seo?.h1 ?? null,
                      robotsTxtBlocked: row.seo?.robotsTxtBlocked ?? null,
                      schemaOrg: row.seo?.schemaOrg ?? null,
                      score: row.seo?.score ?? null,
                      jsonLdScore: row.seo?.jsonLdScore ?? null,
                      jsonLdTypes: row.seo?.jsonLdTypes ?? null,
                      jsonLdIssues: row.seo?.jsonLdIssues as any ?? null,
                  },
        links:
            row.linksId === null
                ? null
                : {
                      internalLinks: row.links?.internalLinks ?? null,
                      externalLinks: row.links?.externalLinks ?? null,
                      utmSummary: (row.links?.utmSummary ??
                          null) as LinkAnalysis["utmSummary"] | null,
                      brokenLinks: row.links?.brokenLinks ?? null,
                      redirects: row.links?.redirects ?? null,
                  },
        trackingEvents: tracking,
    } satisfies PageWithMetrics;
};
