export type TimestampValue = Date | string;

export type JsonObject = Record<string, unknown>;

export type SameSiteValue = 'lax' | 'strict' | 'none';

export interface CookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: SameSiteValue;
  secure?: boolean;
}

export interface PublicUser {
  id: string;
  is_first_login: boolean;
  organization: string | null;
  organization_id: string | null;
  role: string;
  username: string;
}

export interface UserRow extends PublicUser {
  is_active: boolean;
  password_hash: string;
}

export interface SessionRow extends PublicUser {
  device_fingerprint_hash: string;
  expires_at: TimestampValue;
  ip_address: string | null;
  organization: string | null;
  organization_id: string | null;
  is_active: boolean;
  refresh_token_hash: string;
  revoked_at: TimestampValue | null;
  session_id: string;
  user_agent: string | null;
  user_id: string;
}

export interface WebAuthnCredentialRow {
  backed_up: boolean;
  counter: number;
  created_at: TimestampValue;
  credential_id: string;
  device_type: string;
  id: string;
  is_active?: boolean;
  is_first_login?: boolean;
  last_used_at: TimestampValue | null;
  public_key: string;
  revoked_at: TimestampValue | null;
  role?: string;
  transports: string[] | null;
  user_id: string;
  username?: string;
}

export interface AccountLockoutRow {
  failure_count: number;
  ip_address: string;
  last_failed_at: TimestampValue | null;
  locked_until: TimestampValue | null;
  updated_at: TimestampValue;
  user_id: string | null;
  username: string;
}

export interface LoginAttemptInsertPayload {
  failure_reason: string | null;
  id: string;
  ip_address: string | null;
  request_id: string | null;
  success: boolean;
  user_agent: string | null;
  user_id: string | null;
  username: string;
}

export interface SessionInsertPayload {
  device_fingerprint_hash: string;
  expires_at: Date;
  id: string;
  ip_address: string;
  refresh_token_hash: string;
  user_agent: string;
  user_id: string;
}

export interface AccountLockoutUpsertPayload {
  failure_count: number;
  ip_address: string;
  last_failed_at: Date;
  locked_until: Date | null;
  user_id: string | null;
  username: string;
}

export interface AuditLogInsertPayload {
  actor_user_id: string | null;
  details_json: JsonObject;
  event_type: string;
  id: string;
  ip_address: string | null;
  request_id: string | null;
  session_id?: string | null;
  target_user_id: string | null;
  user_agent: string | null;
}

export interface UserUpsertPayload {
  id: string;
  is_active: boolean;
  is_first_login: boolean;
  password_hash: string;
  role: string;
  username: string;
}

export interface BootstrapAdminConfig {
  force: boolean;
  password?: string;
  role: string;
  username?: string;
}

export interface JwtAccessTokenClaims {
  aud: string;
  exp: number;
  first_login: boolean;
  iat: number;
  iss: string;
  role: string;
  sid: string;
  sub: string;
  type: 'access';
  username: string;
}

export interface CachedRefreshSession {
  deviceFingerprintHash: string;
  expiresAt: string;
  sessionId: string;
  userId: string;
}

export interface StoredWebAuthnChallenge {
  challenge: string;
  expiresAt: string;
  userId: string;
  username: string;
}

export interface LoginRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface AuthenticatedRequestState {
  sessionId: string;
  user: PublicUser;
}

export interface PasswordChangeResult {
  user: PublicUser;
}

export interface AdminCreateUserResult {
  user: PublicUser;
}

export interface PasskeyRegistrationResult {
  credentialId: string;
}

export interface LoginAuthState extends AuthenticatedRequestState {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface RefreshAuthState extends AuthenticatedRequestState {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface RequestContext {
  deviceFingerprintHash: string;
  ipAddress: string;
  requestId: string;
  userAgent: string;
}

export interface AuthErrorDetails extends JsonObject {
  request_id: string;
}
