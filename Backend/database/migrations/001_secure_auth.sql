CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reviewer',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_first_login BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  device_fingerprint_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id_expires_at
  ON sessions (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_active_user_id
  ON sessions (user_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_username_attempted_at
  ON login_attempts (username, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_attempted_at
  ON login_attempts (ip_address, attempted_at DESC);

CREATE TABLE IF NOT EXISTS account_lockouts (
  username TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address TEXT NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  locked_until TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (username, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked_until
  ON account_lockouts (locked_until DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type_created_at
  ON audit_logs (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created_at
  ON audit_logs (actor_user_id, created_at DESC);

INSERT INTO users (
  id,
  username,
  password_hash,
  role,
  is_active,
  is_first_login
)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'admin',
  '$argon2id$v=19$m=65536,t=3,p=1$pQ7lvcJOxI2GG3U2zJxW3g$lxBpxgID8Zp4fZlsv0u6slqwzehwKn8U7c/bcEc3R5w',
  'admin',
  TRUE,
  TRUE
)
ON CONFLICT (username) DO NOTHING;
