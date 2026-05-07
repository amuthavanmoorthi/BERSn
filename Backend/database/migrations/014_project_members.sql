-- Migration 014: Project member sharing & per-project permissions
-- Adds a `project_members` join table that enables sharing a project
-- with other users at three permission levels: viewer, editor, admin.
--
-- This is per-project ACL on top of the global user role
-- (SYS_ADMIN / AGENCY_USER / VENDOR_USER). A project owner is the
-- user in projects.created_by; sharing extends access to others.

BEGIN;

CREATE TABLE IF NOT EXISTS project_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  permission      TEXT        NOT NULL CHECK (permission IN ('viewer', 'editor', 'admin')),
  invited_by      UUID        NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project
  ON project_members (project_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_members_user
  ON project_members (user_id) WHERE revoked_at IS NULL;

-- Extend audit log action enum to track sharing events
ALTER TABLE project_audit_logs
  DROP CONSTRAINT IF EXISTS project_audit_logs_action_check;
ALTER TABLE project_audit_logs
  ADD CONSTRAINT project_audit_logs_action_check
  CHECK (action IN ('CREATED','UPDATED','SUBMITTED','APPROVED','DELETED','CALCULATED',
                    'SHARED','UNSHARED','PERMISSION_CHANGED'));

COMMIT;
