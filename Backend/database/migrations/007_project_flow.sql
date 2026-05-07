CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS building_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  label_zh VARCHAR(100) NOT NULL,
  label_en VARCHAR(100) NOT NULL,
  eui_baseline DECIMAL(10,2) NOT NULL CHECK (eui_baseline > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO building_types (code, label_zh, label_en, eui_baseline, is_active, sort_order)
VALUES
  ('OFFICE', '辦公室', 'Office', 220.00, TRUE, 10),
  ('RETAIL', '零售商場', 'Retail', 260.00, TRUE, 20),
  ('HOTEL', '旅館', 'Hotel', 300.00, TRUE, 30),
  ('HOSPITAL', '醫院', 'Hospital', 430.00, TRUE, 40),
  ('RESIDENTIAL', '住宅', 'Residential', 120.00, TRUE, 50),
  ('MIXED_USE', '混合使用', 'Mixed Use', 240.00, TRUE, 60)
ON CONFLICT (code) DO UPDATE SET
  label_zh = EXCLUDED.label_zh,
  label_en = EXCLUDED.label_en,
  eui_baseline = EXCLUDED.eui_baseline,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('GOVERNMENT', 'VENDOR', 'AGENCY')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

INSERT INTO organizations (name, type)
SELECT DISTINCT
  btrim(organization)::VARCHAR(200) AS name,
  CASE
    WHEN role::text = 'VENDOR_USER' THEN 'VENDOR'
    WHEN role::text = 'AGENCY_USER' THEN 'AGENCY'
    ELSE 'GOVERNMENT'
  END AS type
FROM users
WHERE NULLIF(btrim(COALESCE(organization, '')), '') IS NOT NULL
ON CONFLICT (name) DO NOTHING;

UPDATE users u
SET organization_id = o.id
FROM organizations o
WHERE u.organization_id IS NULL
  AND lower(btrim(COALESCE(u.organization, ''))) = lower(o.name);

CREATE INDEX IF NOT EXISTS idx_users_organization_id
  ON users (organization_id);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_name VARCHAR(200) NOT NULL,
  organization VARCHAR(200) NOT NULL,
  location VARCHAR(300),
  building_type_code VARCHAR(50) NOT NULL REFERENCES building_types(code),
  total_floor_area DECIMAL(12,2) NOT NULL CHECK (total_floor_area > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_created_by
  ON projects (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_assigned_to
  ON projects (assigned_to, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_organization_status
  ON projects (organization_id, status, created_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_projects_building_type
  ON projects (building_type_code);

CREATE OR REPLACE FUNCTION set_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION set_projects_updated_at();

CREATE TABLE IF NOT EXISTS project_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  calculated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  calculation_version INT NOT NULL DEFAULT 1 CHECK (calculation_version > 0),
  eui_result DECIMAL(12,4),
  total_energy_kwh DECIMAL(15,4),
  carbon_emission_kg DECIMAL(15,4),
  green_building_grade VARCHAR(10) CHECK (green_building_grade IS NULL OR green_building_grade IN ('GOLD', 'SILVER', 'BRONZE', 'FAIL')),
  input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, calculation_version)
);

CREATE INDEX IF NOT EXISTS idx_project_calculations_project_version
  ON project_calculations (project_id, calculation_version DESC);

CREATE TABLE IF NOT EXISTS project_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(100) NOT NULL CHECK (action IN ('CREATED', 'UPDATED', 'SUBMITTED', 'APPROVED', 'DELETED', 'CALCULATED')),
  changed_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_audit_logs_project_created
  ON project_audit_logs (project_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_project_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'project_audit_logs are append-only and cannot be modified or removed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_audit_logs_no_update ON project_audit_logs;
CREATE TRIGGER trg_project_audit_logs_no_update
BEFORE UPDATE ON project_audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_project_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_project_audit_logs_no_delete ON project_audit_logs;
CREATE TRIGGER trg_project_audit_logs_no_delete
BEFORE DELETE ON project_audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_project_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_project_audit_logs_no_truncate ON project_audit_logs;
CREATE TRIGGER trg_project_audit_logs_no_truncate
BEFORE TRUNCATE ON project_audit_logs
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_project_audit_log_mutation();
