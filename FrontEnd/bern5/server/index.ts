/**
 * Bern5 API server.
 * Runs alongside Vite dev (proxied via /api).
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { indexDb } from './db.js';
import { requireLocalAuth } from './middleware/requireLocalAuth.js';
import { projectsRouter } from './routes/projects.js';
import { floorsRouter } from './routes/floors.js';
import { calcRouter } from './routes/calc.js';
import { openapiSpec } from './openapi.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

// All data routes require an authenticated session from the main backend.
app.use('/api/projects', requireLocalAuth, projectsRouter);
app.use('/api/projects/:id/floors', requireLocalAuth, floorsRouter);
app.use('/api/projects/:id/calc', requireLocalAuth, calcRouter);

// ---- API Docs ----
app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec as any, {
    customSiteTitle: 'Bern5 API Docs',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'list', tryItOutEnabled: true },
  }),
);

// ---- Health ----
app.get('/api/health', (_req, res) => {
  const db = indexDb();
  const row = db.prepare('SELECT COUNT(*) AS n FROM project_index').get() as { n: number };
  res.json({ ok: true, projectCount: row.n, ts: Date.now() });
});

// ---- (Routes for projects, floors, calc will be added in PR2-PR4) ----

// ---- Error handler ----
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status ?? 500;
  console.error('[api]', err?.message || err);
  res.status(status).json({ error: err?.message || 'Internal error' });
});

const PORT = Number(process.env.API_PORT) || 5174;
app.listen(PORT, () => {
  // Warm the index DB on startup so any migration/IO error surfaces immediately.
  indexDb();
  console.log(`[api] listening on http://localhost:${PORT}`);
});
