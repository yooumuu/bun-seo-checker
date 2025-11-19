import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { exampleRoute } from './routes/examples';

import scansRoute from './routes/scans';

const app = new Hono();

app.use(logger());

const apiRoutes = app.basePath('/api')
    .route('/examples', exampleRoute)
    .route('/scans', scansRoute);

export default app;
export type ApiRoutes = typeof apiRoutes;
