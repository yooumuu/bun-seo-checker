import { pgTable, serial, text, timestamp, integer, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scanJobs = pgTable("scan_jobs", {
    id: serial("id").primaryKey(),
    targetUrl: text("target_url").notNull(),
    mode: text("mode", { enum: ["single", "site"] }).notNull(),
    status: text("status", { enum: ["pending", "running", "completed", "failed"] }).default("pending").notNull(),
    pagesTotal: integer("pages_total").default(0),
    pagesFinished: integer("pages_finished").default(0),
    issuesSummary: jsonb("issues_summary"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    error: text("error"),
});

export const scanPages = pgTable("scan_pages", {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => scanJobs.id).notNull(),
    url: text("url").notNull(),
    status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
    httpStatus: integer("http_status"),
    loadTimeMs: integer("load_time_ms"),
    issueCounts: jsonb("issue_counts"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    jobIdIdx: index("scan_pages_job_id_idx").on(table.jobId),
}));

export const seoMetrics = pgTable("seo_metrics", {
    id: serial("id").primaryKey(),
    pageId: integer("page_id").references(() => scanPages.id).notNull(),
    title: text("title"),
    metaDescription: text("meta_description"),
    canonical: text("canonical"),
    h1: text("h1"),
    robotsTxtBlocked: boolean("robots_txt_blocked").default(false),
    schemaOrg: jsonb("schema_org"),
    score: integer("score"),
}, (table) => ({
    pageIdIdx: index("seo_metrics_page_id_idx").on(table.pageId),
}));

export const linkMetrics = pgTable("link_metrics", {
    id: serial("id").primaryKey(),
    pageId: integer("page_id").references(() => scanPages.id).notNull(),
    internalLinks: integer("internal_links").default(0),
    externalLinks: integer("external_links").default(0),
    utmParams: jsonb("utm_params"),
    brokenLinks: integer("broken_links").default(0),
    redirects: integer("redirects").default(0),
}, (table) => ({
    pageIdIdx: index("link_metrics_page_id_idx").on(table.pageId),
}));

export const trackingEvents = pgTable("tracking_events", {
    id: serial("id").primaryKey(),
    pageId: integer("page_id").references(() => scanPages.id).notNull(),
    element: text("element"),
    trigger: text("trigger"),
    platform: text("platform"), // mixpanel, ga, etc.
    status: text("status"),
}, (table) => ({
    pageIdIdx: index("tracking_events_page_id_idx").on(table.pageId),
}));

export const taskEvents = pgTable("task_events", {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").references(() => scanJobs.id).notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    jobIdIdx: index("task_events_job_id_idx").on(table.jobId),
}));

// Relations
export const scanJobsRelations = relations(scanJobs, ({ many }) => ({
    pages: many(scanPages),
    events: many(taskEvents),
}));

export const scanPagesRelations = relations(scanPages, ({ one, many }) => ({
    job: one(scanJobs, {
        fields: [scanPages.jobId],
        references: [scanJobs.id],
    }),
    seoMetrics: one(seoMetrics, {
        fields: [scanPages.id],
        references: [seoMetrics.pageId],
    }),
    linkMetrics: one(linkMetrics, {
        fields: [scanPages.id],
        references: [linkMetrics.pageId],
    }),
    trackingEvents: many(trackingEvents),
}));

export const seoMetricsRelations = relations(seoMetrics, ({ one }) => ({
    page: one(scanPages, {
        fields: [seoMetrics.pageId],
        references: [scanPages.id],
    }),
}));

export const linkMetricsRelations = relations(linkMetrics, ({ one }) => ({
    page: one(scanPages, {
        fields: [linkMetrics.pageId],
        references: [scanPages.id],
    }),
}));

export const trackingEventsRelations = relations(trackingEvents, ({ one }) => ({
    page: one(scanPages, {
        fields: [trackingEvents.pageId],
        references: [scanPages.id],
    }),
}));

export const taskEventsRelations = relations(taskEvents, ({ one }) => ({
    job: one(scanJobs, {
        fields: [taskEvents.jobId],
        references: [scanJobs.id],
    }),
}));

// Zod Schemas
export const selectScanJobSchema = createSelectSchema(scanJobs);
export const insertScanJobSchema = createInsertSchema(scanJobs).omit({ id: true, createdAt: true, pagesTotal: true, pagesFinished: true, status: true });

export const selectScanPageSchema = createSelectSchema(scanPages);
export const insertScanPageSchema = createInsertSchema(scanPages).omit({ id: true, createdAt: true });

export const selectSeoMetricsSchema = createSelectSchema(seoMetrics);
export const insertSeoMetricsSchema = createInsertSchema(seoMetrics).omit({ id: true });

export const selectLinkMetricsSchema = createSelectSchema(linkMetrics);
export const insertLinkMetricsSchema = createInsertSchema(linkMetrics).omit({ id: true });

export const selectTrackingEventSchema = createSelectSchema(trackingEvents);
export const insertTrackingEventSchema = createInsertSchema(trackingEvents).omit({ id: true });

export const selectTaskEventSchema = createSelectSchema(taskEvents);
export const insertTaskEventSchema = createInsertSchema(taskEvents).omit({ id: true, createdAt: true });

