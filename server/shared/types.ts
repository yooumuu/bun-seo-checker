import type { z } from 'zod';
import * as schema from '../lib/db/schema';
import type {
  AggregatedIssueSummary,
  IssueSummary as AnalyzerIssueSummary,
} from '../lib/analyzers/html';
import type { JsonLdAnalysis } from '../lib/analyzers/jsonld';
import type { PageWithMetrics } from '../lib/services/scanPages';
import type { TaskEventMessage } from '../lib/workers/events';
import type { ScanJobOptions as ScanJobOptionsSchema } from '../lib/db/schema/scan_jobs';

// 导出schema，方便在应用其他地方使用
export const SelectExampleSchema = schema.selectExampleSchema;
export const InsertExampleSchema = schema.insertExampleSchema;
export const UpdateExampleSchema = schema.updateExampleSchema;

// 导出类型，方便在应用其他地方使用
export type Example = z.infer<typeof schema.selectExampleSchema>;
export type NewExample = z.infer<typeof schema.insertExampleSchema>;
export type UpdateExample = z.infer<typeof schema.updateExampleSchema>;

import type { ApiRoutes } from '../app';

export type { ApiRoutes };

// Scan Jobs
export const SelectScanJobSchema = schema.selectScanJobSchema;
export const InsertScanJobSchema = schema.insertScanJobSchema;
export type ScanJob = z.infer<typeof schema.selectScanJobSchema>;
export type NewScanJob = z.infer<typeof schema.insertScanJobSchema>;
export type ScanIssuesSummary = AggregatedIssueSummary;
export type ScanJobOptions = ScanJobOptionsSchema;

// Scan Pages
export const SelectScanPageSchema = schema.selectScanPageSchema;
export const InsertScanPageSchema = schema.insertScanPageSchema;
export type ScanPage = z.infer<typeof schema.selectScanPageSchema>;
export type NewScanPage = z.infer<typeof schema.insertScanPageSchema>;
export type ScanPageWithMetrics = PageWithMetrics;
export type PageIssueSummary = AnalyzerIssueSummary;

// SEO Metrics
export const SelectSeoMetricsSchema = schema.selectSeoMetricsSchema;
export const InsertSeoMetricsSchema = schema.insertSeoMetricsSchema;
export type SeoMetrics = z.infer<typeof schema.selectSeoMetricsSchema>;
export type NewSeoMetrics = z.infer<typeof schema.insertSeoMetricsSchema>;

// Link Metrics
export const SelectLinkMetricsSchema = schema.selectLinkMetricsSchema;
export const InsertLinkMetricsSchema = schema.insertLinkMetricsSchema;
export type LinkMetrics = z.infer<typeof schema.selectLinkMetricsSchema>;
export type NewLinkMetrics = z.infer<typeof schema.insertLinkMetricsSchema>;

// Tracking Events
export const SelectTrackingEventSchema = schema.selectTrackingEventSchema;
export const InsertTrackingEventSchema = schema.insertTrackingEventSchema;
export type TrackingEvent = z.infer<typeof schema.selectTrackingEventSchema>;
export type NewTrackingEvent = z.infer<typeof schema.insertTrackingEventSchema>;

// Task Events
export const SelectTaskEventSchema = schema.selectTaskEventSchema;
export const InsertTaskEventSchema = schema.insertTaskEventSchema;
export type TaskEvent = z.infer<typeof schema.selectTaskEventSchema>;
export type NewTaskEvent = z.infer<typeof schema.insertTaskEventSchema>;
export type LiveTaskEvent = TaskEventMessage;

// JSON-LD Analysis
export type { JsonLdAnalysis } from '../lib/analyzers/jsonld';
