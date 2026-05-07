import crypto from 'crypto';
import type { Request } from 'express';
import argon2 from 'argon2';

import { authConfig } from '../config/authConfig.js';
import type { JwtAccessTokenClaims, PublicUser } from '../types/auth.js';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
};

const dummyPasswordHashPromise = argon2.hash('BERSn_dummy_password_for_timing_only', ARGON2_OPTIONS);
const privateKey = crypto.createPrivateKey(authConfig.privateKeyPem);
const publicKey = crypto.createPublicKey(authConfig.publicKeyPem);

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getHeaderValue(req: Request, headerName: string): string | undefined {
  const rawValue = req.headers[headerName];
  if (Array.isArray(rawValue)) {
    return rawValue[0];
  }
  return rawValue;
}

function isJwtAccessTokenClaims(payload: unknown): payload is JwtAccessTokenClaims {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Partial<JwtAccessTokenClaims>;
  return (
    typeof candidate.iss === 'string'
    && typeof candidate.aud === 'string'
    && typeof candidate.sub === 'string'
    && typeof candidate.sid === 'string'
    && typeof candidate.role === 'string'
    && typeof candidate.username === 'string'
    && typeof candidate.first_login === 'boolean'
    && candidate.type === 'access'
    && typeof candidate.iat === 'number'
    && typeof candidate.exp === 'number'
  );
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export async function getDummyPasswordHash(): Promise<string> {
  return dummyPasswordHashPromise;
}

export function issueAccessToken(user: PublicUser, sessionId: string): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: JwtAccessTokenClaims = {
    iss: authConfig.jwtIssuer,
    aud: authConfig.jwtAudience,
    sub: user.id,
    sid: sessionId,
    role: user.role,
    username: user.username,
    first_login: Boolean(user.is_first_login),
    type: 'access',
    iat: nowSeconds,
    exp: nowSeconds + authConfig.accessTokenTtlSeconds,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput, 'utf8'), privateKey);
  return `${signingInput}.${signature.toString('base64url')}`;
}

export function verifyAccessToken(token: string): JwtAccessTokenClaims {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing token');
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Malformed token');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = Buffer.from(encodedSignature, 'base64url');
  const verified = crypto.verify('RSA-SHA256', Buffer.from(signingInput, 'utf8'), publicKey, signature);
  if (!verified) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as unknown;
  if (!isJwtAccessTokenClaims(payload)) {
    throw new Error('Invalid token claims');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.iss !== authConfig.jwtIssuer || payload.aud !== authConfig.jwtAudience) {
    throw new Error('Invalid token audience or issuer');
  }
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  if (payload.exp <= nowSeconds) {
    throw new Error('Expired token');
  }

  return payload;
}

export function issueRefreshToken(): string {
  return crypto.randomBytes(64).toString('base64url');
}

export function hashRefreshToken(refreshToken: string): string {
  return crypto
    .createHash('sha256')
    .update(authConfig.refreshTokenPepper, 'utf8')
    .update(':', 'utf8')
    .update(refreshToken, 'utf8')
    .digest('hex');
}

export function buildDeviceFingerprintHash(req: Request): string {
  const fingerprintSource = [
    getHeaderValue(req, 'x-device-fingerprint'),
    getHeaderValue(req, 'user-agent'),
    getHeaderValue(req, 'accept-language'),
    getHeaderValue(req, 'sec-ch-ua'),
    getHeaderValue(req, 'sec-ch-ua-platform'),
  ]
    .filter((value): value is string => Boolean(value))
    .join('|');

  return crypto.createHash('sha256').update(fingerprintSource || 'unknown-device', 'utf8').digest('hex');
}
