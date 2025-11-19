import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { createSelectSchema, createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// 定义一个简单的示例表结构
export const exampleTable = pgTable('examples', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  count: integer('count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 使用drizzle-zod创建Zod验证schema
// 用于查询结果的schema
export const selectExampleSchema = createSelectSchema(exampleTable);

// 用于插入数据的schema
export const insertExampleSchema = createInsertSchema(exampleTable, {
  // 可以在这里添加额外的自定义验证
  name: z.string().min(3).max(50),
  description: z.string().max(500).optional(),
  count: z.number().int().min(0).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// 用于更新数据的schema
export const updateExampleSchema = insertExampleSchema.partial();

// 用于API参数验证的schema
export const exampleIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});
