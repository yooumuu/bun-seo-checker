import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { exampleRoute } from './routes/examples';

import scansRoute from './routes/scans';

const app = new Hono();

app.use(logger());

const apiRoutes = app.basePath('/api')
    .route('/examples', exampleRoute)
    .route('/scans', scansRoute);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use('/*', serveStatic({ root: './frontend/dist' }));
    app.get('*', serveStatic({ path: './frontend/dist/index.html' }));
}

export default app;
export type ApiRoutes = typeof apiRoutes;
