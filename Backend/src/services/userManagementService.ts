import crypto from 'crypto';
import type { Request } from 'express';
import type { PoolClient } from 'pg';

import pool from '../db.js';
import {
  createManagedUser,
  deleteUserById,
  findManagedUserById,
  findUserByUsername,
  insertAuditLog,
  listManagedUsers,
  revokeActiveSessionsByUserId,
  softDeleteAndAnonymizeUser,
  updateManagedUserStatus,
} from '../models/authModel.js';
import { findOrCreateOrganizationByName } from '../models/projectModel.js';
import type {
  AuthenticatedRequestState,
  JsonObject,
  TimestampValue,
} from '../types/auth.js';
import type {
  ManagedUserInsertPayload,
  ManagedUserRow,
  ManagedUserSummary,
} from '../types/users.js';
import type { ManagedUserCreateInput } from '../schemas/userManagementSchemas.js';
import { hashPassword } from './authCrypto.js';
import { revokeRefreshSession } from './authRedis.js';
import { AuthServiceError } from './authService.js';
import { sendTemporaryPasswordEmail } from './emailService.js';
import { validatePasswordStrength } from './passwordPolicy.js';
import { isAdminRole, normalizeUserRole } from './userPolicy.js';

const TEMP_PASSWORD_LENGTH = 12;
const ROLE_LABELS: Record<string, string> = {
  SYS_ADMIN: 'System Admin',
  AGENCY_USER: 'Agency User',
  VENDOR_USER: 'Vendor User',
};

const UPPERCASE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE_CHARS = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT_CHARS = '23456789';
const SYMBOL_CHARS = '!@#$%*_-';
const ALL_TEMP_PASSWORD_CHARS = `${UPPERCASE_CHARS}${LOWERCASE_CHARS}${DIGIT_CHARS}${SYMBOL_CHARS}`;

interface RequestContext {
  deviceFingerprintHash: string;
  ipAddress: string;
  requestId: string;
  userAgent: string;
}

function getHeaderValue(req: Request, headerName: string): string | undefined {
  const rawValue = req.headers[headerName];
  if (Array.isArray(rawValue)) {
    return rawValue[0];
  }
  return rawValue;
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
    deviceFingerprintHash: getHeaderValue(req, 'x-device-fingerprint') || '',
  };
}

function buildAuditLogBase(context: RequestContext) {
  return {
    id: crypto.randomUUID(),
    request_id: context.requestId,
    ip_address: context.ipAddress,
    user_agent: context.userAgent,
  };
}

function toDate(value: TimestampValue): Date {
  return value instanceof Date ? value : new Date(value);
}

function mapManagedUserStatus(user: ManagedUserRow): ManagedUserSummary['status'] {
  if (!user.is_active) {
    return 'inactive';
  }
  if (user.is_first_login && !user.temp_password_changed) {
    return 'pending';
  }
  return 'active';
}

function toManagedUserSummary(user: ManagedUserRow): ManagedUserSummary {
  return {
    id: user.id,
    username: user.username,
    name: String(user.full_name || user.email || user.username),
    email: String(user.email || user.username),
    role: user.role,
    organizationName: user.organization,
    organizationId: user.organization_id,
    department: user.department,
    position: user.position,
    status: mapManagedUserStatus(user),
    createdAt: toDate(user.created_at).toISOString(),
    lastLoginAt: user.last_login_at ? toDate(user.last_login_at).toISOString() : null,
  };
}

function mapRoleToOrganizationType(role: string): 'GOVERNMENT' | 'VENDOR' | 'AGENCY' {
  if (role === 'VENDOR_USER') {
    return 'VENDOR';
  }
  if (role === 'AGENCY_USER') {
    return 'AGENCY';
  }
  return 'GOVERNMENT';
}

function assertAdmin(authState: AuthenticatedRequestState, context: RequestContext): void {
  if (!isAdminRole(authState.user.role)) {
    throw new AuthServiceError(
      403,
      'BERSN_AUTH_FORBIDDEN',
      'Administrator privileges are required for this action.',
      { request_id: context.requestId },
    );
  }
}

function randomChar(charset: string): string {
  return charset[crypto.randomInt(0, charset.length)];
}

function shuffleCharacters(values: string[]): string[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(0, index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function generateTemporaryPassword(loginIdentifier: string): string {
  while (true) {
    const characters = [
      randomChar(UPPERCASE_CHARS),
      randomChar(LOWERCASE_CHARS),
      randomChar(DIGIT_CHARS),
      randomChar(SYMBOL_CHARS),
    ];

    while (characters.length < TEMP_PASSWORD_LENGTH) {
      characters.push(randomChar(ALL_TEMP_PASSWORD_CHARS));
    }

    const password = shuffleCharacters(characters).join('');
    if (validatePasswordStrength(password, loginIdentifier).length === 0) {
      return password;
    }
  }
}

async function rollbackQuietly(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    return;
  }
}

async function cleanupFailedAccountCreation(
  userId: string,
  authState: AuthenticatedRequestState,
  context: RequestContext,
  details: JsonObject,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await deleteUserById(client, userId);
    await insertAuditLog(client, {
      ...buildAuditLogBase(context),
      event_type: 'ACCOUNT_CREATE_FAILED',
      actor_user_id: authState.user.id,
      target_user_id: null,
      session_id: authState.sessionId,
      details_json: {
        ...details,
        failed_user_id: userId,
      },
    });
    await client.query('COMMIT');
  } catch (error) {
    await rollbackQuietly(client);
    console.error('[users] cleanupFailedAccountCreation failed', {
      request_id: context.requestId,
      failed_user_id: userId,
      actor_user_id: authState.user.id,
      error,
    });
  } finally {
    client.release();
  }
}

export async function listUsersForAdmin(
  req: Request,
  authState: AuthenticatedRequestState,
): Promise<ManagedUserSummary[]> {
  const context = buildRequestContext(req);
  assertAdmin(authState, context);

  const client = await pool.connect();
  try {
    const users = await listManagedUsers(client);
    return users.map(toManagedUserSummary);
  } finally {
    client.release();
  }
}

export async function createUserAccountAsAdmin(
  req: Request,
  authState: AuthenticatedRequestState,
  input: ManagedUserCreateInput,
): Promise<{
  deliveryMode: 'smtp' | 'log';
  deliveryReason: 'smtp_enabled' | 'log_only_enabled' | 'smtp_not_configured';
  user: ManagedUserSummary;
}> {
  const context = buildRequestContext(req);
  assertAdmin(authState, context);

  const username = String(input.email || '').trim().toLowerCase();
  const role = normalizeUserRole(input.role, 'VENDOR_USER');
  const temporaryPassword = generateTemporaryPassword(username);
  const passwordHash = await hashPassword(temporaryPassword);

  const client = await pool.connect();
  let createdUser: ManagedUserRow | null = null;

  try {
    await client.query('BEGIN');

    const existingUser = await findUserByUsername(client, username);
    if (existingUser) {
      throw new AuthServiceError(
        409,
        'BERSN_AUTH_USER_EXISTS',
        'A user with that email already exists.',
        { request_id: context.requestId },
      );
    }

    const organizationName = input.organization || null;
    const organization = organizationName
      ? await findOrCreateOrganizationByName(client, organizationName, mapRoleToOrganizationType(role))
      : null;

    createdUser = await createManagedUser(client, {
      id: crypto.randomUUID(),
      username,
      full_name: input.name,
      email: username,
      password_hash: passwordHash,
      role,
      organization: organizationName,
      organization_id: organization?.id || null,
      department: input.department || null,
      position: input.position || null,
      created_by: authState.user.id,
      is_active: true,
      is_first_login: true,
      temp_password_changed: false,
    } satisfies ManagedUserInsertPayload);

    await client.query('COMMIT');
  } catch (error) {
    await rollbackQuietly(client);
    if (error instanceof AuthServiceError) {
      throw error;
    }
    console.error('[users] createUserAccountAsAdmin failed before account commit', {
      request_id: context.requestId,
      username,
      role,
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
  }

  if (!createdUser) {
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: context.requestId },
    );
  }

  let emailResult: {
    mode: 'smtp' | 'log';
    reason: 'smtp_enabled' | 'log_only_enabled' | 'smtp_not_configured';
  };
  try {
    emailResult = await sendTemporaryPasswordEmail({
      email: username,
      name: input.name,
      roleLabel: ROLE_LABELS[role] || role,
      temporaryPassword,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[users] temporary password email delivery failed', {
      request_id: context.requestId,
      email: username,
      role,
      error: message,
    });
    await cleanupFailedAccountCreation(createdUser.id, authState, context, {
      email: username,
      role,
      reason: 'email_delivery_failed',
      message,
    });
    throw new AuthServiceError(
      502,
      'BERSN_ACCOUNT_EMAIL_FAILED',
      'The account could not be created because the temporary-password email was not delivered.',
      { request_id: context.requestId },
    );
  }

  const auditClient = await pool.connect();
  try {
    await auditClient.query('BEGIN');
    await insertAuditLog(auditClient, {
      ...buildAuditLogBase(context),
      event_type: 'ACCOUNT_CREATED',
      actor_user_id: authState.user.id,
      target_user_id: createdUser.id,
      session_id: authState.sessionId,
      details_json: {
        email: username,
        role,
        organization: input.organization || null,
        department: input.department || null,
        position: input.position || null,
        delivery_mode: emailResult.mode,
        requires_password_change: true,
      },
    });
    await auditClient.query('COMMIT');
  } catch {
    await rollbackQuietly(auditClient);
    console.error('[users] createUserAccountAsAdmin failed while writing audit log', {
      request_id: context.requestId,
      target_user_id: createdUser.id,
      actor_user_id: authState.user.id,
    });
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'The account was created, but the security audit log could not be written. Please review backend logs immediately.',
      { request_id: context.requestId },
    );
  } finally {
    auditClient.release();
  }

  return {
    deliveryMode: emailResult.mode,
    deliveryReason: emailResult.reason,
    user: toManagedUserSummary(createdUser),
  };
}

export async function updateUserAccountStatusAsAdmin(
  req: Request,
  authState: AuthenticatedRequestState,
  userId: string,
  isActive: boolean,
): Promise<ManagedUserSummary> {
  const context = buildRequestContext(req);
  assertAdmin(authState, context);

  if (!userId) {
    throw new AuthServiceError(
      400,
      'BERSN_API_VALIDATION_ERROR',
      'User id is required.',
      { request_id: context.requestId },
    );
  }

  if (authState.user.id === userId && !isActive) {
    throw new AuthServiceError(
      400,
      'BERSN_AUTH_SELF_DEACTIVATE_FORBIDDEN',
      'You cannot deactivate your own account.',
      { request_id: context.requestId },
    );
  }

  const client = await pool.connect();
  let revokedSessions: Array<{ refresh_token_hash: string }> = [];
  try {
    await client.query('BEGIN');

    const existingUser = await findManagedUserById(client, userId);
    if (!existingUser) {
      throw new AuthServiceError(
        404,
        'BERSN_AUTH_USER_NOT_FOUND',
        'User not found.',
        { request_id: context.requestId },
      );
    }

    const updatedUser = await updateManagedUserStatus(client, userId, isActive);
    if (!updatedUser) {
      throw new AuthServiceError(
        404,
        'BERSN_AUTH_USER_NOT_FOUND',
        'User not found.',
        { request_id: context.requestId },
      );
    }

    if (!isActive) {
      revokedSessions = await revokeActiveSessionsByUserId(client, userId, 'admin_deactivated_account');
    }

    await insertAuditLog(client, {
      ...buildAuditLogBase(context),
      event_type: 'ACCOUNT_STATUS_CHANGED',
      actor_user_id: authState.user.id,
      target_user_id: updatedUser.id,
      session_id: authState.sessionId,
      details_json: {
        email: updatedUser.email,
        username: updatedUser.username,
        previous_is_active: existingUser.is_active,
        current_is_active: updatedUser.is_active,
      },
    });

    await client.query('COMMIT');

    for (const session of revokedSessions) {
      await revokeRefreshSession(session.refresh_token_hash).catch(() => {});
    }

    return toManagedUserSummary({
      ...updatedUser,
      last_login_at: existingUser.last_login_at,
    });
  } catch (error) {
    await rollbackQuietly(client);
    if (error instanceof AuthServiceError) {
      throw error;
    }
    console.error('[users] updateUserAccountStatusAsAdmin failed (status_change)', {
      request_id: context.requestId,
      userId,
      isActive,
      actor_user_id: authState.user.id,
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
  }
}

export async function deleteManagedUserAsAdmin(
  req: Request,
  authState: AuthenticatedRequestState,
  userId: string,
): Promise<{ id: string; deletedAt: string }> {
  const context = buildRequestContext(req);
  assertAdmin(authState, context);

  if (!userId) {
    throw new AuthServiceError(
      400,
      'BERSN_API_VALIDATION_ERROR',
      'User id is required.',
      { request_id: context.requestId },
    );
  }

  if (authState.user.id === userId) {
    throw new AuthServiceError(
      400,
      'BERSN_AUTH_SELF_DELETE_FORBIDDEN',
      'You cannot delete your own account.',
      { request_id: context.requestId },
    );
  }

  const client = await pool.connect();
  let revokedSessions: Array<{ refresh_token_hash: string }> = [];
  try {
    await client.query('BEGIN');

    const existingUser = await findManagedUserById(client, userId);
    if (!existingUser) {
      throw new AuthServiceError(
        404,
        'BERSN_AUTH_USER_NOT_FOUND',
        'User not found.',
        { request_id: context.requestId },
      );
    }

    revokedSessions = await revokeActiveSessionsByUserId(client, userId, 'admin_deleted_account');

    const anonymized = await softDeleteAndAnonymizeUser(client, userId);
    if (!anonymized) {
      throw new AuthServiceError(
        404,
        'BERSN_AUTH_USER_NOT_FOUND',
        'User not found.',
        { request_id: context.requestId },
      );
    }

    await insertAuditLog(client, {
      ...buildAuditLogBase(context),
      event_type: 'ACCOUNT_DELETED',
      actor_user_id: authState.user.id,
      target_user_id: userId,
      session_id: authState.sessionId,
      details_json: {
        original_email: existingUser.email,
        original_username: existingUser.username,
        anonymized_username: anonymized.username,
      },
    });

    await client.query('COMMIT');

    for (const session of revokedSessions) {
      await revokeRefreshSession(session.refresh_token_hash).catch(() => {});
    }

    return { id: userId, deletedAt: new Date().toISOString() };
  } catch (error) {
    await rollbackQuietly(client);
    if (error instanceof AuthServiceError) {
      throw error;
    }
    console.error('[users] deleteManagedUserAsAdmin failed', {
      request_id: context.requestId,
      userId,
      actor_user_id: authState.user.id,
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
  }
}
