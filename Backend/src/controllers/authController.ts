import type { Request, Response } from 'express';

import { authConfig } from '../config/authConfig.js';
import type { AuthServiceError } from '../services/authService.js';
import {
  changeUserPassword,
  createUserAsAdmin,
  getPasskeyAuthenticationOptions,
  getPasskeyRegistrationOptions,
  getAuthenticatedUser,
  loginUser,
  logoutUser,
  refreshUserSession,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from '../services/authService.js';
import type { CookieOptions } from '../types/auth.js';
import {
  clearCookie,
  parseCookies,
  serializeCookie,
} from '../utils/httpCookies.js';

interface LoginBody {
  password?: unknown;
  remember_me?: unknown;
  username?: unknown;
}

interface ChangePasswordBody {
  current_password?: unknown;
  new_password?: unknown;
}

interface AdminCreateUserBody {
  password?: unknown;
  role?: unknown;
  username?: unknown;
}

interface PasskeyAuthenticationOptionsBody {
  username?: unknown;
}

interface PasskeyAuthenticationVerifyBody {
  remember_me?: unknown;
  response?: unknown;
  username?: unknown;
}

interface PasskeyRegistrationVerifyBody {
  response?: unknown;
}

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

function buildClearedCookies(): string[] {
  return [
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
  ];
}

function sendAuthError(res: Response, req: Request, error: unknown): Response {
  const authError = error as Partial<AuthServiceError> & { message?: string };
  res.setHeader('Cache-Control', 'no-store');
  return res.status(authError.status || 500).json({
    ok: false,
    error_code: authError.errorCode || 'BERSN_API_INTERNAL_ERROR',
    message: authError.message || 'Internal server error.',
    details: authError.details || { request_id: req.requestId || 'unknown' },
  });
}

export async function login(req: Request, res: Response): Promise<Response> {
  const body = (req.body || {}) as LoginBody;
  const username = body.username;
  const password = body.password;
  const rememberMe = body.remember_me ?? false;

  if (
    typeof username !== 'string'
    || username.trim().length === 0
    || typeof password !== 'string'
    || password.length === 0
    || typeof rememberMe !== 'boolean'
  ) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'username, password, and remember_me must be valid inputs.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  try {
    const authState = await loginUser(req, { username, password, rememberMe });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', [
      buildAccessCookie(authState.accessToken, authState.accessTokenExpiresAt),
      buildRefreshCookie(authState.refreshToken, authState.refreshTokenExpiresAt),
    ]);
    return res.status(200).json({
      ok: true,
      user: authState.user,
      must_change_password: authState.user.is_first_login,
    });
  } catch (error) {
    return sendAuthError(res, req, error);
  }
}

export async function refresh(req: Request, res: Response): Promise<Response> {
  const cookies = parseCookies(req.headers.cookie);

  try {
    const authState = await refreshUserSession(req, cookies[authConfig.refreshCookieName]);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', [
      buildAccessCookie(authState.accessToken, authState.accessTokenExpiresAt),
      buildRefreshCookie(authState.refreshToken, authState.refreshTokenExpiresAt),
    ]);
    return res.status(200).json({
      ok: true,
      user: authState.user,
      must_change_password: authState.user.is_first_login,
    });
  } catch (error) {
    const authError = error as Partial<AuthServiceError>;
    if ((authError.status || 500) === 401) {
      res.setHeader('Set-Cookie', buildClearedCookies());
    }
    return sendAuthError(res, req, error);
  }
}

export async function logout(req: Request, res: Response): Promise<Response> {
  const cookies = parseCookies(req.headers.cookie);

  try {
    await logoutUser(
      req,
      cookies[authConfig.refreshCookieName],
      cookies[authConfig.accessCookieName],
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', buildClearedCookies());
    return res.status(200).json({ ok: true });
  } catch (error) {
    res.setHeader('Set-Cookie', buildClearedCookies());
    return sendAuthError(res, req, error);
  }
}

export async function getMe(req: Request, res: Response): Promise<Response> {
  if (req.auth?.user) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      user: req.auth.user,
    });
  }

  const cookies = parseCookies(req.headers.cookie);
  try {
    const authState = await getAuthenticatedUser(req, cookies[authConfig.accessCookieName]);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      user: authState.user,
    });
  } catch (error) {
    const authError = error as Partial<AuthServiceError>;
    if ((authError.status || 500) === 401) {
      res.setHeader('Set-Cookie', buildClearedCookies());
    }
    return sendAuthError(res, req, error);
  }
}

export async function changePassword(req: Request, res: Response): Promise<Response> {
  const body = (req.body || {}) as ChangePasswordBody;
  const currentPassword = body.current_password;
  const newPassword = body.new_password;

  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      error_code: 'BERSN_AUTH_TOKEN_INVALID',
      message: 'Authentication required.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'current_password and new_password must be valid strings.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  try {
    const result = await changeUserPassword(req, req.auth, currentPassword, newPassword);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', buildClearedCookies());
    return res.status(200).json({
      ok: true,
      user: result.user,
      message: 'Password updated successfully. Please sign in again.',
    });
  } catch (error) {
    return sendAuthError(res, req, error);
  }
}

export async function createAdminUser(req: Request, res: Response): Promise<Response> {
  const body = (req.body || {}) as AdminCreateUserBody;
  const username = body.username;
  const password = body.password;
  const role = body.role ?? 'VENDOR_USER';

  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      error_code: 'BERSN_AUTH_TOKEN_INVALID',
      message: 'Authentication required.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  if (
    typeof username !== 'string'
    || typeof password !== 'string'
    || (role !== undefined && typeof role !== 'string')
  ) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'username, password, and role must be valid strings.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  try {
    const result = await createUserAsAdmin(req, req.auth, { username, password, role });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      ok: true,
      user: result.user,
      must_change_password: result.user.is_first_login,
    });
  } catch (error) {
    return sendAuthError(res, req, error);
  }
}

export async function getPasskeyRegisterOptions(req: Request, res: Response): Promise<Response> {
  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      error_code: 'BERSN_AUTH_TOKEN_INVALID',
      message: 'Authentication required.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  try {
    const options = await getPasskeyRegistrationOptions(req, req.auth);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, options });
  } catch (error) {
    return sendAuthError(res, req, error);
  }
}

export async function verifyPasskeyRegister(req: Request, res: Response): Promise<Response> {
  const body = (req.body || {}) as PasskeyRegistrationVerifyBody;

  if (!req.auth) {
    return res.status(401).json({
      ok: false,
      error_code: 'BERSN_AUTH_TOKEN_INVALID',
      message: 'Authentication required.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  if (!body.response || typeof body.response !== 'object') {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'response must be a valid object.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  try {
    const result = await verifyPasskeyRegistration(req, req.auth, body.response);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      ok: true,
      credential_id: result.credentialId,
    });
  } catch (error) {
    return sendAuthError(res, req, error);
  }
}

export async function getPasskeyLoginOptions(req: Request, res: Response): Promise<Response> {
  const body = (req.body || {}) as PasskeyAuthenticationOptionsBody;

  if (typeof body.username !== 'string' || body.username.trim().length === 0) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'username must be a valid string.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  try {
    const options = await getPasskeyAuthenticationOptions(req, body.username);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, options });
  } catch (error) {
    return sendAuthError(res, req, error);
  }
}

export async function verifyPasskeyLogin(req: Request, res: Response): Promise<Response> {
  const body = (req.body || {}) as PasskeyAuthenticationVerifyBody;
  const username = body.username;
  const response = body.response;
  const rememberMe = body.remember_me ?? false;

  if (
    typeof username !== 'string'
    || username.trim().length === 0
    || !response
    || typeof response !== 'object'
    || typeof rememberMe !== 'boolean'
  ) {
    return res.status(400).json({
      ok: false,
      error_code: 'BERSN_API_VALIDATION_ERROR',
      message: 'username, response, and remember_me must be valid inputs.',
      details: { request_id: req.requestId || 'unknown' },
    });
  }

  try {
    const authState = await verifyPasskeyAuthentication(req, username, response, rememberMe);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Set-Cookie', [
      buildAccessCookie(authState.accessToken, authState.accessTokenExpiresAt),
      buildRefreshCookie(authState.refreshToken, authState.refreshTokenExpiresAt),
    ]);
    return res.status(200).json({
      ok: true,
      user: authState.user,
      must_change_password: authState.user.is_first_login,
    });
  } catch (error) {
    return sendAuthError(res, req, error);
  }
}
