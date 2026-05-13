-- Migration 019: Project workflow history and final workflow constraints
-- Keeps the current Bern5 workflow model consistent with Backend code.

BEGIN;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'REVISION_REQUESTED',
    'COMPLETED',
    'ARCHIVED'
  ));

ALTER TABLE project_audit_logs
  DROP CONSTRAINT IF EXISTS project_audit_logs_action_check;

ALTER TABLE project_audit_logs
  ADD CONSTRAINT project_audit_logs_action_check
  CHECK (action IN (
    'CREATED',
    'UPDATED',
    'SUBMITTED',
    'REVIEW_STARTED',
    'APPROVED',
    'REJECTED',
    'REVISION_REQUESTED',
    'COMPLETED',
    'REOPENED',
    'ASSIGNED',
    'DELETED',
    'CALCULATED',
    'SHARED',
    'UNSHARED',
    'PERMISSION_CHANGED'
  ));

CREATE TABLE IF NOT EXISTS project_workflow_history (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_status   VARCHAR(50) CHECK (
    from_status IS NULL OR from_status IN (
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'REJECTED',
      'REVISION_REQUESTED',
      'COMPLETED',
      'ARCHIVED'
    )
  ),
  to_status     VARCHAR(50) NOT NULL CHECK (to_status IN (
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'REVISION_REQUESTED',
    'COMPLETED',
    'ARCHIVED'
  )),
  actor_user_id UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_role    VARCHAR(50) NOT NULL,
  reason        TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_workflow_history_project_created
  ON project_workflow_history (project_id, created_at ASC, id ASC);

COMMIT;
