import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { exampleRoute } from './routes/examples';

const app = new Hono();

app.use(logger());

const apiRoutes = app.basePath('/api').route('/examples', exampleRoute);

export default app;
export type ApiRoutes = typeof apiRoutes;
