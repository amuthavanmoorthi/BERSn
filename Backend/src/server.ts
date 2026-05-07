import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';

import pool from './db.js';
import { openapiSpec } from './openapi.js';
import authRoutes from './routes/authRoutes.js';
import lookupRoutes from './routes/lookupRoutes.js';
import projectsRoutes from './routes/projectsRoutes.js';
import usersRoutes from './routes/usersRoutes.js';
import { getRefreshSession } from './services/authRedis.js';

const app = express();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const READY_REDIS_TIMEOUT_MS = Number(process.env.READY_REDIS_TIMEOUT_MS || 2000);

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
];

const configuredAllowedOrigins = String(process.env.API_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredAllowedOrigins]);

function getSingleHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  return allowedOrigins.has(origin);
}

app.set('trust proxy', Number(process.env.API_TRUST_PROXY || 0));
app.use(express.json({ limit: '2mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const requestOrigin = getSingleHeaderValue(req.headers.origin);
  if (requestOrigin && !isAllowedCorsOrigin(requestOrigin)) {
    return res.status(403).json({
      ok: false,
      error_code: 'BERSN_API_CORS_BLOCKED',
      message: `CORS blocked for origin: ${requestOrigin}`,
    });
  }

  if (requestOrigin && isAllowedCorsOrigin(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id,X-Device-Fingerprint');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const requestIdHeader = getSingleHeaderValue(req.headers['x-request-id']);
  const requestId = requestIdHeader || crypto.randomUUID();
  req.requestId = String(requestId);
  res.setHeader('x-request-id', req.requestId);

  const startedNs = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedNs) / 1_000_000;
    console.log('[Backend request]', {
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status_code: res.statusCode,
      elapsed_ms: Number(elapsedMs.toFixed(3)),
    });
  });

  next();
});

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1;');
    return res.json({ ok: true, status: 'ok' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ ok: false, status: 'fail', error: message });
  }
});

app.get('/ready', async (req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1;');
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('redis readiness timeout')), READY_REDIS_TIMEOUT_MS);
    });

    await Promise.race([getRefreshSession('__ready_check__'), timeout]).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('timeout')) {
        return;
      }
      throw error;
    });

    return res.json({
      ok: true,
      status: 'ready',
      request_id: req.requestId || 'unknown',
      checks: { database: 'ok', redis: 'ok' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(503).json({
      ok: false,
      status: 'not_ready',
      request_id: req.requestId || 'unknown',
      error: message,
    });
  }
});

// ── API Documentation ─────────────────────────────────────────────
app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec as Parameters<typeof swaggerUi.setup>[0], {
    customSiteTitle: 'BERSn API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      tryItOutEnabled: true,
      filter: true,
    },
  }),
);

app.use('/api', authRoutes);
app.use('/api', usersRoutes);
app.use('/api', lookupRoutes);
app.use('/api', projectsRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BERSn Backend listening on ${PORT}`);
});
