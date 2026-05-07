import crypto from 'crypto';
import { createClient } from 'redis';

import { authConfig } from '../config/authConfig.js';
import type {
  CachedRefreshSession,
  LoginRateLimitResult,
  StoredWebAuthnChallenge,
} from '../types/auth.js';

interface StoreRefreshSessionPayload {
  deviceFingerprintHash: string;
  expiresAt: Date;
  refreshTokenHash: string;
  sessionId: string;
  userId: string;
}

interface StoreWebAuthnChallengePayload {
  challenge: string;
  purpose: 'authentication' | 'registration';
  userId: string;
  username: string;
}

type AuthRedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<AuthRedisClient> | null = null;

function hashKeyPart(rawValue: string): string {
  return crypto.createHash('sha256').update(String(rawValue || 'unknown'), 'utf8').digest('hex');
}

function isCachedRefreshSession(value: unknown): value is CachedRefreshSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CachedRefreshSession>;
  return (
    typeof candidate.sessionId === 'string'
    && typeof candidate.userId === 'string'
    && typeof candidate.deviceFingerprintHash === 'string'
    && typeof candidate.expiresAt === 'string'
  );
}

function isStoredWebAuthnChallenge(value: unknown): value is StoredWebAuthnChallenge {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<StoredWebAuthnChallenge>;
  return (
    typeof candidate.challenge === 'string'
    && typeof candidate.userId === 'string'
    && typeof candidate.username === 'string'
    && typeof candidate.expiresAt === 'string'
  );
}

async function getRedisClient(): Promise<AuthRedisClient> {
  if (!redisClientPromise) {
    const client = createClient({
      url: authConfig.redisUrl,
      socket: {
        connectTimeout: 3000,
      },
    });
    client.on('error', (error: Error) => {
      console.error('[auth][redis]', error.message);
    });
    redisClientPromise = client.connect().then(() => client).catch((error: unknown) => {
      redisClientPromise = null;
      throw error;
    });
  }
  return redisClientPromise;
}

function refreshTokenKey(refreshTokenHash: string): string {
  return `auth:refresh:${refreshTokenHash}`;
}

function loginRateLimitKey(ipAddress: string): string {
  return `auth:login-rate:${hashKeyPart(ipAddress)}`;
}

function webauthnChallengeKey(purpose: 'authentication' | 'registration', subjectKey: string): string {
  return `auth:webauthn:${purpose}:${hashKeyPart(subjectKey)}`;
}

export async function consumeLoginRateLimit(ipAddress: string): Promise<LoginRateLimitResult> {
  const client = await getRedisClient();
  const key = loginRateLimitKey(ipAddress);
  const currentCount = await client.incr(key);
  if (currentCount === 1) {
    await client.expire(key, authConfig.loginRateLimitWindowSeconds);
  }
  const ttl = await client.ttl(key);
  return {
    allowed: currentCount <= authConfig.loginRateLimitMax,
    remaining: Math.max(0, authConfig.loginRateLimitMax - currentCount),
    retryAfterSeconds: ttl > 0 ? ttl : authConfig.loginRateLimitWindowSeconds,
  };
}

export async function storeRefreshSession(payload: StoreRefreshSessionPayload): Promise<void> {
  const client = await getRedisClient();
  const ttlSeconds = Math.max(1, Math.ceil((payload.expiresAt.getTime() - Date.now()) / 1000));
  await client.set(
    refreshTokenKey(payload.refreshTokenHash),
    JSON.stringify({
      sessionId: payload.sessionId,
      userId: payload.userId,
      deviceFingerprintHash: payload.deviceFingerprintHash,
      expiresAt: payload.expiresAt.toISOString(),
    }),
    { EX: ttlSeconds },
  );
}

export async function getRefreshSession(refreshTokenHash: string): Promise<CachedRefreshSession | null> {
  const client = await getRedisClient();
  const cached = await client.get(refreshTokenKey(refreshTokenHash));
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached) as unknown;
    return isCachedRefreshSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function revokeRefreshSession(refreshTokenHash: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(refreshTokenKey(refreshTokenHash));
}

export async function storeWebAuthnChallenge(
  payload: StoreWebAuthnChallengePayload,
  subjectKey: string,
): Promise<void> {
  const client = await getRedisClient();
  const expiresAt = new Date(Date.now() + authConfig.webauthnChallengeTtlSeconds * 1000);
  await client.set(
    webauthnChallengeKey(payload.purpose, subjectKey),
    JSON.stringify({
      challenge: payload.challenge,
      userId: payload.userId,
      username: payload.username,
      expiresAt: expiresAt.toISOString(),
    }),
    { EX: authConfig.webauthnChallengeTtlSeconds },
  );
}

export async function getWebAuthnChallenge(
  purpose: 'authentication' | 'registration',
  subjectKey: string,
): Promise<StoredWebAuthnChallenge | null> {
  const client = await getRedisClient();
  const cached = await client.get(webauthnChallengeKey(purpose, subjectKey));
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached) as unknown;
    return isStoredWebAuthnChallenge(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearWebAuthnChallenge(
  purpose: 'authentication' | 'registration',
  subjectKey: string,
): Promise<void> {
  const client = await getRedisClient();
  await client.del(webauthnChallengeKey(purpose, subjectKey));
}
