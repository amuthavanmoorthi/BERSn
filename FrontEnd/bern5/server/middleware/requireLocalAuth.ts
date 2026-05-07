/**
 * Auth middleware for the bern5 local API server (port 5174).
 *
 * Strategy: forward the browser cookies to the main backend's /api/auth/me.
 * If that call returns { ok: true } the user is authenticated; otherwise 401.
 *
 * The main backend URL is resolved from VITE_API_URL (same env var the
 * frontend uses) with a fallback to http://localhost:4000.
 */
import type { NextFunction, Request, Response } from 'express';

const BACKEND_URL = process.env.VITE_API_URL || 'http://localhost:4000';
const ME_ENDPOINT = `${BACKEND_URL}/api/auth/me`;

export async function requireLocalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const cookieHeader = req.headers.cookie || '';

  // In development the local SQLite server is only reachable through the
  // Vite proxy on the same machine, so we do a best-effort auth check and
  // never block the user if the check fails for any transient reason.
  const isDev = process.env.NODE_ENV !== 'production';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2 s max

    const meRes = await fetch(ME_ENDPOINT, {
      method: 'GET',
      headers: { cookie: cookieHeader },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!meRes.ok) {
      if (isDev) {
        console.warn('[local-auth] Backend /me returned', meRes.status, '— allowing through in dev mode.');
        return next();
      }
      res.status(401).json({ error: 'Authentication required.', code: 'LOCAL_AUTH_REQUIRED' });
      return;
    }

    const body = (await meRes.json()) as { ok?: boolean; user?: unknown };
    if (!body.ok) {
      if (isDev) {
        console.warn('[local-auth] /me ok=false — allowing through in dev mode.');
        return next();
      }
      res.status(401).json({ error: 'Authentication required.', code: 'LOCAL_AUTH_REQUIRED' });
      return;
    }

    (req as any).localUser = body.user;
    next();
  } catch {
    if (!isDev) {
      res.status(503).json({ error: 'Authentication service unavailable.', code: 'LOCAL_AUTH_BACKEND_DOWN' });
      return;
    }
    console.warn('[local-auth] Backend unreachable or timed out — allowing through in dev mode.');
    next();
  }
}
