/**
 * Zod Schemas for validation
 * 这个文件只在后端使用，包含 drizzle-orm 依赖
 * 前端应该使用 types.ts 中的纯类型定义
 */
import * as schema from '../lib/db/schema';

// 导出 schema，方便在后端进行数据验证
export const SelectExampleSchema = schema.selectExampleSchema;
export const InsertExampleSchema = schema.insertExampleSchema;
export const UpdateExampleSchema = schema.updateExampleSchema;

// Scan Jobs
export const SelectScanJobSchema = schema.selectScanJobSchema;
export const InsertScanJobSchema = schema.insertScanJobSchema;

// Scan Pages
export const SelectScanPageSchema = schema.selectScanPageSchema;
export const InsertScanPageSchema = schema.insertScanPageSchema;

// SEO Metrics
export const SelectSeoMetricsSchema = schema.selectSeoMetricsSchema;
export const InsertSeoMetricsSchema = schema.insertSeoMetricsSchema;

// Link Metrics
export const SelectLinkMetricsSchema = schema.selectLinkMetricsSchema;
export const InsertLinkMetricsSchema = schema.insertLinkMetricsSchema;

// Tracking Events
export const SelectTrackingEventSchema = schema.selectTrackingEventSchema;
export const InsertTrackingEventSchema = schema.insertTrackingEventSchema;

// Task Events
export const SelectTaskEventSchema = schema.selectTaskEventSchema;
export const InsertTaskEventSchema = schema.insertTaskEventSchema;
