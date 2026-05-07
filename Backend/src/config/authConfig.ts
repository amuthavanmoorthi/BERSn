import crypto from 'crypto';

import type { BootstrapAdminConfig, SameSiteValue } from '../types/auth.js';
import {
  DEV_FALLBACK_PRIVATE_KEY_PEM,
  DEV_FALLBACK_PUBLIC_KEY_PEM,
  DEV_FALLBACK_REFRESH_TOKEN_PEPPER,
} from './devAuthFallback.js';

interface AuthConfig {
  accessCookieName: string;
  accessTokenTtlSeconds: number;
  bootstrapAdmin: BootstrapAdminConfig;
  cookieDomain?: string;
  cookieSameSite: SameSiteValue;
  cookieSecure: boolean;
  emailFrom?: string;
  emailLogOnly: boolean;
  jwtAudience: string;
  jwtIssuer: string;
  lockoutDurationSeconds: number;
  lockoutMaxFailures: number;
  lockoutWindowSeconds: number;
  loginRateLimitMax: number;
  loginRateLimitWindowSeconds: number;
  privateKeyPem: string;
  publicKeyPem: string;
  passwordMinLength: number;
  redisUrl: string;
  refreshCookieName: string;
  refreshTokenPepper: string;
  refreshTokenTtlSeconds: number;
  rememberMeRefreshTokenTtlSeconds: number;
  smtpHost?: string;
  smtpPassword?: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser?: string;
  webauthnChallengeTtlSeconds: number;
  webauthnOrigins: string[];
  webauthnRequireUserVerification: boolean;
  webauthnRpId: string;
  webauthnRpName: string;
  webauthnTimeoutMs: number;
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.floor(numeric);
}

function parseBoolean(rawValue: string | undefined, fallback = false): boolean {
  if (rawValue === undefined) {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(rawValue).trim().toLowerCase());
}

function normalizeOptionalString(rawValue: string | undefined): string | undefined {
  const normalized = String(rawValue || '').trim();
  return normalized ? normalized : undefined;
}

function parseStringList(rawValue: string | undefined, fallback: string[]): string[] {
  const values = String(rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length > 0 ? values : fallback;
}

function normalizeSameSite(rawValue: string | undefined): SameSiteValue {
  const normalized = String(rawValue || 'lax').trim().toLowerCase();
  if (normalized === 'strict' || normalized === 'none') {
    return normalized;
  }
  return 'lax';
}

function parsePem(rawValue: string | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  const normalized = String(rawValue).trim();
  if (!normalized) {
    return null;
  }

  if (normalized.includes('BEGIN')) {
    return normalized.replace(/\\n/g, '\n');
  }

  try {
    return Buffer.from(normalized, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

const isProduction = process.env.NODE_ENV === 'production';

const privateKeyPem = parsePem(process.env.AUTH_JWT_PRIVATE_KEY_PEM)
  || (!isProduction ? DEV_FALLBACK_PRIVATE_KEY_PEM : null);
const publicKeyPem = parsePem(process.env.AUTH_JWT_PUBLIC_KEY_PEM)
  || (!isProduction ? DEV_FALLBACK_PUBLIC_KEY_PEM : null);

if (!privateKeyPem || !publicKeyPem) {
  throw new Error('AUTH_JWT_PRIVATE_KEY_PEM and AUTH_JWT_PUBLIC_KEY_PEM must be configured.');
}

const derivedRefreshTokenPepper = isProduction
  ? crypto.createHash('sha256').update(privateKeyPem, 'utf8').digest('hex')
  : DEV_FALLBACK_REFRESH_TOKEN_PEPPER;

if (isProduction && (!process.env.AUTH_JWT_PRIVATE_KEY_PEM || !process.env.AUTH_JWT_PUBLIC_KEY_PEM)) {
  throw new Error('AUTH_JWT_PRIVATE_KEY_PEM and AUTH_JWT_PUBLIC_KEY_PEM must be configured in production.');
}

if (!isProduction && (!process.env.AUTH_JWT_PRIVATE_KEY_PEM || !process.env.AUTH_JWT_PUBLIC_KEY_PEM)) {
  console.warn('[auth] RSA signing keys are not configured. Using stable built-in development keys for local auth sessions.');
}

const bootstrapAdminUsername = normalizeOptionalString(process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME)?.toLowerCase();
const bootstrapAdminPassword = normalizeOptionalString(process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD);
if ((bootstrapAdminUsername && !bootstrapAdminPassword) || (!bootstrapAdminUsername && bootstrapAdminPassword)) {
  throw new Error('AUTH_BOOTSTRAP_ADMIN_USERNAME and AUTH_BOOTSTRAP_ADMIN_PASSWORD must be provided together.');
}

export const authConfig: AuthConfig = {
  accessCookieName: process.env.AUTH_ACCESS_COOKIE_NAME || 'bersn_access_token',
  refreshCookieName: process.env.AUTH_REFRESH_COOKIE_NAME || 'bersn_refresh_token',
  bootstrapAdmin: {
    username: bootstrapAdminUsername,
    password: bootstrapAdminPassword,
    role: normalizeOptionalString(process.env.AUTH_BOOTSTRAP_ADMIN_ROLE) || 'SYS_ADMIN',
    force: parseBoolean(process.env.AUTH_BOOTSTRAP_ADMIN_FORCE, false),
  },
  accessTokenTtlSeconds: parsePositiveInt(process.env.AUTH_ACCESS_TTL_SECONDS, 15 * 60),
  refreshTokenTtlSeconds: parsePositiveInt(process.env.AUTH_REFRESH_TTL_SECONDS, 7 * 24 * 60 * 60),
  rememberMeRefreshTokenTtlSeconds: parsePositiveInt(process.env.AUTH_REMEMBER_ME_REFRESH_TTL_SECONDS, 30 * 24 * 60 * 60),
  loginRateLimitMax: parsePositiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_MAX, 10),
  loginRateLimitWindowSeconds: parsePositiveInt(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS, 15 * 60),
  lockoutMaxFailures: parsePositiveInt(process.env.AUTH_LOCKOUT_MAX_FAILURES, 5),
  lockoutWindowSeconds: parsePositiveInt(process.env.AUTH_LOCKOUT_WINDOW_SECONDS, 15 * 60),
  lockoutDurationSeconds: parsePositiveInt(process.env.AUTH_LOCKOUT_DURATION_SECONDS, 15 * 60),
  jwtIssuer: process.env.AUTH_JWT_ISSUER || 'bersn-backend',
  jwtAudience: process.env.AUTH_JWT_AUDIENCE || 'bersn-frontend',
  privateKeyPem,
  publicKeyPem,
  passwordMinLength: parsePositiveInt(process.env.AUTH_PASSWORD_MIN_LENGTH, 12),
  refreshTokenPepper: process.env.AUTH_REFRESH_TOKEN_PEPPER || derivedRefreshTokenPepper,
  cookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
  cookieSecure: parseBoolean(process.env.AUTH_COOKIE_SECURE, isProduction),
  cookieSameSite: normalizeSameSite(process.env.AUTH_COOKIE_SAME_SITE),
  emailFrom: normalizeOptionalString(process.env.AUTH_EMAIL_FROM) || (!isProduction ? 'BERSn Local <no-reply@localhost>' : undefined),
  emailLogOnly: parseBoolean(process.env.AUTH_EMAIL_LOG_ONLY, !isProduction),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  smtpHost: normalizeOptionalString(process.env.AUTH_SMTP_HOST),
  smtpPort: parsePositiveInt(process.env.AUTH_SMTP_PORT, 587),
  smtpSecure: parseBoolean(process.env.AUTH_SMTP_SECURE, false),
  smtpUser: normalizeOptionalString(process.env.AUTH_SMTP_USER),
  smtpPassword: normalizeOptionalString(process.env.AUTH_SMTP_PASSWORD),
  webauthnRpName: process.env.AUTH_WEBAUTHN_RP_NAME || 'BERSn',
  webauthnRpId: process.env.AUTH_WEBAUTHN_RP_ID || 'localhost',
  webauthnOrigins: parseStringList(process.env.AUTH_WEBAUTHN_ORIGINS, [
    'http://localhost:3000',
    'http://localhost:5173',
  ]),
  webauthnRequireUserVerification: parseBoolean(process.env.AUTH_WEBAUTHN_REQUIRE_USER_VERIFICATION, isProduction),
  webauthnTimeoutMs: parsePositiveInt(process.env.AUTH_WEBAUTHN_TIMEOUT_MS, 60_000),
  webauthnChallengeTtlSeconds: parsePositiveInt(process.env.AUTH_WEBAUTHN_CHALLENGE_TTL_SECONDS, 5 * 60),
};
