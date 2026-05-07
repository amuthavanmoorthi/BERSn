import type { NextFunction, Request, Response } from 'express';

import { authConfig } from '../config/authConfig.js';
import type { AuthServiceError } from '../services/authService.js';
import { getAuthenticatedUser, refreshUserSession } from '../services/authService.js';
import type { CookieOptions } from '../types/auth.js';
import { clearCookie, parseCookies, serializeCookie } from '../utils/httpCookies.js';

function buildCookieOptions(path: string, expiresAt: Date): CookieOptions {
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return {
    path,
    domain: authConfig.cookieDomain,
    httpOnly: true,
    secure: authConfig.cookieSecure,
    sameSite: authConfig.cookieSameSite,
    expires: expiresAt,
    maxAge: maxAgeSeconds,
  };
}

function buildAccessCookie(token: string, expiresAt: Date): string {
  return serializeCookie(
    authConfig.accessCookieName,
    token,
    buildCookieOptions('/', expiresAt),
  );
}

function buildRefreshCookie(token: string, expiresAt: Date): string {
  return serializeCookie(
    authConfig.refreshCookieName,
    token,
    buildCookieOptions('/', expiresAt),
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
  const cookies = parseCookies(req.headers.cookie);
  try {
    const authState = await getAuthenticatedUser(req, cookies[authConfig.accessCookieName]);
    req.auth = authState;
    return next();
  } catch (error) {
    const authError = error as Partial<AuthServiceError> & { message?: string };
    const debugState = {
      request_id: req.requestId || 'unknown',
      method: req.method,
      path: req.originalUrl,
      has_access_cookie: Boolean(cookies[authConfig.accessCookieName]),
      has_refresh_cookie: Boolean(cookies[authConfig.refreshCookieName]),
      auth_error_code: authError.errorCode || 'BERSN_AUTH_TOKEN_INVALID',
      auth_error_message: authError.message || 'Authentication required.',
    };

    if ((authError.status || 401) === 401 && cookies[authConfig.refreshCookieName]) {
      try {
        const refreshedState = await refreshUserSession(req, cookies[authConfig.refreshCookieName]);
        req.auth = {
          user: refreshedState.user,
          sessionId: refreshedState.sessionId,
        };
        res.setHeader('Set-Cookie', [
          buildAccessCookie(refreshedState.accessToken, refreshedState.accessTokenExpiresAt),
          buildRefreshCookie(refreshedState.refreshToken, refreshedState.refreshTokenExpiresAt),
        ]);
        return next();
      } catch (refreshError) {
        const refreshedAuthError = refreshError as Partial<AuthServiceError> & { message?: string };
        console.warn('[auth] requireAuth refresh fallback failed', {
          ...debugState,
          refresh_error_code: refreshedAuthError.errorCode || 'BERSN_AUTH_TOKEN_INVALID',
          refresh_error_message: refreshedAuthError.message || 'Authentication required.',
        });
        if ((refreshedAuthError.status || 401) !== 401) {
          return res.status(refreshedAuthError.status || 500).json({
            ok: false,
            error_code: refreshedAuthError.errorCode || 'BERSN_API_INTERNAL_ERROR',
            message: refreshedAuthError.message || 'Internal server error.',
            details: refreshedAuthError.details || { request_id: req.requestId || 'unknown' },
          });
        }
      }
    }

    if ((authError.status || 401) === 401) {
      console.warn('[auth] requireAuth rejected request', debugState);
    }

    if ((authError.status || 401) === 401) {
      res.setHeader('Set-Cookie', [
        clearCookie(authConfig.accessCookieName, {
          path: '/',
          domain: authConfig.cookieDomain,
          httpOnly: true,
          secure: authConfig.cookieSecure,
          sameSite: authConfig.cookieSameSite,
        }),
        clearCookie(authConfig.refreshCookieName, {
          path: '/',
          domain: authConfig.cookieDomain,
          httpOnly: true,
          secure: authConfig.cookieSecure,
          sameSite: authConfig.cookieSameSite,
        }),
      ]);
    }

    return res.status(authError.status || 401).json({
      ok: false,
      error_code: authError.errorCode || 'BERSN_AUTH_TOKEN_INVALID',
      message: authError.message || 'Authentication required.',
      details: authError.details || { request_id: req.requestId || 'unknown' },
    });
  }
}
