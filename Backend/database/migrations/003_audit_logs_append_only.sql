CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS previous_entry_hash TEXT,
  ADD COLUMN IF NOT EXISTS entry_hash TEXT;

CREATE OR REPLACE FUNCTION build_audit_log_entry_hash(
  audit_id UUID,
  audit_event_type TEXT,
  audit_actor_user_id UUID,
  audit_target_user_id UUID,
  audit_session_id UUID,
  audit_request_id TEXT,
  audit_ip_address TEXT,
  audit_user_agent TEXT,
  audit_details_json JSONB,
  audit_created_at TIMESTAMPTZ,
  audit_previous_entry_hash TEXT
) RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT encode(
    digest(
      concat_ws(
        '|',
        COALESCE(audit_id::text, ''),
        COALESCE(audit_event_type, ''),
        COALESCE(audit_actor_user_id::text, ''),
        COALESCE(audit_target_user_id::text, ''),
        COALESCE(audit_session_id::text, ''),
        COALESCE(audit_request_id, ''),
        COALESCE(audit_ip_address, ''),
        COALESCE(audit_user_agent, ''),
        COALESCE(audit_details_json::text, '{}'::text),
        to_char(COALESCE(audit_created_at, to_timestamp(0)) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        COALESCE(audit_previous_entry_hash, '')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION set_audit_log_hashes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prior_hash TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('audit_logs_chain', 0));

  NEW.created_at := COALESCE(NEW.created_at, now());

  SELECT entry_hash
    INTO prior_hash
    FROM audit_logs
   ORDER BY created_at DESC, id DESC
   LIMIT 1;

  NEW.previous_entry_hash := prior_hash;
  NEW.entry_hash := build_audit_log_entry_hash(
    NEW.id,
    NEW.event_type,
    NEW.actor_user_id,
    NEW.target_user_id,
    NEW.session_id,
    NEW.request_id,
    NEW.ip_address,
    NEW.user_agent,
    NEW.details_json,
    NEW.created_at,
    prior_hash
  );

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  audit_record RECORD;
  prior_hash TEXT := NULL;
  current_hash TEXT;
BEGIN
  FOR audit_record IN
    SELECT id, event_type, actor_user_id, target_user_id, session_id, request_id, ip_address, user_agent, details_json, created_at
      FROM audit_logs
     ORDER BY created_at ASC, id ASC
  LOOP
    current_hash := build_audit_log_entry_hash(
      audit_record.id,
      audit_record.event_type,
      audit_record.actor_user_id,
      audit_record.target_user_id,
      audit_record.session_id,
      audit_record.request_id,
      audit_record.ip_address,
      audit_record.user_agent,
      audit_record.details_json,
      audit_record.created_at,
      prior_hash
    );

    UPDATE audit_logs
       SET previous_entry_hash = prior_hash,
           entry_hash = current_hash
     WHERE id = audit_record.id;

    prior_hash := current_hash;
  END LOOP;
END;
$$;

ALTER TABLE audit_logs
  ALTER COLUMN entry_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_entry_hash
  ON audit_logs (entry_hash);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are append-only and cannot be modified or removed';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_set_hashes ON audit_logs;
CREATE TRIGGER audit_logs_set_hashes
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION set_audit_log_hashes();

DROP TRIGGER IF EXISTS audit_logs_prevent_update_delete ON audit_logs;
CREATE TRIGGER audit_logs_prevent_update_delete
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_prevent_truncate ON audit_logs;
CREATE TRIGGER audit_logs_prevent_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_mutation();

ALTER TABLE audit_logs ENABLE ALWAYS TRIGGER audit_logs_set_hashes;
ALTER TABLE audit_logs ENABLE ALWAYS TRIGGER audit_logs_prevent_update_delete;
ALTER TABLE audit_logs ENABLE ALWAYS TRIGGER audit_logs_prevent_truncate;

REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM PUBLIC;
