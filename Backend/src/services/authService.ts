import crypto from 'crypto';
import type { Request } from 'express';
import type { PoolClient } from 'pg';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

import pool from '../db.js';
import { authConfig } from '../config/authConfig.js';
import {
  createUser,
  clearAccountLockout,
  findActiveSessionById,
  findActiveSessionByRefreshTokenHash,
  findActiveWebAuthnCredentialByCredentialId,
  findActiveWebAuthnCredentialsByUserId,
  findUserById,
  findUserByUsername,
  getAccountLockout,
  insertAuditLog,
  insertLoginAttempt,
  insertSession,
  insertWebAuthnCredential,
  revokeActiveSessionsByUserId,
  revokeSession,
  touchSession,
  updateSessionRefreshToken,
  updateUserPassword,
  updateWebAuthnCredentialUsage,
  upsertAccountLockout,
} from '../models/authModel.js';
import type {
  AccountLockoutRow,
  AdminCreateUserResult,
  AuthErrorDetails,
  AuthenticatedRequestState,
  JsonObject,
  LoginAuthState,
  PasswordChangeResult,
  PasskeyRegistrationResult,
  PublicUser,
  RefreshAuthState,
  RequestContext,
  SessionRow,
  TimestampValue,
  UserRow,
  WebAuthnCredentialRow,
} from '../types/auth.js';
import {
  buildDeviceFingerprintHash,
  getDummyPasswordHash,
  hashPassword,
  hashRefreshToken,
  issueAccessToken,
  issueRefreshToken,
  verifyAccessToken,
  verifyPassword,
} from './authCrypto.js';
import {
  clearWebAuthnChallenge,
  consumeLoginRateLimit,
  getRefreshSession,
  getWebAuthnChallenge,
  revokeRefreshSession,
  storeRefreshSession,
  storeWebAuthnChallenge,
} from './authRedis.js';
import { validatePasswordStrength } from './passwordPolicy.js';
import { isAdminRole, normalizeUserRole, validateUserRole, validateUsername } from './userPolicy.js';

interface LoginUserArgs {
  password: string;
  rememberMe?: boolean;
  username: string;
}

interface AdminCreateUserArgs {
  password: string;
  role?: string;
  username: string;
}

function getHeaderValue(req: Request, headerName: string): string | undefined {
  const rawValue = req.headers[headerName];
  if (Array.isArray(rawValue)) {
    return rawValue[0];
  }
  return rawValue;
}

function toDate(value: TimestampValue): Date {
  return value instanceof Date ? value : new Date(value);
}

export class AuthServiceError extends Error {
  details?: JsonObject;
  errorCode: string;
  status: number;

  constructor(status: number, errorCode: string, message: string, details?: JsonObject) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

function normalizeUsername(username: string): string {
  return String(username || '').trim().toLowerCase();
}

function buildPublicUser(
  user: Pick<PublicUser, 'id' | 'is_first_login' | 'role' | 'username'>
    & { organization?: string | null; organization_id?: string | null },
): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    is_first_login: Boolean(user.is_first_login),
    organization: user.organization ?? null,
    organization_id: user.organization_id ?? null,
  };
}

function getIpAddress(req: Request): string {
  if (Array.isArray(req.ips) && req.ips.length > 0) {
    return req.ips[0]?.replace(/^::ffff:/, '') || 'unknown';
  }
  const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
  return String(rawIp).replace(/^::ffff:/, '');
}

function buildRequestContext(req: Request): RequestContext {
  return {
    requestId: req.requestId || 'unknown',
    ipAddress: getIpAddress(req),
    userAgent: getHeaderValue(req, 'user-agent') || '',
    deviceFingerprintHash: buildDeviceFingerprintHash(req),
  };
}

function buildAuditLogBase(context: RequestContext) {
  return {
    id: crypto.randomUUID(),
    request_id: context.requestId,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    session_id: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getAccessTokenExpiryDate(): Date {
  return new Date(Date.now() + authConfig.accessTokenTtlSeconds * 1000);
}

function getRefreshTokenExpiryDate(rememberMe: boolean): Date {
  const ttlSeconds = rememberMe
    ? authConfig.rememberMeRefreshTokenTtlSeconds
    : authConfig.refreshTokenTtlSeconds;
  return new Date(Date.now() + ttlSeconds * 1000);
}

function getRetryAfterSeconds(lockedUntil: TimestampValue | null): number {
  if (!lockedUntil) {
    return authConfig.lockoutDurationSeconds;
  }
  const remainingSeconds = Math.ceil((toDate(lockedUntil).getTime() - Date.now()) / 1000);
  return Math.max(1, remainingSeconds);
}

function normalizeTransportList(transports: string[] | null | undefined): AuthenticatorTransportFuture[] {
  if (!Array.isArray(transports)) {
    return [];
  }

  return transports.filter((transport): transport is AuthenticatorTransportFuture => typeof transport === 'string');
}

function toWebAuthnCredential(credential: WebAuthnCredentialRow): WebAuthnCredential {
  return {
    id: credential.credential_id,
    publicKey: isoBase64URL.toBuffer(credential.public_key),
    counter: Number(credential.counter || 0),
    transports: normalizeTransportList(credential.transports),
  };
}

async function issueAuthenticatedSession(
  client: PoolClient,
  user: Pick<PublicUser, 'id' | 'is_first_login' | 'role' | 'username'>,
  context: RequestContext,
  rememberMe: boolean,
  auditEventType: string,
  auditDetails: JsonObject,
): Promise<{ authState: LoginAuthState; refreshTokenHash: string }> {
  const sessionId = crypto.randomUUID();
  const refreshToken = issueRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshExpiresAt = getRefreshTokenExpiryDate(Boolean(rememberMe));

  await insertSession(client, {
    id: sessionId,
    user_id: user.id,
    refresh_token_hash: refreshTokenHash,
    device_fingerprint_hash: context.deviceFingerprintHash,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    expires_at: refreshExpiresAt,
  });

  await clearAccountLockout(client, user.username, context.ipAddress);

  await insertLoginAttempt(client, {
    id: crypto.randomUUID(),
    username: user.username,
    user_id: user.id,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    request_id: context.requestId,
    success: true,
    failure_reason: null,
  });

  await insertAuditLog(client, {
    ...buildAuditLogBase(context),
    event_type: auditEventType,
    actor_user_id: user.id,
    target_user_id: user.id,
    session_id: sessionId,
    details_json: auditDetails,
  });

  await storeRefreshSession({
    refreshTokenHash,
    sessionId,
    userId: user.id,
    deviceFingerprintHash: context.deviceFingerprintHash,
    expiresAt: refreshExpiresAt,
  });

  return {
    refreshTokenHash,
    authState: {
      user: buildPublicUser(user),
      sessionId,
      accessToken: issueAccessToken(buildPublicUser(user), sessionId),
      accessTokenExpiresAt: getAccessTokenExpiryDate(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt,
    },
  };
}

async function rollbackQuietly(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    return;
  }
}

async function recordFailedAttempt(
  client: PoolClient,
  username: string,
  user: UserRow | null,
  context: RequestContext,
  reason: string,
  existingLockout: AccountLockoutRow | null = null,
): Promise<AccountLockoutRow | null> {
  const now = new Date();
  const activeLockout = existingLockout?.locked_until && toDate(existingLockout.locked_until) > now
    ? existingLockout
    : null;

  let lockoutRecord = activeLockout;

  if (!activeLockout) {
    const previousFailureDate = existingLockout?.last_failed_at ? toDate(existingLockout.last_failed_at) : null;
    const withinWindow = previousFailureDate
      ? (now.getTime() - previousFailureDate.getTime()) <= authConfig.lockoutWindowSeconds * 1000
      : false;
    const failureCount = withinWindow ? Number(existingLockout?.failure_count || 0) + 1 : 1;
    const lockedUntil = failureCount >= authConfig.lockoutMaxFailures
      ? new Date(now.getTime() + authConfig.lockoutDurationSeconds * 1000)
      : null;

    lockoutRecord = await upsertAccountLockout(client, {
      username,
      user_id: user?.id || null,
      ip_address: context.ipAddress,
      failure_count: failureCount,
      locked_until: lockedUntil,
      last_failed_at: now,
    });
  }

  await insertLoginAttempt(client, {
    id: crypto.randomUUID(),
    username,
    user_id: user?.id || null,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    request_id: context.requestId,
    success: false,
    failure_reason: reason,
  });

  await insertAuditLog(client, {
    ...buildAuditLogBase(context),
    event_type: activeLockout ? 'LOGIN_BLOCKED' : 'LOGIN_FAILED',
    actor_user_id: user?.id || null,
    target_user_id: user?.id || null,
    details_json: {
      username,
      reason,
      failure_count: Number(lockoutRecord?.failure_count || 0),
      locked_until: lockoutRecord?.locked_until || null,
    },
  });

  if (lockoutRecord?.locked_until && toDate(lockoutRecord.locked_until) > now) {
    await insertAuditLog(client, {
      ...buildAuditLogBase(context),
      event_type: 'ACCOUNT_LOCKED',
      actor_user_id: user?.id || null,
      target_user_id: user?.id || null,
      details_json: {
        username,
        locked_until: lockoutRecord.locked_until,
        failure_count: Number(lockoutRecord.failure_count || 0),
      },
    });
  }

  return lockoutRecord;
}

async function recordFailedPasskeyAttempt(
  client: PoolClient,
  username: string,
  user: UserRow | null,
  context: RequestContext,
  reason: string,
): Promise<void> {
  await insertLoginAttempt(client, {
    id: crypto.randomUUID(),
    username,
    user_id: user?.id || null,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
    request_id: context.requestId,
    success: false,
    failure_reason: reason,
  });

  await insertAuditLog(client, {
    ...buildAuditLogBase(context),
    event_type: 'PASSKEY_LOGIN_FAILED',
    actor_user_id: user?.id || null,
    target_user_id: user?.id || null,
    details_json: {
      username,
      reason,
    },
  });
}

function buildInternalErrorDetails(context: RequestContext): AuthErrorDetails {
  return { request_id: context.requestId };
}

function getWebAuthnUserVerificationPreference(): 'preferred' | 'required' {
  return authConfig.webauthnRequireUserVerification ? 'required' : 'preferred';
}

function assertPasswordStrength(password: string, username: string, context: RequestContext): void {
  const passwordErrors = validatePasswordStrength(password, username);
  if (passwordErrors.length > 0) {
    throw new AuthServiceError(
      400,
      'BERSN_AUTH_PASSWORD_WEAK',
      'Password does not meet the security policy.',
      {
        request_id: context.requestId,
        password_requirements: passwordErrors,
      },
    );
  }
}

function assertValidUsername(username: string, context: RequestContext): string {
  const normalizedUsername = normalizeUsername(username);
  const usernameErrors = validateUsername(normalizedUsername);
  if (usernameErrors.length > 0) {
    throw new AuthServiceError(
      400,
      'BERSN_AUTH_USERNAME_INVALID',
      'Username does not meet the security policy.',
      {
        request_id: context.requestId,
        username_requirements: usernameErrors,
      },
    );
  }
  return normalizedUsername;
}

function assertAllowedUserRole(role: string | undefined, context: RequestContext): string {
  const normalizedRole = normalizeUserRole(role);
  const roleErrors = validateUserRole(normalizedRole);
  if (roleErrors.length > 0) {
    throw new AuthServiceError(
      400,
      'BERSN_AUTH_ROLE_INVALID',
      'Role does not meet the security policy.',
      {
        request_id: context.requestId,
        role_requirements: roleErrors,
      },
    );
  }
  return normalizedRole;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: string }).code === '23505',
  );
}

export async function loginUser(req: Request, { username, password, rememberMe = false }: LoginUserArgs): Promise<LoginAuthState> {
  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = String(password || '');
  const context = buildRequestContext(req);

  const rateLimit = await consumeLoginRateLimit(context.ipAddress);
  if (!rateLimit.allowed) {
    throw new AuthServiceError(
      429,
      'BERSN_AUTH_RATE_LIMITED',
      'Too many login attempts. Please try again later.',
      {
        request_id: context.requestId,
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
    );
  }

  const client = await pool.connect();
  let refreshTokenHash: string | null = null;

  try {
    await client.query('BEGIN');

    const user = await findUserByUsername(client, normalizedUsername);
    const passwordHash = user?.password_hash || await getDummyPasswordHash();
    const passwordValid = await verifyPassword(passwordHash, normalizedPassword);
    const existingLockout = await getAccountLockout(client, normalizedUsername, context.ipAddress);
    const isLocked = Boolean(existingLockout?.locked_until && toDate(existingLockout.locked_until) > new Date());

    if (!user || !user.is_active || !passwordValid || isLocked) {
      const failureReason = isLocked
        ? 'account_locked'
        : user?.is_active === false
          ? 'account_inactive'
          : 'invalid_credentials';
      const lockoutRecord = await recordFailedAttempt(client, normalizedUsername, user, context, failureReason, existingLockout);
      await client.query('COMMIT');

      if (lockoutRecord?.locked_until && toDate(lockoutRecord.locked_until) > new Date()) {
        throw new AuthServiceError(
          423,
          'BERSN_AUTH_ACCOUNT_LOCKED',
          'Account temporarily locked due to repeated failed sign-in attempts.',
          {
            request_id: context.requestId,
            retry_after_seconds: getRetryAfterSeconds(lockoutRecord.locked_until),
          },
        );
      }

      throw new AuthServiceError(
        401,
        'BERSN_AUTH_INVALID_CREDENTIALS',
        'Invalid username or password.',
        { request_id: context.requestId },
      );
    }

    const issuedSession = await issueAuthenticatedSession(
      client,
      user,
      context,
      Boolean(rememberMe),
      'LOGIN',
      { remember_me: Boolean(rememberMe) },
    );
    refreshTokenHash = issuedSession.refreshTokenHash;

    await client.query('COMMIT');

    return issuedSession.authState;
  } catch (error) {
    await rollbackQuietly(client);
    if (refreshTokenHash) {
      await revokeRefreshSession(refreshTokenHash).catch(() => {});
    }
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      buildInternalErrorDetails(context),
    );
  } finally {
    client.release();
  }
}

export async function createUserAsAdmin(
  req: Request,
  authState: AuthenticatedRequestState,
  { username, password, role }: AdminCreateUserArgs,
): Promise<AdminCreateUserResult> {
  const context = buildRequestContext(req);

  if (!isAdminRole(authState.user.role)) {
    throw new AuthServiceError(
      403,
      'BERSN_AUTH_FORBIDDEN',
      'Administrator privileges are required for this action.',
      { request_id: context.requestId },
    );
  }

  const normalizedUsername = assertValidUsername(username, context);
  const normalizedPassword = String(password || '');
  const normalizedRole = assertAllowedUserRole(role, context);

  if (!normalizedPassword) {
    throw new AuthServiceError(
      400,
      'BERSN_API_VALIDATION_ERROR',
      'password is required.',
      { request_id: context.requestId },
    );
  }

  assertPasswordStrength(normalizedPassword, normalizedUsername, context);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingUser = await findUserByUsername(client, normalizedUsername);
    if (existingUser) {
      throw new AuthServiceError(
        409,
        'BERSN_AUTH_USER_EXISTS',
        'A user with that username already exists.',
        { request_id: context.requestId },
      );
    }

    const passwordHash = await hashPassword(normalizedPassword);
    const createdUser = await createUser(client, {
      id: crypto.randomUUID(),
      username: normalizedUsername,
      password_hash: passwordHash,
      role: normalizedRole,
      is_active: true,
      is_first_login: true,
    });

    await insertAuditLog(client, {
      ...buildAuditLogBase(context),
      event_type: 'ACCOUNT_CREATED',
      actor_user_id: authState.user.id,
      target_user_id: createdUser?.id || null,
      session_id: authState.sessionId,
      details_json: {
        username: normalizedUsername,
        role: normalizedRole,
        requires_password_change: true,
      },
    });

    await client.query('COMMIT');

    if (!createdUser) {
      throw new AuthServiceError(
        500,
        'BERSN_API_INTERNAL_ERROR',
        'Internal server error.',
        { request_id: context.requestId },
      );
    }

    return {
      user: buildPublicUser(createdUser),
    };
  } catch (error) {
    await rollbackQuietly(client);
    if (error instanceof AuthServiceError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new AuthServiceError(
        409,
        'BERSN_AUTH_USER_EXISTS',
        'A user with that username already exists.',
        { request_id: context.requestId },
      );
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: context.requestId },
    );
  } finally {
    client.release();
  }
}

export async function getPasskeyRegistrationOptions(
  req: Request,
  authState: AuthenticatedRequestState,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const user = buildPublicUser(authState.user);
  const client = await pool.connect();
  try {
    const userRecord = await findUserById(client, user.id);
    if (!userRecord || !userRecord.is_active) {
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_TOKEN_INVALID',
        'Authentication required.',
        { request_id: req.requestId || 'unknown' },
      );
    }

    const credentials = await findActiveWebAuthnCredentialsByUserId(client, user.id);
    const options = await generateRegistrationOptions({
      rpName: authConfig.webauthnRpName,
      rpID: authConfig.webauthnRpId,
      userName: user.username,
      userID: Buffer.from(user.id, 'utf8'),
      userDisplayName: user.username,
      timeout: authConfig.webauthnTimeoutMs,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: getWebAuthnUserVerificationPreference(),
      },
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        transports: normalizeTransportList(credential.transports),
      })),
    });

    await storeWebAuthnChallenge(
      {
        purpose: 'registration',
        challenge: options.challenge,
        userId: user.id,
        username: user.username,
      },
      user.id,
    );

    return options;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: req.requestId || 'unknown' },
    );
  } finally {
    client.release();
  }
}

export async function verifyPasskeyRegistration(
  req: Request,
  authState: AuthenticatedRequestState,
  response: unknown,
): Promise<PasskeyRegistrationResult> {
  const context = buildRequestContext(req);
  const storedChallenge = await getWebAuthnChallenge('registration', authState.user.id);
  if (!storedChallenge) {
    throw new AuthServiceError(
      400,
      'BERSN_AUTH_PASSKEY_CHALLENGE_INVALID',
      'Passkey registration session expired. Please try again.',
      { request_id: context.requestId },
    );
  }

  if (!isRecord(response) || typeof response.id !== 'string') {
    await clearWebAuthnChallenge('registration', authState.user.id).catch(() => {});
    throw new AuthServiceError(
      400,
      'BERSN_API_VALIDATION_ERROR',
      'Passkey registration response is invalid.',
      { request_id: context.requestId },
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const registrationResponse = response as unknown as RegistrationResponseJSON;

    const user = await findUserById(client, authState.user.id);
    if (!user || !user.is_active) {
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_TOKEN_INVALID',
        'Authentication required.',
        { request_id: context.requestId },
      );
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: authConfig.webauthnOrigins,
      expectedRPID: authConfig.webauthnRpId,
      requireUserVerification: authConfig.webauthnRequireUserVerification,
    });

    if (!verification.verified || !verification.registrationInfo) {
      await insertAuditLog(client, {
        ...buildAuditLogBase(context),
        event_type: 'PASSKEY_REGISTRATION_FAILED',
        actor_user_id: user.id,
        target_user_id: user.id,
        session_id: authState.sessionId,
        details_json: {
          username: user.username,
          reason: 'verification_failed',
        },
      });
      await client.query('COMMIT');
      throw new AuthServiceError(
        400,
        'BERSN_AUTH_PASSKEY_REGISTRATION_FAILED',
        'Passkey registration could not be verified.',
        { request_id: context.requestId },
      );
    }

    const registrationInfo = verification.registrationInfo;
    const existingCredential = await findActiveWebAuthnCredentialByCredentialId(
      client,
      registrationInfo.credential.id,
    );
    if (existingCredential) {
      throw new AuthServiceError(
        409,
        'BERSN_AUTH_PASSKEY_EXISTS',
        'This passkey is already registered.',
        { request_id: context.requestId },
      );
    }

    const credential = await insertWebAuthnCredential(client, {
      id: crypto.randomUUID(),
      user_id: user.id,
      credential_id: registrationInfo.credential.id,
      public_key: isoBase64URL.fromBuffer(registrationInfo.credential.publicKey),
      counter: registrationInfo.credential.counter,
      transports: normalizeTransportList(
        Array.isArray(registrationResponse.response?.transports)
          ? (registrationResponse.response?.transports as string[])
          : [],
      ),
      device_type: registrationInfo.credentialDeviceType,
      backed_up: registrationInfo.credentialBackedUp,
    });

    await insertAuditLog(client, {
      ...buildAuditLogBase(context),
      event_type: 'PASSKEY_REGISTERED',
      actor_user_id: user.id,
      target_user_id: user.id,
      session_id: authState.sessionId,
      details_json: {
        username: user.username,
        credential_id: credential?.credential_id || registrationInfo.credential.id,
        device_type: registrationInfo.credentialDeviceType,
        backed_up: registrationInfo.credentialBackedUp,
      },
    });

    await client.query('COMMIT');

    return {
      credentialId: credential?.credential_id || registrationInfo.credential.id,
    };
  } catch (error) {
    await rollbackQuietly(client);
    if (error instanceof AuthServiceError) {
      throw error;
    }
    if (error instanceof Error && /user could not be verified/i.test(error.message)) {
      throw new AuthServiceError(
        400,
        'BERSN_AUTH_PASSKEY_VERIFICATION_REQUIRED',
        'This authenticator could not complete verified passkey registration for the current environment.',
        { request_id: context.requestId },
      );
    }
    console.error('[auth] verifyPasskeyRegistration failed', {
      request_id: context.requestId,
      user_id: authState.user.id,
      session_id: authState.sessionId,
      error,
    });
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: context.requestId },
    );
  } finally {
    client.release();
    await clearWebAuthnChallenge('registration', authState.user.id).catch(() => {});
  }
}

export async function getPasskeyAuthenticationOptions(
  req: Request,
  username: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const context = buildRequestContext(req);
  const normalizedUsername = assertValidUsername(username, context);
  const client = await pool.connect();

  try {
    const user = await findUserByUsername(client, normalizedUsername);
    if (!user || !user.is_active) {
      throw new AuthServiceError(
        400,
        'BERSN_AUTH_PASSKEY_UNAVAILABLE',
        'Passkey sign-in is not available for that account.',
        { request_id: context.requestId },
      );
    }

    const credentials = await findActiveWebAuthnCredentialsByUserId(client, user.id);
    if (credentials.length === 0) {
      throw new AuthServiceError(
        400,
        'BERSN_AUTH_PASSKEY_UNAVAILABLE',
        'Passkey sign-in is not available for that account.',
        { request_id: context.requestId },
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: authConfig.webauthnRpId,
      timeout: authConfig.webauthnTimeoutMs,
      userVerification: getWebAuthnUserVerificationPreference(),
      allowCredentials: credentials.map((credential) => ({
        id: credential.credential_id,
        transports: normalizeTransportList(credential.transports),
      })),
    });

    await storeWebAuthnChallenge(
      {
        purpose: 'authentication',
        challenge: options.challenge,
        userId: user.id,
        username: normalizedUsername,
      },
      normalizedUsername,
    );

    return options;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: context.requestId },
    );
  } finally {
    client.release();
  }
}

export async function verifyPasskeyAuthentication(
  req: Request,
  username: string,
  response: unknown,
  rememberMe = false,
): Promise<LoginAuthState> {
  const context = buildRequestContext(req);
  const normalizedUsername = assertValidUsername(username, context);

  const rateLimit = await consumeLoginRateLimit(context.ipAddress);
  if (!rateLimit.allowed) {
    throw new AuthServiceError(
      429,
      'BERSN_AUTH_RATE_LIMITED',
      'Too many login attempts. Please try again later.',
      {
        request_id: context.requestId,
        retry_after_seconds: rateLimit.retryAfterSeconds,
      },
    );
  }

  const storedChallenge = await getWebAuthnChallenge('authentication', normalizedUsername);
  if (!storedChallenge) {
    throw new AuthServiceError(
      401,
      'BERSN_AUTH_PASSKEY_INVALID',
      'Passkey sign-in could not be verified.',
      { request_id: context.requestId },
    );
  }

  if (!isRecord(response) || typeof response.id !== 'string') {
    await clearWebAuthnChallenge('authentication', normalizedUsername).catch(() => {});
    throw new AuthServiceError(
      400,
      'BERSN_API_VALIDATION_ERROR',
      'Passkey authentication response is invalid.',
      { request_id: context.requestId },
    );
  }

  const client = await pool.connect();
  let refreshTokenHash: string | null = null;
  try {
    await client.query('BEGIN');
    const authenticationResponse = response as unknown as AuthenticationResponseJSON;

    const user = await findUserByUsername(client, normalizedUsername);
    const credential = await findActiveWebAuthnCredentialByCredentialId(client, String(response.id));
    const validCredential = Boolean(
      user
      && user.is_active
      && credential
      && credential.user_id === user.id
      && storedChallenge.userId === user.id,
    );

    if (!validCredential || !user || !credential) {
      await recordFailedPasskeyAttempt(client, normalizedUsername, user, context, 'invalid_passkey');
      await client.query('COMMIT');
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_PASSKEY_INVALID',
        'Passkey sign-in could not be verified.',
        { request_id: context.requestId },
      );
    }

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: authConfig.webauthnOrigins,
      expectedRPID: authConfig.webauthnRpId,
      credential: toWebAuthnCredential(credential),
      requireUserVerification: authConfig.webauthnRequireUserVerification,
    });

    if (!verification.verified) {
      await recordFailedPasskeyAttempt(client, normalizedUsername, user, context, 'verification_failed');
      await client.query('COMMIT');
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_PASSKEY_INVALID',
        'Passkey sign-in could not be verified.',
        { request_id: context.requestId },
      );
    }

    await updateWebAuthnCredentialUsage(
      client,
      credential.credential_id,
      verification.authenticationInfo.newCounter,
      verification.authenticationInfo.credentialBackedUp,
    );

    const issuedSession = await issueAuthenticatedSession(
      client,
      user,
      context,
      Boolean(rememberMe),
      'PASSKEY_LOGIN',
      {
        username: user.username,
        credential_id: credential.credential_id,
        remember_me: Boolean(rememberMe),
      },
    );
    refreshTokenHash = issuedSession.refreshTokenHash;

    await client.query('COMMIT');
    return issuedSession.authState;
  } catch (error) {
    await rollbackQuietly(client);
    if (refreshTokenHash) {
      await revokeRefreshSession(refreshTokenHash).catch(() => {});
    }
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: context.requestId },
    );
  } finally {
    client.release();
    await clearWebAuthnChallenge('authentication', normalizedUsername).catch(() => {});
  }
}

export async function refreshUserSession(req: Request, refreshToken?: string): Promise<RefreshAuthState> {
  const context = buildRequestContext(req);
  if (!refreshToken) {
    throw new AuthServiceError(
      401,
      'BERSN_AUTH_INVALID_SESSION',
      'Refresh token is missing or invalid.',
      { request_id: context.requestId },
    );
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  const cachedSession = await getRefreshSession(refreshTokenHash);
  if (!cachedSession) {
    throw new AuthServiceError(
      401,
      'BERSN_AUTH_INVALID_SESSION',
      'Refresh token is missing or invalid.',
      { request_id: context.requestId },
    );
  }

  const client = await pool.connect();
  let newRefreshTokenHash: string | null = null;
  try {
    await client.query('BEGIN');
    const session = await findActiveSessionByRefreshTokenHash(client, refreshTokenHash);
    if (!session) {
      await revokeRefreshSession(refreshTokenHash).catch(() => {});
      await client.query('COMMIT');
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_INVALID_SESSION',
        'Refresh token is missing or invalid.',
        { request_id: context.requestId },
      );
    }

    if (
      session.device_fingerprint_hash !== context.deviceFingerprintHash
      || cachedSession.deviceFingerprintHash !== context.deviceFingerprintHash
    ) {
      await revokeSession(client, session.session_id, 'fingerprint_mismatch');
      await insertAuditLog(client, {
        ...buildAuditLogBase(context),
        event_type: 'SESSION_FINGERPRINT_MISMATCH',
        actor_user_id: session.user_id,
        target_user_id: session.user_id,
        session_id: session.session_id,
        details_json: {
          username: session.username,
        },
      });
      await client.query('COMMIT');
      await revokeRefreshSession(refreshTokenHash).catch(() => {});
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_SESSION_FINGERPRINT_MISMATCH',
        'Session validation failed for this device.',
        { request_id: context.requestId },
      );
    }

    const rotatedRefreshToken = issueRefreshToken();
    newRefreshTokenHash = hashRefreshToken(rotatedRefreshToken);
    const refreshExpiresAt = toDate(session.expires_at);

    await updateSessionRefreshToken(
      client,
      session.session_id,
      newRefreshTokenHash,
      refreshExpiresAt,
      context.ipAddress,
      context.userAgent,
    );
    await insertAuditLog(client, {
      ...buildAuditLogBase(context),
      event_type: 'TOKEN_REFRESH',
      actor_user_id: session.user_id,
      target_user_id: session.user_id,
      session_id: session.session_id,
      details_json: {
        username: session.username,
      },
    });

    await storeRefreshSession({
      refreshTokenHash: newRefreshTokenHash,
      sessionId: session.session_id,
      userId: session.user_id,
      deviceFingerprintHash: context.deviceFingerprintHash,
      expiresAt: refreshExpiresAt,
    });
    await client.query('COMMIT');

    await revokeRefreshSession(refreshTokenHash).catch(() => {});

    return {
      user: buildPublicUser(session),
      sessionId: session.session_id,
      accessToken: issueAccessToken(buildPublicUser(session), session.session_id),
      accessTokenExpiresAt: getAccessTokenExpiryDate(),
      refreshToken: rotatedRefreshToken,
      refreshTokenExpiresAt: refreshExpiresAt,
    };
  } catch (error) {
    await rollbackQuietly(client);
    if (newRefreshTokenHash) {
      await revokeRefreshSession(newRefreshTokenHash).catch(() => {});
    }
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: context.requestId },
    );
  } finally {
    client.release();
  }
}

export async function logoutUser(req: Request, refreshToken?: string, accessToken?: string): Promise<void> {
  const context = buildRequestContext(req);
  const client = await pool.connect();
  let session: SessionRow | null = null;
  let refreshTokenHash: string | null = null;

  try {
    await client.query('BEGIN');

    if (refreshToken) {
      refreshTokenHash = hashRefreshToken(refreshToken);
      session = await findActiveSessionByRefreshTokenHash(client, refreshTokenHash);
    }

    if (!session && accessToken) {
      try {
        const claims = verifyAccessToken(accessToken);
        session = await findActiveSessionById(client, claims.sid);
        refreshTokenHash = session?.refresh_token_hash || null;
      } catch {
        session = null;
      }
    }

    if (session) {
      await revokeSession(client, session.session_id, 'logout');
      await insertAuditLog(client, {
        ...buildAuditLogBase(context),
        event_type: 'LOGOUT',
        actor_user_id: session.user_id,
        target_user_id: session.user_id,
        session_id: session.session_id,
        details_json: {
          username: session.username,
        },
      });
    }

    await client.query('COMMIT');

    if (refreshTokenHash) {
      await revokeRefreshSession(refreshTokenHash).catch(() => {});
    }
  } catch {
    await rollbackQuietly(client);
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: context.requestId },
    );
  } finally {
    client.release();
  }
}

export async function getAuthenticatedUser(req: Request, accessToken?: string): Promise<AuthenticatedRequestState> {
  const context = buildRequestContext(req);
  if (!accessToken) {
    throw new AuthServiceError(
      401,
      'BERSN_AUTH_TOKEN_INVALID',
      'Authentication required.',
      { request_id: context.requestId },
    );
  }

  let claims;
  try {
    claims = verifyAccessToken(accessToken);
  } catch {
    throw new AuthServiceError(
      401,
      'BERSN_AUTH_TOKEN_INVALID',
      'Authentication required.',
      { request_id: context.requestId },
    );
  }

  const client = await pool.connect();
  try {
    const session = await findActiveSessionById(client, claims.sid);
    if (!session || session.user_id !== claims.sub) {
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_INVALID_SESSION',
        'Authentication required.',
        { request_id: context.requestId },
      );
    }

    await touchSession(client, session.session_id, context.ipAddress, context.userAgent);

    return {
      user: buildPublicUser(session),
      sessionId: session.session_id,
    };
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: context.requestId },
    );
  } finally {
    client.release();
  }
}

export async function changeUserPassword(
  req: Request,
  authState: AuthenticatedRequestState,
  currentPassword: string,
  newPassword: string,
): Promise<PasswordChangeResult> {
  const context = buildRequestContext(req);
  const normalizedCurrentPassword = String(currentPassword || '');
  const normalizedNewPassword = String(newPassword || '');

  if (!normalizedCurrentPassword || !normalizedNewPassword) {
    throw new AuthServiceError(
      400,
      'BERSN_API_VALIDATION_ERROR',
      'current_password and new_password are required.',
      { request_id: context.requestId },
    );
  }

  if (normalizedCurrentPassword === normalizedNewPassword) {
    throw new AuthServiceError(
      400,
      'BERSN_AUTH_PASSWORD_REUSE',
      'New password must be different from the current password.',
      { request_id: context.requestId },
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const user = await findUserById(client, authState.user.id);
    if (!user || !user.is_active) {
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_TOKEN_INVALID',
        'Authentication required.',
        { request_id: context.requestId },
      );
    }

    const currentPasswordValid = await verifyPassword(user.password_hash, normalizedCurrentPassword);
    if (!currentPasswordValid) {
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_INVALID_CREDENTIALS',
        'Current password is incorrect.',
        { request_id: context.requestId },
      );
    }

    assertPasswordStrength(normalizedNewPassword, user.username, context);

    const updatedPasswordHash = await hashPassword(normalizedNewPassword);
    const updatedUser = await updateUserPassword(client, user.id, updatedPasswordHash, false);
    const revokedSessions = await revokeActiveSessionsByUserId(client, user.id, 'password_changed');

    await insertAuditLog(client, {
      ...buildAuditLogBase(context),
      event_type: 'PASSWORD_CHANGE',
      actor_user_id: user.id,
      target_user_id: user.id,
      session_id: authState.sessionId,
      details_json: {
        username: user.username,
        revoked_session_count: revokedSessions.length,
      },
    });

    await client.query('COMMIT');

    for (const session of revokedSessions) {
      await revokeRefreshSession(session.refresh_token_hash).catch(() => {});
    }

    return {
      user: buildPublicUser(updatedUser || user),
    };
  } catch (error) {
    await rollbackQuietly(client);
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: context.requestId },
    );
  } finally {
    client.release();
  }
}
