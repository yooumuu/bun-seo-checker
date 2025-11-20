import type { z } from 'zod';
import type {
  AggregatedIssueSummary,
  IssueSummary as AnalyzerIssueSummary,
} from '../lib/analyzers/html';
import type { PageWithMetrics } from '../lib/services/scanPages';
import type { TaskEventMessage } from '../lib/workers/events';
import type { ApiRoutes } from '../app';

export type { ApiRoutes };

// Scan Job Options Type (纯类型定义，无需引入 drizzle)
export type ScanJobOptions = {
  siteDepth?: number;
  maxPages?: number;
  userAgent?: string;
  requestTimeoutMs?: number;
};

// Scan Job Types (手动定义类型，避免引入 schema)
export type ScanJob = {
  id: number;
  targetUrl: string;
  mode: "single" | "site";
  status: "pending" | "running" | "completed" | "failed";
  pagesTotal: number;
  pagesFinished: number;
  issuesSummary: AggregatedIssueSummary | null;
  options: ScanJobOptions | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
};

export type NewScanJob = {
  targetUrl: string;
  mode: "single" | "site";
  options?: ScanJobOptions;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
};

export type ScanIssuesSummary = AggregatedIssueSummary;

// Scan Page Types
export type ScanPage = {
  id: number;
  jobId: number;
  url: string;
  status: "pending" | "processing" | "completed" | "failed";
  httpStatus: number | null;
  loadTimeMs: number | null;
  issueCounts: Record<string, unknown> | null;
  deviceVariant: string;
  createdAt: Date;
};

export type NewScanPage = {
  jobId: number;
  url: string;
  status?: "pending" | "processing" | "completed" | "failed";
  httpStatus?: number;
  loadTimeMs?: number;
  issueCounts?: Record<string, unknown>;
  deviceVariant?: string;
};

export type ScanPageWithMetrics = PageWithMetrics;
export type PageIssueSummary = AnalyzerIssueSummary;

// SEO Metrics Types
export type SeoMetrics = {
  id: number;
  pageId: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string | null;
  h1Score?: number | null; // H1 质量评分 (0-100)
  h1Issues?: string[] | null; // H1 存在的问题
  robotsTxtBlocked: boolean;
  schemaOrg: Record<string, unknown> | null;
  score: number | null;
  jsonLdScore: number | null;
  jsonLdTypes: string[] | null;
  jsonLdIssues: Record<string, unknown> | null;
  htmlStructureScore: number | null;
  htmlStructureIssues: Record<string, unknown> | null;
};

export type NewSeoMetrics = Omit<SeoMetrics, 'id'>;

// Link Metrics Types
export type LinkMetrics = {
  id: number;
  pageId: number;
  internalLinks: number;
  externalLinks: number;
  utmParams: Record<string, unknown> | null;
  brokenLinks: number;
  redirects: number;
};

export type NewLinkMetrics = Omit<LinkMetrics, 'id'>;

// Tracking Event Types
export type TrackingEvent = {
  id: number;
  pageId: number;
  element: string | null;
  trigger: string | null;
  eventName: string | null;
  platform: string | null;
  deviceVariant: string;
  payload: Record<string, unknown> | null;
  status: string | null;
};

export type NewTrackingEvent = Omit<TrackingEvent, 'id'>;

// Task Event Types
export type TaskEvent = {
  id: number;
  jobId: number;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: Date;
};

export type NewTaskEvent = Omit<TaskEvent, 'id' | 'createdAt'>;
export type LiveTaskEvent = TaskEventMessage;

// JSON-LD Analysis
export type { JsonLdAnalysis } from '../lib/analyzers/jsonld';

// Legacy example types (可选，如果不需要可以删除)
export type Example = {
  id: number;
  name: string;
  createdAt: Date;
};

export type NewExample = Omit<Example, 'id' | 'createdAt'>;
export type UpdateExample = Partial<NewExample>;
