DO $$
BEGIN
  CREATE TYPE user_role AS ENUM ('SYS_ADMIN', 'AGENCY_USER', 'VENDOR_USER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS organization TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS position VARCHAR(150),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS temp_password_changed BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET role = CASE
  WHEN role IS NULL THEN 'VENDOR_USER'
  WHEN upper(role) = 'SYS_ADMIN' OR lower(role) IN ('admin', 'sys_admin', 'system_admin') THEN 'SYS_ADMIN'
  WHEN upper(role) = 'AGENCY_USER' OR lower(role) IN ('agency_user', 'reviewer') THEN 'AGENCY_USER'
  WHEN upper(role) = 'VENDOR_USER' OR lower(role) = 'vendor_user' THEN 'VENDOR_USER'
  ELSE 'VENDOR_USER'
END
WHERE pg_typeof(role)::text = 'text';

ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE users
  ALTER COLUMN role TYPE user_role
  USING role::user_role;

ALTER TABLE users
  ALTER COLUMN role SET DEFAULT 'VENDOR_USER';

UPDATE users
SET full_name = COALESCE(NULLIF(btrim(full_name), ''), username),
    email = COALESCE(
      NULLIF(lower(btrim(email)), ''),
      CASE WHEN position('@' IN username) > 1 THEN lower(username) ELSE NULL END
    ),
    temp_password_changed = CASE WHEN is_first_login THEN FALSE ELSE TRUE END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower_unique
  ON users ((lower(email)))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_created_by
  ON users (created_by);
