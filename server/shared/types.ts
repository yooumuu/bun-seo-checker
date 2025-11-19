import type { z } from 'zod';
import * as schema from '../lib/db/schema';

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
