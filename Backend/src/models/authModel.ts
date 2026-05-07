import type { PoolClient } from 'pg';

import type {
  AccountLockoutRow,
  AccountLockoutUpsertPayload,
  AuditLogInsertPayload,
  LoginAttemptInsertPayload,
  PublicUser,
  SessionInsertPayload,
  SessionRow,
  UserRow,
  UserUpsertPayload,
  WebAuthnCredentialRow,
} from '../types/auth.js';
import type { ManagedUserInsertPayload, ManagedUserRow } from '../types/users.js';

export async function findUserByUsername(client: PoolClient, username: string): Promise<UserRow | null> {
  const { rows } = await client.query<UserRow>(
    `SELECT id, username, password_hash, role, is_active, is_first_login
       FROM users
      WHERE lower(username) = lower($1)
      LIMIT 1`,
    [username],
  );
  return rows[0] ?? null;
}

export async function findUserById(client: PoolClient, userId: string): Promise<UserRow | null> {
  const { rows } = await client.query<UserRow>(
    `SELECT id, username, password_hash, role, is_active, is_first_login
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function findActiveSessionByRefreshTokenHash(
  client: PoolClient,
  refreshTokenHash: string,
): Promise<SessionRow | null> {
  const { rows } = await client.query<SessionRow>(
    `SELECT
        u.id,
        s.id AS session_id,
        s.user_id,
        s.refresh_token_hash,
        s.device_fingerprint_hash,
        s.ip_address,
        s.user_agent,
        s.expires_at,
        s.revoked_at,
        u.username,
        u.role,
        u.is_active,
        u.is_first_login,
        u.organization,
        u.organization_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1
       AND u.is_active = TRUE
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
     LIMIT 1`,
    [refreshTokenHash],
  );
  return rows[0] ?? null;
}

export async function findActiveSessionById(client: PoolClient, sessionId: string): Promise<SessionRow | null> {
  const { rows } = await client.query<SessionRow>(
    `SELECT
        u.id,
        s.id AS session_id,
        s.user_id,
        s.refresh_token_hash,
        s.device_fingerprint_hash,
        s.ip_address,
        s.user_agent,
        s.expires_at,
        s.revoked_at,
        u.username,
        u.role,
        u.is_active,
        u.is_first_login,
        u.organization,
        u.organization_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1
       AND u.is_active = TRUE
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
     LIMIT 1`,
    [sessionId],
  );
  return rows[0] ?? null;
}

export async function insertSession(client: PoolClient, payload: SessionInsertPayload): Promise<void> {
  await client.query(
    `INSERT INTO sessions
      (id, user_id, refresh_token_hash, device_fingerprint_hash, ip_address, user_agent, expires_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7)`,
    [
      payload.id,
      payload.user_id,
      payload.refresh_token_hash,
      payload.device_fingerprint_hash,
      payload.ip_address || null,
      payload.user_agent || null,
      payload.expires_at,
    ],
  );
}

export async function updateSessionRefreshToken(
  client: PoolClient,
  sessionId: string,
  refreshTokenHash: string,
  expiresAt: Date,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  await client.query(
    `UPDATE sessions
        SET refresh_token_hash = $2,
            expires_at = $3,
            ip_address = COALESCE($4, ip_address),
            user_agent = COALESCE($5, user_agent),
            last_seen_at = now()
      WHERE id = $1`,
    [sessionId, refreshTokenHash, expiresAt, ipAddress || null, userAgent || null],
  );
}

export async function touchSession(
  client: PoolClient,
  sessionId: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  await client.query(
    `UPDATE sessions
        SET last_seen_at = now(),
            ip_address = COALESCE($2, ip_address),
            user_agent = COALESCE($3, user_agent)
      WHERE id = $1`,
    [sessionId, ipAddress || null, userAgent || null],
  );
}

export async function revokeSession(
  client: PoolClient,
  sessionId: string,
  reason: string,
): Promise<Pick<SessionRow, 'id' | 'refresh_token_hash' | 'user_id'> | null> {
  const { rows } = await client.query<Pick<SessionRow, 'id' | 'refresh_token_hash' | 'user_id'>>(
    `UPDATE sessions
        SET revoked_at = COALESCE(revoked_at, now()),
            revoked_reason = COALESCE(revoked_reason, $2),
            last_seen_at = now()
      WHERE id = $1
        AND revoked_at IS NULL
      RETURNING id, user_id, refresh_token_hash`,
    [sessionId, reason],
  );
  return rows[0] ?? null;
}

export async function revokeActiveSessionsByUserId(
  client: PoolClient,
  userId: string,
  reason: string,
): Promise<Array<Pick<SessionRow, 'id' | 'refresh_token_hash' | 'user_id'>>> {
  const { rows } = await client.query<Array<Pick<SessionRow, 'id' | 'refresh_token_hash' | 'user_id'>>[number]>(
    `UPDATE sessions
        SET revoked_at = COALESCE(revoked_at, now()),
            revoked_reason = COALESCE(revoked_reason, $2),
            last_seen_at = now()
      WHERE user_id = $1
        AND revoked_at IS NULL
      RETURNING id, user_id, refresh_token_hash`,
    [userId, reason],
  );
  return rows;
}

export async function insertLoginAttempt(client: PoolClient, payload: LoginAttemptInsertPayload): Promise<void> {
  await client.query(
    `INSERT INTO login_attempts
      (id, username, user_id, ip_address, user_agent, request_id, success, failure_reason)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      payload.id,
      payload.username,
      payload.user_id || null,
      payload.ip_address || null,
      payload.user_agent || null,
      payload.request_id || null,
      Boolean(payload.success),
      payload.failure_reason || null,
    ],
  );
}

export async function getAccountLockout(
  client: PoolClient,
  username: string,
  ipAddress: string,
): Promise<AccountLockoutRow | null> {
  const { rows } = await client.query<AccountLockoutRow>(
    `SELECT username, user_id, ip_address, failure_count, locked_until, last_failed_at, updated_at
       FROM account_lockouts
      WHERE username = $1
        AND ip_address = $2
      LIMIT 1`,
    [username, ipAddress],
  );
  return rows[0] ?? null;
}

export async function upsertAccountLockout(
  client: PoolClient,
  payload: AccountLockoutUpsertPayload,
): Promise<AccountLockoutRow | null> {
  const { rows } = await client.query<AccountLockoutRow>(
    `INSERT INTO account_lockouts
      (username, user_id, ip_address, failure_count, locked_until, last_failed_at, updated_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (username, ip_address)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       failure_count = EXCLUDED.failure_count,
       locked_until = EXCLUDED.locked_until,
       last_failed_at = EXCLUDED.last_failed_at,
       updated_at = now()
     RETURNING username, user_id, ip_address, failure_count, locked_until, last_failed_at, updated_at`,
    [
      payload.username,
      payload.user_id || null,
      payload.ip_address,
      payload.failure_count,
      payload.locked_until || null,
      payload.last_failed_at,
    ],
  );
  return rows[0] ?? null;
}

export async function clearAccountLockout(client: PoolClient, username: string, ipAddress: string): Promise<void> {
  await client.query(
    `DELETE FROM account_lockouts
      WHERE username = $1
        AND ip_address = $2`,
    [username, ipAddress],
  );
}

export async function insertAuditLog(client: PoolClient, payload: AuditLogInsertPayload): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs
      (id, event_type, actor_user_id, target_user_id, session_id, request_id, ip_address, user_agent, details_json)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      payload.id,
      payload.event_type,
      payload.actor_user_id || null,
      payload.target_user_id || null,
      payload.session_id || null,
      payload.request_id || null,
      payload.ip_address || null,
      payload.user_agent || null,
      JSON.stringify(payload.details_json || {}),
    ],
  );
}

export async function upsertUser(client: PoolClient, payload: UserUpsertPayload): Promise<(PublicUser & {
  is_active: boolean;
  password_hash: string;
}) | null> {
  const { rows } = await client.query<UserRow>(
    `INSERT INTO users
      (id, username, password_hash, role, is_active, is_first_login, created_at, updated_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, now(), now())
     ON CONFLICT (username)
     DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       is_active = EXCLUDED.is_active,
       is_first_login = EXCLUDED.is_first_login,
       updated_at = now()
     RETURNING id, username, role, is_active, is_first_login, password_hash`,
    [
      payload.id,
      payload.username,
      payload.password_hash,
      payload.role,
      payload.is_active,
      payload.is_first_login,
    ],
  );
  return rows[0] ?? null;
}

export async function createUser(client: PoolClient, payload: UserUpsertPayload): Promise<UserRow | null> {
  const { rows } = await client.query<UserRow>(
    `INSERT INTO users
      (id, username, password_hash, role, is_active, is_first_login, created_at, updated_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, now(), now())
     RETURNING id, username, password_hash, role, is_active, is_first_login`,
    [
      payload.id,
      payload.username,
      payload.password_hash,
      payload.role,
      payload.is_active,
      payload.is_first_login,
    ],
  );
  return rows[0] ?? null;
}

export async function findActiveWebAuthnCredentialsByUserId(
  client: PoolClient,
  userId: string,
): Promise<WebAuthnCredentialRow[]> {
  const { rows } = await client.query<WebAuthnCredentialRow>(
    `SELECT
        id,
        user_id,
        credential_id,
        public_key,
        counter,
        transports,
        device_type,
        backed_up,
        created_at,
        last_used_at,
        revoked_at
     FROM webauthn_credentials
     WHERE user_id = $1
       AND revoked_at IS NULL
     ORDER BY created_at ASC`,
    [userId],
  );
  return rows;
}

export async function findActiveWebAuthnCredentialByCredentialId(
  client: PoolClient,
  credentialId: string,
): Promise<WebAuthnCredentialRow | null> {
  const { rows } = await client.query<WebAuthnCredentialRow>(
    `SELECT
        c.id,
        c.user_id,
        c.credential_id,
        c.public_key,
        c.counter,
        c.transports,
        c.device_type,
        c.backed_up,
        c.created_at,
        c.last_used_at,
        c.revoked_at,
        u.username,
        u.role,
        u.is_active,
        u.is_first_login
     FROM webauthn_credentials c
     JOIN users u ON u.id = c.user_id
     WHERE c.credential_id = $1
       AND c.revoked_at IS NULL
       AND u.is_active = TRUE
     LIMIT 1`,
    [credentialId],
  );
  return rows[0] ?? null;
}

export async function insertWebAuthnCredential(
  client: PoolClient,
  payload: Omit<WebAuthnCredentialRow, 'created_at' | 'last_used_at' | 'revoked_at' | 'is_active' | 'is_first_login' | 'role' | 'username'>,
): Promise<WebAuthnCredentialRow | null> {
  const { rows } = await client.query<WebAuthnCredentialRow>(
    `INSERT INTO webauthn_credentials
      (id, user_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at)
     VALUES
      ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, now())
     RETURNING id, user_id, credential_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at, revoked_at`,
    [
      payload.id,
      payload.user_id,
      payload.credential_id,
      payload.public_key,
      payload.counter,
      JSON.stringify(payload.transports || []),
      payload.device_type,
      payload.backed_up,
    ],
  );
  return rows[0] ?? null;
}

export async function updateWebAuthnCredentialUsage(
  client: PoolClient,
  credentialId: string,
  counter: number,
  backedUp: boolean,
): Promise<void> {
  await client.query(
    `UPDATE webauthn_credentials
        SET counter = $2,
            backed_up = $3,
            last_used_at = now()
      WHERE credential_id = $1`,
    [credentialId, counter, backedUp],
  );
}

export async function updateUserPassword(
  client: PoolClient,
  userId: string,
  passwordHash: string,
  isFirstLogin: boolean,
): Promise<UserRow | null> {
  const { rows } = await client.query<UserRow>(
    `UPDATE users
        SET password_hash = $2,
            is_first_login = $3,
            temp_password_changed = CASE WHEN $3 THEN FALSE ELSE TRUE END,
            updated_at = now()
      WHERE id = $1
      RETURNING id, username, password_hash, role, is_active, is_first_login`,
    [userId, passwordHash, isFirstLogin],
  );
  return rows[0] ?? null;
}

export async function createManagedUser(client: PoolClient, payload: ManagedUserInsertPayload): Promise<ManagedUserRow | null> {
  const { rows } = await client.query<ManagedUserRow>(
    `INSERT INTO users
      (
        id,
        username,
        full_name,
        email,
        password_hash,
        role,
        organization,
        organization_id,
        department,
        position,
        created_by,
        is_active,
        is_first_login,
        temp_password_changed,
        created_at,
        updated_at
     )
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now())
     RETURNING
      id,
      username,
      full_name,
      email,
      role,
      organization,
      organization_id,
      department,
      position,
      created_by,
      is_active,
      is_first_login,
      temp_password_changed,
      created_at,
      NULL::timestamptz AS last_login_at`,
    [
      payload.id,
      payload.username,
      payload.full_name,
      payload.email,
      payload.password_hash,
      payload.role,
      payload.organization,
      payload.organization_id,
      payload.department,
      payload.position,
      payload.created_by,
      payload.is_active,
      payload.is_first_login,
      payload.temp_password_changed,
    ],
  );
  return rows[0] ?? null;
}

export async function listManagedUsers(client: PoolClient): Promise<ManagedUserRow[]> {
  const { rows } = await client.query<ManagedUserRow>(
    `SELECT
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.role,
        u.organization,
        u.organization_id,
        u.department,
        u.position,
        u.created_by,
        u.is_active,
        u.is_first_login,
        u.temp_password_changed,
        u.created_at,
        MAX(la.attempted_at) FILTER (WHERE la.success = TRUE) AS last_login_at
     FROM users u
     LEFT JOIN login_attempts la
       ON la.user_id = u.id
     GROUP BY
       u.id,
       u.username,
       u.full_name,
       u.email,
       u.role,
       u.organization,
       u.organization_id,
       u.department,
       u.position,
       u.created_by,
       u.is_active,
       u.is_first_login,
       u.temp_password_changed,
       u.created_at
     ORDER BY u.created_at DESC, lower(u.username) ASC`,
  );
  return rows;
}

export async function findManagedUserById(client: PoolClient, userId: string): Promise<ManagedUserRow | null> {
  const { rows } = await client.query<ManagedUserRow>(
    `SELECT
        u.id,
        u.username,
        u.full_name,
        u.email,
        u.role,
        u.organization,
        u.organization_id,
        u.department,
        u.position,
        u.created_by,
        u.is_active,
        u.is_first_login,
        u.temp_password_changed,
        u.created_at,
        MAX(la.attempted_at) FILTER (WHERE la.success = TRUE) AS last_login_at
     FROM users u
     LEFT JOIN login_attempts la
       ON la.user_id = u.id
     WHERE u.id = $1
     GROUP BY
       u.id,
       u.username,
       u.full_name,
       u.email,
       u.role,
       u.organization,
       u.organization_id,
       u.department,
       u.position,
       u.created_by,
       u.is_active,
       u.is_first_login,
       u.temp_password_changed,
       u.created_at
     LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function updateManagedUserStatus(
  client: PoolClient,
  userId: string,
  isActive: boolean,
): Promise<ManagedUserRow | null> {
  const { rows } = await client.query<ManagedUserRow>(
    `UPDATE users
        SET is_active = $2,
            updated_at = now()
      WHERE id = $1
      RETURNING
        id,
        username,
        full_name,
        email,
        role,
        organization,
        organization_id,
        department,
        position,
        created_by,
        is_active,
        is_first_login,
        temp_password_changed,
        created_at,
        NULL::timestamptz AS last_login_at`,
    [userId, isActive],
  );
  return rows[0] ?? null;
}

export async function deleteUserById(client: PoolClient, userId: string): Promise<void> {
  await client.query(
    `DELETE FROM users
      WHERE id = $1`,
    [userId],
  );
}
