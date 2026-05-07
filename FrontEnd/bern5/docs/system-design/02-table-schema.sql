-- BERN3 / BERSn 平台資料庫規劃（PostgreSQL 15+）
-- 說明：本 schema 對應目前前端資料模型，並擴充後端 API/計算履歷所需欄位

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ ENUM ============
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SYS_ADMIN', 'AGENCY_USER', 'VENDOR_USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('draft', 'in-progress', 'completed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE calc_status AS ENUM ('queued', 'running', 'succeeded', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE measure_category AS ENUM ('ENVELOPE', 'HVAC', 'LIGHTING', 'ELEVATOR', 'DHW', 'CONTROL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 主檔 ============
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    org_type VARCHAR(30) NOT NULL CHECK (org_type IN ('agency', 'vendor', 'other')),
    address TEXT,
    contact_person VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    department VARCHAR(100),
    position_title VARCHAR(100),
    status user_status NOT NULL DEFAULT 'pending',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    location VARCHAR(255),
    building_type VARCHAR(50),
    category VARCHAR(100),
    total_area_m2 NUMERIC(12,2),
    status project_status NOT NULL DEFAULT 'draft',
    latest_grade VARCHAR(10),
    latest_eei NUMERIC(10,4),
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_id);

CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_role VARCHAR(30) NOT NULL CHECK (member_role IN ('owner', 'editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- ============ 專案配置（基線） ============
CREATE TABLE IF NOT EXISTS project_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,

    project_name VARCHAR(255) NOT NULL,
    address TEXT,
    category VARCHAR(50) NOT NULL,
    region_code VARCHAR(20) NOT NULL,
    ur NUMERIC(8,4) NOT NULL,
    hvac_mode VARCHAR(30) NOT NULL,

    intermittent_short_depth BOOLEAN NOT NULL DEFAULT FALSE,
    intermittent_no_central_plant BOOLEAN NOT NULL DEFAULT FALSE,
    intermittent_openable_windows BOOLEAN NOT NULL DEFAULT FALSE,

    total_floor_area_af NUMERIC(12,2) NOT NULL,

    -- envelope
    wall_material VARCHAR(100),
    wall_thickness_m NUMERIC(8,4),
    wall_k_value NUMERIC(10,4),
    wall_u_value NUMERIC(10,4),
    roof_material VARCHAR(100),
    roof_thickness_m NUMERIC(8,4),
    roof_k_value NUMERIC(10,4),
    roof_u_value NUMERIC(10,4),
    eev NUMERIC(10,4),
    shading_ki NUMERIC(10,4),
    glass_u_value NUMERIC(10,4),
    glass_eta_i NUMERIC(10,4),

    -- mep hvac
    hvac_system_type VARCHAR(50),
    hvac_cop NUMERIC(10,4),
    hvac_aux_eff NUMERIC(10,4),
    hvac_control_strategy NUMERIC(10,4),
    hvac_coverage NUMERIC(10,4),

    -- mep lighting
    lighting_lpd NUMERIC(10,4),
    lighting_control_factor NUMERIC(10,4),
    lighting_coverage NUMERIC(10,4),

    -- mep elevator
    elevator_type VARCHAR(50),
    elevator_eff_constant NUMERIC(10,4),
    elevator_num INTEGER,
    elevator_energy_per_cycle NUMERIC(10,4),
    elevator_yearly_hours NUMERIC(10,2),

    -- mep dhw
    dhw_has_dhw BOOLEAN NOT NULL DEFAULT FALSE,
    dhw_system_type VARCHAR(50),
    dhw_hpc NUMERIC(10,4),
    dhw_ehw_constant NUMERIC(10,4),
    dhw_load_factor NUMERIC(10,4),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_exempt_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    reason VARCHAR(50) NOT NULL,
    area_m2 NUMERIC(12,2) NOT NULL CHECK (area_m2 >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_exempt_areas_project ON project_exempt_areas(project_id);

CREATE TABLE IF NOT EXISTS project_geometry_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    object_key VARCHAR(100) NOT NULL, -- 對應前端 id
    geometry_type VARCHAR(30) NOT NULL,
    params JSONB NOT NULL,
    position_x NUMERIC(10,3) NOT NULL DEFAULT 0,
    position_y NUMERIC(10,3) NOT NULL DEFAULT 0,
    position_z NUMERIC(10,3) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, object_key)
);
CREATE INDEX IF NOT EXISTS idx_project_geometry_objects_project ON project_geometry_objects(project_id);

-- ============ 計算與結果 ============
CREATE TABLE IF NOT EXISTS calculation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    engine_version VARCHAR(50) NOT NULL,
    status calc_status NOT NULL DEFAULT 'queued',
    request_payload JSONB NOT NULL,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calculation_runs_project ON calculation_runs(project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS calculation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL UNIQUE REFERENCES calculation_runs(id) ON DELETE CASCADE,
    eei NUMERIC(12,6) NOT NULL,
    scoreee NUMERIC(10,4) NOT NULL,
    grade VARCHAR(10) NOT NULL,
    esr NUMERIC(10,4),
    is_nzcb BOOLEAN,
    afe NUMERIC(12,2),

    eui_n NUMERIC(12,4),
    eui_g NUMERIC(12,4),
    eui_m NUMERIC(12,4),
    eui_max NUMERIC(12,4),

    weights JSONB,
    eev_calculation JSONB,
    mep_results JSONB,
    breakdown JSONB,

    warnings JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============ 優化方案 ============
CREATE TABLE IF NOT EXISTS measure_library (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category measure_category NOT NULL,
    description TEXT,
    eligibility JSONB,
    patches JSONB NOT NULL,
    cost_model JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_scenarios_project ON project_scenarios(project_id);

CREATE TABLE IF NOT EXISTS scenario_measures (
    scenario_id UUID NOT NULL REFERENCES project_scenarios(id) ON DELETE CASCADE,
    measure_id VARCHAR(50) NOT NULL REFERENCES measure_library(id),
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (scenario_id, measure_id)
);

CREATE TABLE IF NOT EXISTS scenario_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id UUID NOT NULL REFERENCES project_scenarios(id) ON DELETE CASCADE,
    base_run_id UUID REFERENCES calculation_runs(id) ON DELETE SET NULL,
    simulated_eei NUMERIC(12,6) NOT NULL,
    simulated_scoreee NUMERIC(10,4) NOT NULL,
    simulated_grade VARCHAR(10) NOT NULL,
    total_cost_twd NUMERIC(14,2) NOT NULL DEFAULT 0,
    cp_value NUMERIC(14,6),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============ 報表與審計 ============
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_id UUID REFERENCES calculation_runs(id) ON DELETE SET NULL,
    report_type VARCHAR(50) NOT NULL,
    file_url TEXT,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role user_role,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    request_id VARCHAR(100),
    ip_address VARCHAR(64),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id, created_at DESC);

-- ============ 參數字典（Lookup） ============
CREATE TABLE IF NOT EXISTS ref_regions (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    ur NUMERIC(8,4) NOT NULL,
    counties JSONB
);

CREATE TABLE IF NOT EXISTS ref_use_categories (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    name_en VARCHAR(120),
    aeui NUMERIC(10,4) NOT NULL,
    leui NUMERIC(10,4) NOT NULL,
    eeui NUMERIC(10,4) NOT NULL,
    es NUMERIC(10,4) NOT NULL,
    has_dhw BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ref_constructions (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    name_en VARCHAR(120),
    construction_type VARCHAR(20) NOT NULL,
    u_value NUMERIC(10,4) NOT NULL,
    layers JSONB
);

CREATE TABLE IF NOT EXISTS ref_glazing_types (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    name_en VARCHAR(120),
    u_value NUMERIC(10,4) NOT NULL,
    eta NUMERIC(10,4) NOT NULL,
    vlt NUMERIC(10,4)
);

CREATE TABLE IF NOT EXISTS ref_shading_types (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    name_en VARCHAR(120),
    ki NUMERIC(10,4) NOT NULL,
    orientation_bonus JSONB
);

CREATE TABLE IF NOT EXISTS ref_hvac_systems (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    name_en VARCHAR(120),
    eac_base NUMERIC(10,4),
    cop_ref NUMERIC(10,4),
    system_type VARCHAR(30),
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS ref_lighting_systems (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    name_en VARCHAR(120),
    el_base NUMERIC(10,4),
    lpd_w_m2 NUMERIC(10,4),
    efficacy_lm_w NUMERIC(10,4)
);

CREATE TABLE IF NOT EXISTS ref_dhw_systems (
    id VARCHAR(30) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    name_en VARCHAR(120),
    ehw NUMERIC(10,4),
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS ref_grade_thresholds (
    grade VARCHAR(10) PRIMARY KEY,
    max_eei NUMERIC(10,4) NOT NULL,
    label VARCHAR(100),
    color VARCHAR(20)
);
