-- Update project status constraint
ALTER TABLE projects DROP CONSTRAINT projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check 
CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'COMPLETED', 'ARCHIVED'));

-- Update audit logs action constraint
ALTER TABLE project_audit_logs DROP CONSTRAINT project_audit_logs_action_check;
ALTER TABLE project_audit_logs ADD CONSTRAINT project_audit_logs_action_check 
CHECK (action IN ('CREATED', 'UPDATED', 'SUBMITTED', 'STATUS_CHANGED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'COMPLETED', 'DELETED', 'CALCULATED'));