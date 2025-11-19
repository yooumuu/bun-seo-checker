import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, desc } from 'drizzle-orm';
import { db } from '../lib/db';
import {
  exampleIdSchema,
  exampleTable,
  insertExampleSchema,
  updateExampleSchema,
} from '../lib/db/schema/examples';

export const exampleRoute = new Hono()
  // GET /example - 获取所有记录
  .get('/', async (c) => {
    const examples = await db
      .select()
      .from(exampleTable)
      .orderBy(desc(exampleTable.createdAt));

    return c.json({ examples });
  })

  // GET /example/:id - 获取单个记录
  .get('/:id', zValidator('param', exampleIdSchema), async (c) => {
    const { id } = c.req.valid('param');

    const example = await db
      .select()
      .from(exampleTable)
      .where(eq(exampleTable.id, id))
      .then((res) => res[0] || null);

    if (!example) {
      c.status(404);
      return c.json({ error: 'Example not found' });
    }

    return c.json(example);
  })

  // POST /example - 创建新记录
  .post('/', zValidator('json', insertExampleSchema), async (c) => {
    const example = c.req.valid('json');

    const newExample = await db
      .insert(exampleTable)
      .values(example)
      .returning()
      .then((res) => res[0]);

    c.status(201);
    return c.json(newExample);
  })

  // PUT /example/:id - 更新记录
  .put(
    '/:id',
    zValidator('param', exampleIdSchema),
    zValidator('json', updateExampleSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const data = c.req.valid('json');

      // 检查记录是否存在
      const exists = await db
        .select({ id: exampleTable.id })
        .from(exampleTable)
        .where(eq(exampleTable.id, id))
        .then((res) => res.length > 0);

      if (!exists) {
        c.status(404);
        return c.json({ error: 'Example not found' });
      }

      // 更新记录
      const updated = await db
        .update(exampleTable)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(exampleTable.id, id))
        .returning()
        .then((res) => res[0]);

      return c.json(updated);
    }
  )

  // DELETE /example/:id - 删除记录
  .delete('/:id', zValidator('param', exampleIdSchema), async (c) => {
    const { id } = c.req.valid('param');

    // 检查记录是否存在
    const exists = await db
      .select({ id: exampleTable.id })
      .from(exampleTable)
      .where(eq(exampleTable.id, id))
      .then((res) => res.length > 0);

    if (!exists) {
      c.status(404);
      return c.json({ error: 'Example not found' });
    }

    // 删除记录
    await db.delete(exampleTable).where(eq(exampleTable.id, id));

    c.status(204); // No Content
    return c.body(null);
  });
