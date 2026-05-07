import type { PoolClient } from 'pg';

import type {
  BuildingTypeRow,
  OrganizationRow,
  OrganizationType,
  ProjectAuditAction,
  ProjectCalculationRow,
  ProjectRow,
  ProjectStatus,
  ProjectUserContext,
} from '../types/projects.js';

interface ProjectInsertPayload {
  assigned_to: string | null;
  building_type_code: string;
  created_by: string;
  location: string | null;
  organization: string;
  organization_id: string | null;
  project_name: string;
  total_floor_area: number;
}

interface ProjectCalculationInsertPayload {
  calculated_by: string;
  carbon_emission_kg: number | null;
  eui_result: number | null;
  green_building_grade: string | null;
  input_snapshot: unknown;
  notes: string | null;
  project_id: string;
  total_energy_kwh: number | null;
}

export async function listActiveBuildingTypes(client: PoolClient): Promise<BuildingTypeRow[]> {
  const { rows } = await client.query<BuildingTypeRow>(
    `SELECT id, code, label_zh, label_en, eui_baseline, is_active, sort_order,
            COALESCE(status, 'ready') AS status
       FROM building_types
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, label_en ASC`,
  );
  return rows;
}

export async function findActiveBuildingTypeByCode(
  client: PoolClient,
  code: string,
): Promise<BuildingTypeRow | null> {
  const { rows } = await client.query<BuildingTypeRow>(
    `SELECT id, code, label_zh, label_en, eui_baseline, is_active, sort_order,
            COALESCE(status, 'ready') AS status
       FROM building_types
      WHERE code = $1
        AND is_active = TRUE
      LIMIT 1`,
    [code],
  );
  return rows[0] ?? null;
}

export async function listActiveOrganizations(client: PoolClient): Promise<OrganizationRow[]> {
  const { rows } = await client.query<OrganizationRow>(
    `SELECT id, name, type, is_active, created_at
       FROM organizations
      WHERE is_active = TRUE
      ORDER BY lower(name) ASC`,
  );
  return rows;
}

export async function findActiveOrganizationById(
  client: PoolClient,
  organizationId: string,
): Promise<OrganizationRow | null> {
  const { rows } = await client.query<OrganizationRow>(
    `SELECT id, name, type, is_active, created_at
       FROM organizations
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1`,
    [organizationId],
  );
  return rows[0] ?? null;
}

export async function findOrCreateOrganizationByName(
  client: PoolClient,
  name: string,
  type: OrganizationType,
): Promise<OrganizationRow> {
  const { rows } = await client.query<OrganizationRow>(
    `INSERT INTO organizations (name, type, is_active)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (name)
     DO UPDATE SET is_active = TRUE
     RETURNING id, name, type, is_active, created_at`,
    [name, type],
  );
  return rows[0];
}

export async function findProjectUserContext(
  client: PoolClient,
  userId: string,
): Promise<ProjectUserContext | null> {
  const { rows } = await client.query<ProjectUserContext>(
    `SELECT id, username, role::text AS role, organization, organization_id
       FROM users
      WHERE id = $1
        AND is_active = TRUE
      LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

function buildProjectSelect(whereClause: string, fromSource = 'projects p'): string {
  return `
    SELECT
      p.id,
      p.project_name,
      p.organization,
      p.location,
      p.building_type_code,
      p.total_floor_area,
      p.status,
      p.created_by,
      p.assigned_to,
      p.organization_id,
      p.is_deleted,
      p.created_at,
      p.updated_at,
      p.workspace_saved_at,
      p.selected_region,
      p.selected_use_category,
      p.selected_wall,
      p.selected_roof,
      p.selected_shading,
      p.selected_glazing,
      p.selected_hvac,
      p.selected_lighting,
      p.selected_elevator,
      p.selected_dhw,
      p.elevator_count,
      p.exempt_areas,
      p.floors,
      p.geometry_objects,
      bt.label_zh AS building_type_label_zh,
      bt.label_en AS building_type_label_en,
      bt.eui_baseline AS building_type_eui_baseline,
      org.name AS organization_name,
      creator.username AS creator_username,
      latest.eui_result AS latest_eui_result,
      latest.green_building_grade AS latest_grade,
      latest.calculated_at AS latest_calculation_at
    FROM ${fromSource}
    JOIN building_types bt
      ON bt.code = p.building_type_code
    LEFT JOIN organizations org
      ON org.id = p.organization_id
    LEFT JOIN users creator
      ON creator.id = p.created_by
    LEFT JOIN LATERAL (
      SELECT eui_result, green_building_grade, calculated_at
        FROM project_calculations pc
       WHERE pc.project_id = p.id
       ORDER BY pc.calculation_version DESC
       LIMIT 1
    ) latest ON TRUE
    ${whereClause}
    ORDER BY p.updated_at DESC, p.created_at DESC`;
}

export async function listAllProjects(client: PoolClient): Promise<ProjectRow[]> {
  const { rows } = await client.query<ProjectRow>(
    buildProjectSelect('WHERE p.is_deleted = FALSE'),
  );
  return rows;
}

export async function listProjectsByOrganization(
  client: PoolClient,
  organizationId: string,
): Promise<ProjectRow[]> {
  const { rows } = await client.query<ProjectRow>(
    buildProjectSelect('WHERE p.is_deleted = FALSE AND p.organization_id = $1'),
    [organizationId],
  );
  return rows;
}

export async function listProjectsAssignedToUser(
  client: PoolClient,
  userId: string,
): Promise<ProjectRow[]> {
  const { rows } = await client.query<ProjectRow>(
    buildProjectSelect('WHERE p.is_deleted = FALSE AND p.assigned_to = $1'),
    [userId],
  );
  return rows;
}

export async function findProjectById(client: PoolClient, projectId: string): Promise<ProjectRow | null> {
  const { rows } = await client.query<ProjectRow>(
    buildProjectSelect('WHERE p.id = $1 AND p.is_deleted = FALSE'),
    [projectId],
  );
  return rows[0] ?? null;
}

export async function insertProject(
  client: PoolClient,
  payload: ProjectInsertPayload,
): Promise<ProjectRow | null> {
  const { rows } = await client.query<ProjectRow>(
    `WITH inserted AS (
      INSERT INTO projects
        (project_name, organization, location, building_type_code, total_floor_area, created_by, assigned_to, organization_id)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    )
    ${buildProjectSelect('', 'inserted p')}`,
    [
      payload.project_name,
      payload.organization,
      payload.location,
      payload.building_type_code,
      payload.total_floor_area,
      payload.created_by,
      payload.assigned_to,
      payload.organization_id,
    ],
  );
  return rows[0] ?? null;
}

export async function updateProjectStatus(
  client: PoolClient,
  projectId: string,
  status: ProjectStatus,
): Promise<ProjectRow | null> {
  const { rows } = await client.query<ProjectRow>(
    `WITH updated AS (
      UPDATE projects
         SET status = $2
       WHERE id = $1
         AND is_deleted = FALSE
       RETURNING *
    )
    ${buildProjectSelect('', 'updated p')}`,
    [projectId, status],
  );
  return rows[0] ?? null;
}

export interface ProjectInfoUpdatePayload {
  building_type_code: string;
  location: string | null;
  project_name: string;
}

export async function updateProjectInfo(
  client: PoolClient,
  projectId: string,
  payload: ProjectInfoUpdatePayload,
): Promise<ProjectRow | null> {
  const { rows } = await client.query<ProjectRow>(
    `WITH updated AS (
      UPDATE projects
         SET project_name = $2,
             location = $3,
             building_type_code = $4
       WHERE id = $1
         AND is_deleted = FALSE
       RETURNING *
    )
    ${buildProjectSelect('', 'updated p')}`,
    [
      projectId,
      payload.project_name,
      payload.location,
      payload.building_type_code,
    ],
  );
  return rows[0] ?? null;
}

export async function softDeleteProject(client: PoolClient, projectId: string): Promise<ProjectRow | null> {
  const { rows } = await client.query<ProjectRow>(
    `WITH updated AS (
      UPDATE projects
         SET is_deleted = TRUE,
             status = 'ARCHIVED'
       WHERE id = $1
         AND is_deleted = FALSE
       RETURNING *
    )
    ${buildProjectSelect('', 'updated p')}`,
    [projectId],
  );
  return rows[0] ?? null;
}

export interface WorkspaceSettingsPayload {
  elevator_count: number;
  exempt_areas: unknown;
  floors: unknown;
  geometry_objects: unknown;
  selected_dhw: string;
  selected_elevator: string;
  selected_glazing: string;
  selected_hvac: string;
  selected_lighting: string;
  selected_region: string;
  selected_roof: string;
  selected_shading: string;
  selected_use_category: string;
  selected_wall: string;
}

export async function updateProjectWorkspaceSettings(
  client: PoolClient,
  projectId: string,
  payload: WorkspaceSettingsPayload,
): Promise<ProjectRow | null> {
  const { rows } = await client.query<ProjectRow>(
    `WITH updated AS (
      UPDATE projects
         SET selected_region       = $2,
             selected_use_category = $3,
             selected_wall         = $4,
             selected_roof         = $5,
             selected_shading      = $6,
             selected_glazing      = $7,
             selected_hvac         = $8,
             selected_lighting     = $9,
             selected_elevator     = $10,
             selected_dhw          = $11,
             elevator_count        = $12,
             exempt_areas          = $13::jsonb,
             geometry_objects      = $14::jsonb,
             floors                = $15::jsonb,
             workspace_saved_at    = NOW()
       WHERE id = $1
         AND is_deleted = FALSE
       RETURNING *
    )
    ${buildProjectSelect('', 'updated p')}`,
    [
      projectId,
      payload.selected_region,
      payload.selected_use_category,
      payload.selected_wall,
      payload.selected_roof,
      payload.selected_shading,
      payload.selected_glazing,
      payload.selected_hvac,
      payload.selected_lighting,
      payload.selected_elevator,
      payload.selected_dhw,
      payload.elevator_count,
      JSON.stringify(payload.exempt_areas ?? []),
      JSON.stringify(payload.geometry_objects ?? []),
      JSON.stringify(payload.floors ?? []),
    ],
  );
  return rows[0] ?? null;
}

export async function insertProjectAuditLog(
  client: PoolClient,
  payload: {
    action: ProjectAuditAction;
    changed_fields: unknown;
    ip_address: string | null;
    project_id: string;
    user_id: string;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO project_audit_logs
      (project_id, user_id, action, changed_fields, ip_address)
     VALUES
      ($1, $2, $3, $4::jsonb, $5::inet)`,
    [
      payload.project_id,
      payload.user_id,
      payload.action,
      JSON.stringify(payload.changed_fields || {}),
      payload.ip_address,
    ],
  );
}

// ──────────────────────────────────────────────────────────────────
// Project Member sharing
// ──────────────────────────────────────────────────────────────────

export async function listProjectMembers(client: PoolClient, projectId: string) {
  const { rows } = await client.query<import('../types/projects.js').ProjectMemberRow>(
    `SELECT pm.id, pm.project_id, pm.user_id, pm.permission, pm.invited_by,
            pm.invited_at, pm.accepted_at, pm.revoked_at, u.username
       FROM project_members pm
       LEFT JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1 AND pm.revoked_at IS NULL
      ORDER BY pm.invited_at DESC`,
    [projectId],
  );
  return rows;
}

export async function findProjectMember(client: PoolClient, projectId: string, userId: string) {
  const { rows } = await client.query<import('../types/projects.js').ProjectMemberRow>(
    `SELECT id, project_id, user_id, permission, invited_by, invited_at,
            accepted_at, revoked_at
       FROM project_members
      WHERE project_id = $1 AND user_id = $2
      LIMIT 1`,
    [projectId, userId],
  );
  return rows[0] ?? null;
}

export async function upsertProjectMember(
  client: PoolClient,
  payload: {
    project_id: string;
    user_id: string;
    permission: import('../types/projects.js').ProjectPermission;
    invited_by: string;
  },
) {
  const { rows } = await client.query<import('../types/projects.js').ProjectMemberRow>(
    `INSERT INTO project_members (project_id, user_id, permission, invited_by, accepted_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (project_id, user_id) DO UPDATE
       SET permission  = EXCLUDED.permission,
           invited_by  = EXCLUDED.invited_by,
           revoked_at  = NULL,
           accepted_at = now()
     RETURNING id, project_id, user_id, permission, invited_by, invited_at, accepted_at, revoked_at`,
    [payload.project_id, payload.user_id, payload.permission, payload.invited_by],
  );
  return rows[0] ?? null;
}

export async function revokeProjectMember(client: PoolClient, projectId: string, userId: string) {
  const { rowCount } = await client.query(
    `UPDATE project_members SET revoked_at = now()
      WHERE project_id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [projectId, userId],
  );
  return (rowCount ?? 0) > 0;
}

export async function findUserByUsername(client: PoolClient, username: string) {
  const { rows } = await client.query<{ id: string; username: string; role: string }>(
    `SELECT id, username, role::text AS role FROM users
      WHERE lower(username) = lower($1) AND is_active = TRUE
      LIMIT 1`,
    [username],
  );
  return rows[0] ?? null;
}

export async function listAuditLogsForProject(
  client: PoolClient,
  projectId: string,
  limit = 100,
) {
  const { rows } = await client.query<{
    id: string;
    project_id: string;
    user_id: string;
    username: string | null;
    action: string;
    changed_fields: unknown;
    ip_address: string | null;
    created_at: import('../types/auth.js').TimestampValue;
  }>(
    `SELECT
       al.id, al.project_id, al.user_id, u.username,
       al.action, al.changed_fields, al.ip_address, al.created_at
     FROM project_audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
    WHERE al.project_id = $1
    ORDER BY al.created_at DESC
    LIMIT $2`,
    [projectId, limit],
  );
  return rows;
}

export async function updateProjectAssignee(
  client: PoolClient,
  projectId: string,
  assignedTo: string | null,
) {
  const { rows } = await client.query<import('../types/projects.js').ProjectRow>(
    `WITH updated AS (
      UPDATE projects
         SET assigned_to = $2
       WHERE id = $1
         AND is_deleted = FALSE
       RETURNING *
    )
    ${buildProjectSelect('', 'updated p')}`,
    [projectId, assignedTo],
  );
  return rows[0] ?? null;
}

export async function listCalculationsForProject(
  client: PoolClient,
  projectId: string,
  limit = 50,
): Promise<ProjectCalculationRow[]> {
  const { rows } = await client.query<ProjectCalculationRow>(
    `SELECT
       id, project_id, calculated_by, calculation_version,
       eui_result, total_energy_kwh, carbon_emission_kg,
       green_building_grade, input_snapshot, notes, calculated_at
     FROM project_calculations
    WHERE project_id = $1
    ORDER BY calculation_version DESC
    LIMIT $2`,
    [projectId, limit],
  );
  return rows;
}

export async function getNextCalculationVersion(client: PoolClient, projectId: string): Promise<number> {
  const { rows } = await client.query<{ next_version: number }>(
    `SELECT COALESCE(MAX(calculation_version), 0) + 1 AS next_version
       FROM project_calculations
      WHERE project_id = $1`,
    [projectId],
  );
  return Number(rows[0]?.next_version || 1);
}

export async function insertProjectCalculation(
  client: PoolClient,
  payload: ProjectCalculationInsertPayload,
): Promise<ProjectCalculationRow | null> {
  const version = await getNextCalculationVersion(client, payload.project_id);
  const { rows } = await client.query<ProjectCalculationRow>(
    `INSERT INTO project_calculations
      (
        project_id,
        calculated_by,
        calculation_version,
        eui_result,
        total_energy_kwh,
        carbon_emission_kg,
        green_building_grade,
        input_snapshot,
        notes
      )
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     RETURNING
      id,
      project_id,
      calculated_by,
      calculation_version,
      eui_result,
      total_energy_kwh,
      carbon_emission_kg,
      green_building_grade,
      input_snapshot,
      notes,
      calculated_at`,
    [
      payload.project_id,
      payload.calculated_by,
      version,
      payload.eui_result,
      payload.total_energy_kwh,
      payload.carbon_emission_kg,
      payload.green_building_grade,
      JSON.stringify(payload.input_snapshot || {}),
      payload.notes,
    ],
  );
  return rows[0] ?? null;
}
