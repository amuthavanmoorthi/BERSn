import type { Request } from 'express';

import pool from '../db.js';
import {
  findActiveBuildingTypeByCode,
  findActiveOrganizationById,
  findProjectById,
  findProjectMember,
  findProjectUserContext,
  findUserByUsername,
  insertProject,
  insertProjectAuditLog,
  insertProjectCalculation,
  listActiveBuildingTypes,
  listActiveOrganizations,
  listAllProjects,
  listAuditLogsForProject,
  listCalculationsForProject,
  listProjectMembers,
  listProjectsAssignedToUser,
  listProjectsByOrganization,
  revokeProjectMember,
  softDeleteProject,
  updateProjectAssignee,
  updateProjectInfo,
  updateProjectStatus,
  updateProjectWorkspaceSettings,
  upsertProjectMember,
} from '../models/projectModel.js';
import type {
  ProjectCalculationCreateInput,
  ProjectCreateInput,
  ProjectGeometryPreviewInput,
  ProjectInfoUpdateInput,
  ProjectWorkspaceSettingsInput,
} from '../schemas/projectSchemas.js';
import type { AuthenticatedRequestState, JsonObject, TimestampValue } from '../types/auth.js';
import type {
  BuildingTypeRow,
  BuildingTypeSummary,
  OrganizationRow,
  OrganizationSummary,
  ProjectCalculationRow,
  ProjectCalculationSummary,
  ProjectRow,
  ProjectStatus,
  ProjectUserContext,
} from '../types/projects.js';
import { AuthServiceError } from './authService.js';
import { buildGeometryPreviewLookupContext } from './configLookupService.js';
import { runGeometryPreviewInPython, type GeometryPreviewResult } from './pythonCalculationRunner.js';
import { isAdminRole, normalizeUserRole } from './userPolicy.js';

function getHeaderValue(req: Request, headerName: string): string | undefined {
  const rawValue = req.headers[headerName];
  if (Array.isArray(rawValue)) {
    return rawValue[0];
  }
  return rawValue;
}

function getIpAddress(req: Request): string | null {
  const rawIp = Array.isArray(req.ips) && req.ips.length > 0
    ? req.ips[0]
    : req.ip || req.socket.remoteAddress || null;
  const normalizedIp = rawIp ? String(rawIp).replace(/^::ffff:/, '') : null;
  return normalizedIp && normalizedIp !== 'unknown' ? normalizedIp : null;
}

function getRequestId(req: Request): string {
  return req.requestId || 'unknown';
}

function toDate(value: TimestampValue): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function isAgencyRole(role: string | undefined): boolean {
  return normalizeUserRole(role, '') === 'AGENCY_USER';
}

function isVendorRole(role: string | undefined): boolean {
  return normalizeUserRole(role, '') === 'VENDOR_USER';
}

function toBuildingTypeSummary(row: BuildingTypeRow): BuildingTypeSummary {
  return {
    id: row.id,
    code: row.code,
    labelZh: row.label_zh,
    labelEn: row.label_en,
    euiBaseline: Number(row.eui_baseline),
    isActive: row.is_active,
    sortOrder: row.sort_order,
    status: row.status ?? 'ready',
    source: 'PostgreSQL building_types reference table',
    verificationStatus: 'BACKEND_REFERENCE_DB',
  };
}

function toOrganizationSummary(row: OrganizationRow): OrganizationSummary {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    isActive: row.is_active,
    createdAt: toDate(row.created_at).toISOString(),
  };
}

/**
 * Generate a starter floor with a single rectangular box shape whose
 * footprint area approximates the given total floor area (m²).
 *
 * Rule: keep the building roughly square but favour multiples of 5 m.
 * e.g. 8500 m² → width=90, length=95 (actual = 8550 ≈ 8500)
 */
function buildStarterFloor(totalFloorAreaM2: number) {
  const area = Math.max(1, totalFloorAreaM2);
  const rawSide = Math.sqrt(area);
  // Round each dimension to the nearest 5 m for clean grid alignment.
  const width = Math.max(5, Math.round(rawSide / 5) * 5);
  const length = Math.max(5, Math.ceil(area / width / 5) * 5);

  return [
    {
      id: 'floor-1',
      name: '1F',
      floorHeight: 4.5,
      shapes: [
        {
          id: 'shape-default',
          type: 'box',
          params: {
            width,
            length,
            height: 4.5,
            azimuth: 0,
            wwr: 0.35,
          },
          position: { x: 0, y: 0 },
          rotation: 0,
        },
      ],
    },
  ];
}

function toProjectSummary(row: ProjectRow) {
  return {
    id: row.id,
    projectName: row.project_name,
    organization: row.organization,
    organizationId: row.organization_id,
    location: row.location,
    status: row.status,
    createdBy: row.created_by,
    creatorUsername: row.creator_username,
    assignedTo: row.assigned_to,
    totalFloorArea: Number(row.total_floor_area),
    createdAt: toDate(row.created_at).toISOString(),
    updatedAt: toDate(row.updated_at).toISOString(),
    workspaceSavedAt: row.workspace_saved_at ? toDate(row.workspace_saved_at).toISOString() : null,
    buildingType: {
      code: row.building_type_code,
      labelZh: row.building_type_label_zh,
      labelEn: row.building_type_label_en,
      euiBaseline: Number(row.building_type_eui_baseline),
    },
    latestCalculationAt: row.latest_calculation_at ? toDate(row.latest_calculation_at).toISOString() : null,
    latestCalculation: {
      eeiResult: toNumber(row.latest_eui_result),
      grade: row.latest_grade,
    },
    selectedRegion: row.selected_region,
    selectedUseCategory: row.selected_use_category,
    selectedWall: row.selected_wall,
    selectedRoof: row.selected_roof,
    selectedShading: row.selected_shading,
    selectedGlazing: row.selected_glazing,
    selectedHvac: row.selected_hvac,
    selectedLighting: row.selected_lighting,
    selectedElevator: row.selected_elevator,
    selectedDhw: row.selected_dhw,
    elevatorCount: Number(row.elevator_count),
    exemptAreas: row.exempt_areas ?? [],
    floors: row.floors ?? [],
    geometryObjects: row.geometry_objects ?? [],
  };
}

function toCalculationSummary(row: ProjectCalculationRow): ProjectCalculationSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    calculatedBy: row.calculated_by,
    calculationVersion: Number(row.calculation_version),
    euiResult: toNumber(row.eui_result),
    totalEnergyKwh: toNumber(row.total_energy_kwh),
    carbonEmissionKg: toNumber(row.carbon_emission_kg),
    grade: row.green_building_grade,
    inputSnapshot: row.input_snapshot,
    notes: row.notes,
    calculatedAt: toDate(row.calculated_at).toISOString(),
  };
}

async function requireProjectUser(
  authState: AuthenticatedRequestState,
  requestId: string,
): Promise<ProjectUserContext> {
  const client = await pool.connect();
  try {
    const user = await findProjectUserContext(client, authState.user.id);
    if (!user) {
      throw new AuthServiceError(
        401,
        'BERSN_AUTH_TOKEN_INVALID',
        'Authentication required.',
        { request_id: requestId },
      );
    }
    return user;
  } finally {
    client.release();
  }
}

function assertCanViewProject(user: ProjectUserContext, project: ProjectRow, requestId: string): void {
  if (isAdminRole(user.role)) {
    return;
  }
  if (isAgencyRole(user.role) && project.organization_id && project.organization_id === user.organization_id) {
    return;
  }
  if (isVendorRole(user.role) && project.assigned_to === user.id) {
    return;
  }
  throw new AuthServiceError(
    403,
    'BERSN_PROJECT_FORBIDDEN',
    'You do not have permission to access this project.',
    { request_id: requestId },
  );
}

function assertCanCalculateProject(user: ProjectUserContext, project: ProjectRow, requestId: string): void {
  if (isAdminRole(user.role)) {
    return;
  }
  if (isAgencyRole(user.role) && project.created_by === user.id) {
    return;
  }
  throw new AuthServiceError(
    403,
    'BERSN_PROJECT_CALC_FORBIDDEN',
    'You do not have permission to calculate this project.',
    { request_id: requestId },
  );
}

function buildChangedFields(fromStatus: ProjectStatus | null, toStatus: ProjectStatus): JsonObject {
  if (!fromStatus) {
    return {};
  }
  return {
    status: {
      from: fromStatus,
      to: toStatus,
    },
  };
}

function buildProjectInfoChangedFields(currentProject: ProjectRow, nextProject: ProjectRow): JsonObject {
  const changedFields: JsonObject = {};
  if (currentProject.project_name !== nextProject.project_name) {
    changedFields.project_name = {
      from: currentProject.project_name,
      to: nextProject.project_name,
    };
  }
  if ((currentProject.location || null) !== (nextProject.location || null)) {
    changedFields.location = {
      from: currentProject.location || null,
      to: nextProject.location || null,
    };
  }
  if (currentProject.building_type_code !== nextProject.building_type_code) {
    changedFields.building_type_code = {
      from: currentProject.building_type_code,
      to: nextProject.building_type_code,
    };
  }
  return changedFields;
}

// BERS 7-level grade scale matching the frontend calculationEngine and BERSn manual.
// score is derived from EUI ratio; higher score = better grade.
function getGradeFromEuiRatio(euiResult: number, baseline: number): '1+' | '1' | '2' | '3' | '4' | '5' | '6' | '7' {
  const ratio = baseline > 0 ? euiResult / baseline : 1;
  // Convert ratio to a score approximation (mirrors calculationEngine.ts logic)
  const score = ratio <= 1
    ? 50 + 40 * (1 - ratio) / 0.5       // ratio ≤ 1 → score 50..90
    : 50 * (2 - Math.min(ratio, 2));     // ratio > 1 → score 0..50
  if (score >= 90) return '1+';
  if (score >= 80) return '1';
  if (score >= 70) return '2';
  if (score >= 60) return '3';
  if (score >= 50) return '4';
  if (score >= 40) return '5';
  if (score >= 30) return '6';
  return '7';
}

export async function getBuildingTypes(): Promise<BuildingTypeSummary[]> {
  const client = await pool.connect();
  try {
    const rows = await listActiveBuildingTypes(client);
    return rows.map(toBuildingTypeSummary);
  } finally {
    client.release();
  }
}

export async function getOrganizationsForUser(
  req: Request,
  authState: AuthenticatedRequestState,
): Promise<OrganizationSummary[]> {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    if (isAdminRole(user.role)) {
      const rows = await listActiveOrganizations(client);
      return rows.map(toOrganizationSummary);
    }
    if (!user.organization_id) {
      return [];
    }
    const organization = await findActiveOrganizationById(client, user.organization_id);
    return organization ? [toOrganizationSummary(organization)] : [];
  } finally {
    client.release();
  }
}

export async function listProjectsForUser(
  req: Request,
  authState: AuthenticatedRequestState,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    const rows = isAdminRole(user.role)
      ? await listAllProjects(client)
      : isAgencyRole(user.role) && user.organization_id
        ? await listProjectsByOrganization(client, user.organization_id)
        : await listProjectsAssignedToUser(client, user.id);
    return rows.map(toProjectSummary);
  } finally {
    client.release();
  }
}

export async function createProjectForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  input: ProjectCreateInput,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const buildingType = await findActiveBuildingTypeByCode(client, input.building_type_code);
    if (!buildingType) {
      throw new AuthServiceError(
        400,
        'BERSN_PROJECT_BUILDING_TYPE_INVALID',
        'Building type is invalid or inactive.',
        { request_id: requestId },
      );
    }

    let organizationId = input.organization_id || user.organization_id;
    if (!organizationId) {
      throw new AuthServiceError(
        400,
        'BERSN_PROJECT_ORGANIZATION_REQUIRED',
        'A verified organization is required before creating projects.',
        { request_id: requestId },
      );
    }

    if (!isAdminRole(user.role) && organizationId !== user.organization_id) {
      throw new AuthServiceError(
        403,
        'BERSN_PROJECT_ORG_FORBIDDEN',
        'You can create projects only for your own organization.',
        { request_id: requestId },
      );
    }

    const organization = await findActiveOrganizationById(client, organizationId);
    if (!organization) {
      throw new AuthServiceError(
        400,
        'BERSN_PROJECT_ORGANIZATION_INVALID',
        'Organization is invalid or inactive.',
        { request_id: requestId },
      );
    }

    organizationId = organization.id;
    const assignedTo = isVendorRole(user.role)
      ? user.id
      : isAdminRole(user.role)
        ? input.assigned_to || null
        : null;

    const project = await insertProject(client, {
      project_name: input.project_name,
      organization: organization.name,
      organization_id: organizationId,
      location: input.location || null,
      building_type_code: buildingType.code,
      total_floor_area: input.total_floor_area,
      created_by: user.id,
      assigned_to: assignedTo,
    });

    if (!project) {
      throw new AuthServiceError(
        500,
        'BERSN_API_INTERNAL_ERROR',
        'Internal server error.',
        { request_id: requestId },
      );
    }

    await insertProjectAuditLog(client, {
      project_id: project.id,
      user_id: user.id,
      action: 'CREATED',
      ip_address: getIpAddress(req),
      changed_fields: {
        project_name: { from: null, to: project.project_name },
        organization_id: { from: null, to: project.organization_id },
        building_type_code: { from: null, to: project.building_type_code },
        total_floor_area: { from: null, to: Number(project.total_floor_area) },
      },
    });

    await client.query('COMMIT');
    return toProjectSummary(project);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: requestId },
    );
  } finally {
    client.release();
  }
}

export async function getProjectForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    const project = await findProjectById(client, projectId);
    if (!project) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }
    assertCanViewProject(user, project, requestId);

    const summary = toProjectSummary(project);

    // For brand-new projects (never saved, no geometry at all), inject a starter
    // floor whose box footprint matches the declared total_floor_area.
    // Once the user saves any workspace change, workspace_saved_at is set and
    // this branch is skipped forever.
    const hasNoFloors = Array.isArray(summary.floors) && summary.floors.length === 0;
    const hasNoGeometry = Array.isArray(summary.geometryObjects) && summary.geometryObjects.length === 0;
    const neverSaved = !project.workspace_saved_at;
    const hasArea = Number(project.total_floor_area) > 0;

    if (hasNoFloors && hasNoGeometry && neverSaved && hasArea) {
      summary.floors = buildStarterFloor(Number(project.total_floor_area));
    }

    return summary;
  } finally {
    client.release();
  }
}

export async function updateProjectInfoForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  input: ProjectInfoUpdateInput,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentProject = await findProjectById(client, projectId);
    if (!currentProject) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }
    assertCanViewProject(user, currentProject, requestId);
    if (currentProject.status !== 'DRAFT') {
      throw new AuthServiceError(
        409,
        'BERSN_PROJECT_STATUS_LOCKED',
        'Project details can only be modified while the project is in draft status.',
        { request_id: requestId, status: currentProject.status },
      );
    }

    const buildingType = await findActiveBuildingTypeByCode(client, input.building_type_code);
    if (!buildingType) {
      throw new AuthServiceError(
        400,
        'BERSN_PROJECT_BUILDING_TYPE_INVALID',
        'Building type is invalid or inactive.',
        { request_id: requestId },
      );
    }

    const project = await updateProjectInfo(client, projectId, {
      project_name: input.project_name,
      location: input.location || null,
      building_type_code: buildingType.code,
    });

    if (!project) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }

    await insertProjectAuditLog(client, {
      project_id: project.id,
      user_id: user.id,
      action: 'UPDATED',
      ip_address: getIpAddress(req),
      changed_fields: buildProjectInfoChangedFields(currentProject, project),
    });

    await client.query('COMMIT');
    return toProjectSummary(project);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: requestId },
    );
  } finally {
    client.release();
  }
}

export async function updateProjectStatusForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  status: ProjectStatus,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentProject = await findProjectById(client, projectId);
    if (!currentProject) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }
    assertCanViewProject(user, currentProject, requestId);
    if (status === 'APPROVED' && !isAdminRole(user.role)) {
      throw new AuthServiceError(
        403,
        'BERSN_PROJECT_APPROVE_FORBIDDEN',
        'Only system administrators can approve projects.',
        { request_id: requestId },
      );
    }

    const project = await updateProjectStatus(client, projectId, status);
    if (!project) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }

    await insertProjectAuditLog(client, {
      project_id: project.id,
      user_id: user.id,
      action: status === 'APPROVED' ? 'APPROVED' : status === 'IN_REVIEW' ? 'SUBMITTED' : 'UPDATED',
      ip_address: getIpAddress(req),
      changed_fields: buildChangedFields(currentProject.status, project.status),
    });

    await client.query('COMMIT');
    return toProjectSummary(project);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: requestId },
    );
  } finally {
    client.release();
  }
}

export async function softDeleteProjectForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentProject = await findProjectById(client, projectId);
    if (!currentProject) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }
    assertCanViewProject(user, currentProject, requestId);

    const project = await softDeleteProject(client, projectId);
    if (!project) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }

    await insertProjectAuditLog(client, {
      project_id: project.id,
      user_id: user.id,
      action: 'DELETED',
      ip_address: getIpAddress(req),
      changed_fields: {
        is_deleted: { from: false, to: true },
        status: { from: currentProject.status, to: project.status },
      },
    });
    await client.query('COMMIT');
    return toProjectSummary(project);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: requestId },
    );
  } finally {
    client.release();
  }
}

export async function createProjectCalculationForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  input: ProjectCalculationCreateInput,
): Promise<ProjectCalculationSummary> {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await findProjectById(client, projectId);
    if (!project) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }
    assertCanCalculateProject(user, project, requestId);

    const baselineEui = Number(project.building_type_eui_baseline);
    const floorArea = Number(project.total_floor_area);
    const euiResult = input.eui_result !== undefined ? input.eui_result : baselineEui;
    const totalEnergyKwh = input.total_energy_kwh !== undefined
      ? input.total_energy_kwh
      : round(euiResult * floorArea, 4);
    const carbonEmissionKg = input.carbon_emission_kg !== undefined
      ? input.carbon_emission_kg
      : round(totalEnergyKwh * 0.509, 4);
    const grade = input.green_building_grade || getGradeFromEuiRatio(euiResult, baselineEui);
    const snapshot = {
      project: {
        id: project.id,
        project_name: project.project_name,
        organization: project.organization,
        building_type_code: project.building_type_code,
        total_floor_area: floorArea,
        baseline_eui: baselineEui,
      },
      // Full workspace state at the time of calculation — enables reconstruction.
      geometry: {
        floors: project.floors ?? [],
        geometry_objects: project.geometry_objects ?? [],
        exempt_areas: project.exempt_areas ?? [],
      },
      envelope: {
        selected_wall: project.selected_wall,
        selected_roof: project.selected_roof,
        selected_shading: project.selected_shading,
        selected_glazing: project.selected_glazing,
      },
      mep: {
        selected_hvac: project.selected_hvac,
        selected_lighting: project.selected_lighting,
        selected_elevator: project.selected_elevator,
        selected_dhw: project.selected_dhw,
        elevator_count: project.elevator_count,
      },
      region: project.selected_region,
      use_category: project.selected_use_category,
      request: input.input_snapshot || {},
      request_id: requestId,
      user_agent: getHeaderValue(req, 'user-agent') || null,
    };

    const calculation = await insertProjectCalculation(client, {
      project_id: project.id,
      calculated_by: user.id,
      eui_result: round(euiResult, 4),
      total_energy_kwh: totalEnergyKwh,
      carbon_emission_kg: carbonEmissionKg,
      green_building_grade: grade,
      input_snapshot: snapshot,
      notes: input.notes || null,
    });

    if (!calculation) {
      throw new AuthServiceError(
        500,
        'BERSN_API_INTERNAL_ERROR',
        'Internal server error.',
        { request_id: requestId },
      );
    }

    await insertProjectAuditLog(client, {
      project_id: project.id,
      user_id: user.id,
      action: 'CALCULATED',
      ip_address: getIpAddress(req),
      changed_fields: {
        calculation_version: { from: null, to: calculation.calculation_version },
        eui_result: { from: null, to: euiResult },
        green_building_grade: { from: null, to: grade },
      },
    });
    await client.query('COMMIT');

    return toCalculationSummary(calculation);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: requestId },
    );
  } finally {
    client.release();
  }
}

export async function updateProjectWorkspaceSettingsForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  input: ProjectWorkspaceSettingsInput,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const currentProject = await findProjectById(client, projectId);
    if (!currentProject) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }
    assertCanViewProject(user, currentProject, requestId);
    if (currentProject.status !== 'DRAFT') {
      throw new AuthServiceError(
        409,
        'BERSN_PROJECT_STATUS_LOCKED',
        'Workspace settings can only be modified while the project is in draft status.',
        { request_id: requestId, status: currentProject.status },
      );
    }

    const project = await updateProjectWorkspaceSettings(client, projectId, {
      selected_region: input.selected_region,
      selected_use_category: input.selected_use_category,
      selected_wall: input.selected_wall,
      selected_roof: input.selected_roof,
      selected_shading: input.selected_shading,
      selected_glazing: input.selected_glazing,
      selected_hvac: input.selected_hvac,
      selected_lighting: input.selected_lighting,
      selected_elevator: input.selected_elevator,
      selected_dhw: input.selected_dhw,
      elevator_count: input.elevator_count,
      exempt_areas: input.exempt_areas,
      floors: input.floors ?? [],
      geometry_objects: input.geometry_objects,
    });

    if (!project) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }

    await insertProjectAuditLog(client, {
      project_id: project.id,
      user_id: user.id,
      action: 'UPDATED',
      ip_address: getIpAddress(req),
      changed_fields: { workspace_settings: true },
    });

    await client.query('COMMIT');
    return toProjectSummary(project);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof AuthServiceError) {
      throw error;
    }
    throw new AuthServiceError(
      500,
      'BERSN_API_INTERNAL_ERROR',
      'Internal server error.',
      { request_id: requestId },
    );
  } finally {
    client.release();
  }
}

export async function previewProjectGeometryForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  input: ProjectGeometryPreviewInput,
): Promise<GeometryPreviewResult> {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    const project = await findProjectById(client, projectId);
    if (!project) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }
    assertCanViewProject(user, project, requestId);
    if (project.status !== 'DRAFT') {
      throw new AuthServiceError(
        409,
        'BERSN_PROJECT_STATUS_LOCKED',
        'Geometry preview is available only while the project is in draft status.',
        { request_id: requestId, status: project.status },
      );
    }

    return await runGeometryPreviewInPython(
      {
        floor_height_m: input.floor_height_m,
        envelope: input.envelope,
        lookupContext: buildGeometryPreviewLookupContext(input),
        mep: input.mep,
        objects: input.objects,
        project: {
          ...input.project,
        },
        projectRecord: {
          id: project.id,
          building_type_code: project.building_type_code,
          building_type_label_en: project.building_type_label_en,
          building_type_label_zh: project.building_type_label_zh,
          building_type_eui_baseline: Number(project.building_type_eui_baseline),
          organization_id: project.organization_id,
          organization: project.organization,
          project_name: project.project_name,
          status: project.status,
        },
      },
      requestId,
    );
  } finally {
    client.release();
  }
}

export async function getDashboardStatsForUser(
  req: Request,
  authState: AuthenticatedRequestState,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    // Build a WHERE clause scoped to what this role can see.
    let whereClause = 'WHERE p.is_deleted = FALSE';
    const params: unknown[] = [];
    if (isAgencyRole(user.role) && user.organization_id) {
      params.push(user.organization_id);
      whereClause += ` AND p.organization_id = $${params.length}`;
    } else if (isVendorRole(user.role)) {
      params.push(user.id);
      whereClause += ` AND p.assigned_to = $${params.length}`;
    }

    const { rows } = await client.query<{
      status: string;
      cnt: string;
      avg_eui: string | null;
      total_area: string;
    }>(
      `SELECT
         p.status,
         COUNT(*)                              AS cnt,
         AVG(pc.eui_result)                   AS avg_eui,
         SUM(p.total_floor_area)              AS total_area
       FROM projects p
       LEFT JOIN LATERAL (
         SELECT eui_result
           FROM project_calculations
          WHERE project_id = p.id
          ORDER BY calculation_version DESC
          LIMIT 1
       ) pc ON TRUE
       ${whereClause}
       GROUP BY p.status`,
      params,
    );

    const { rows: gradeRows } = await client.query<{ grade: string | null; cnt: string }>(
      `SELECT pc.green_building_grade AS grade, COUNT(*) AS cnt
         FROM projects p
         JOIN LATERAL (
           SELECT green_building_grade
             FROM project_calculations
            WHERE project_id = p.id
            ORDER BY calculation_version DESC
            LIMIT 1
         ) pc ON TRUE
         ${whereClause}
         GROUP BY pc.green_building_grade`,
      params,
    );

    const { rows: recentRows } = await client.query<{
      project_id: string;
      project_name: string;
      action: string;
      created_at: TimestampValue;
      username: string | null;
    }>(
      `SELECT
         al.project_id,
         p.project_name,
         al.action,
         al.created_at,
         u.username
       FROM project_audit_logs al
       JOIN projects p ON p.id = al.project_id
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause.replace(/p\./g, 'p.')}
       ORDER BY al.created_at DESC
       LIMIT 10`,
      params,
    );

    const byStatus: Record<string, number> = {};
    let totalArea = 0;
    let totalEuiSum = 0;
    let totalEuiCount = 0;
    let totalProjects = 0;

    for (const row of rows) {
      byStatus[row.status] = Number(row.cnt);
      totalArea += Number(row.total_area || 0);
      totalProjects += Number(row.cnt);
      if (row.avg_eui !== null) {
        totalEuiSum += Number(row.avg_eui) * Number(row.cnt);
        totalEuiCount += Number(row.cnt);
      }
    }

    const byGrade: Record<string, number> = {};
    for (const row of gradeRows) {
      byGrade[row.grade ?? 'unrated'] = Number(row.cnt);
    }

    return {
      totalProjects,
      byStatus,
      byGrade,
      totalFloorAreaM2: round(totalArea, 2),
      averageEui: totalEuiCount > 0 ? round(totalEuiSum / totalEuiCount, 4) : null,
      recentActivity: recentRows.map((r) => ({
        projectId: r.project_id,
        projectName: r.project_name,
        action: r.action,
        username: r.username,
        at: toDate(r.created_at).toISOString(),
      })),
    };
  } finally {
    client.release();
  }
}

export async function listProjectAuditLogsForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    const project = await findProjectById(client, projectId);
    if (!project) {
      throw new AuthServiceError(404, 'BERSN_PROJECT_NOT_FOUND', 'Project not found.', { request_id: requestId });
    }
    assertCanViewProject(user, project, requestId);
    const rows = await listAuditLogsForProject(client, projectId);
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      userId: r.user_id,
      username: r.username,
      action: r.action,
      changedFields: r.changed_fields,
      ipAddress: r.ip_address,
      at: toDate(r.created_at).toISOString(),
    }));
  } finally {
    client.release();
  }
}

export async function assignProjectToUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  targetUserId: string | null,
) {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  if (!isAdminRole(user.role)) {
    throw new AuthServiceError(403, 'BERSN_AUTH_FORBIDDEN', 'Only admins can assign projects.', { request_id: requestId });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await findProjectById(client, projectId);
    if (!project) {
      throw new AuthServiceError(404, 'BERSN_PROJECT_NOT_FOUND', 'Project not found.', { request_id: requestId });
    }
    const updated = await updateProjectAssignee(client, projectId, targetUserId);
    if (!updated) {
      throw new AuthServiceError(404, 'BERSN_PROJECT_NOT_FOUND', 'Project not found.', { request_id: requestId });
    }
    await insertProjectAuditLog(client, {
      project_id: projectId,
      user_id: user.id,
      action: 'UPDATED',
      ip_address: getIpAddress(req),
      changed_fields: { assigned_to: { from: project.assigned_to, to: targetUserId } },
    });
    await client.query('COMMIT');
    return toProjectSummary(updated);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof AuthServiceError) throw error;
    throw new AuthServiceError(500, 'BERSN_API_INTERNAL_ERROR', 'Internal server error.', { request_id: requestId });
  } finally {
    client.release();
  }
}

export async function listProjectCalculationsForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
): Promise<ProjectCalculationSummary[]> {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    const project = await findProjectById(client, projectId);
    if (!project) {
      throw new AuthServiceError(
        404,
        'BERSN_PROJECT_NOT_FOUND',
        'Project not found.',
        { request_id: requestId },
      );
    }
    assertCanViewProject(user, project, requestId);
    const rows = await listCalculationsForProject(client, projectId);
    return rows.map(toCalculationSummary);
  } finally {
    client.release();
  }
}

// ──────────────────────────────────────────────────────────────────
// Project sharing & membership
// ──────────────────────────────────────────────────────────────────

import type { ProjectMemberShareInput } from '../schemas/projectSchemas.js';
import type { ProjectMemberSummary, ProjectPermission } from '../types/projects.js';

function toMemberSummary(row: import('../types/projects.js').ProjectMemberRow): ProjectMemberSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    username: row.username ?? null,
    permission: row.permission,
    invitedBy: row.invited_by,
    invitedAt: toDate(row.invited_at).toISOString(),
    acceptedAt: row.accepted_at ? toDate(row.accepted_at).toISOString() : null,
  };
}

/** Returns the effective permission of the requesting user on a project. */
async function effectivePermission(
  client: import('pg').PoolClient,
  user: ProjectUserContext,
  project: ProjectRow,
): Promise<ProjectPermission | 'owner' | null> {
  if (isAdminRole(user.role)) return 'admin';
  if (project.created_by === user.id) return 'owner';
  if (isAgencyRole(user.role) && project.organization_id && project.organization_id === user.organization_id) {
    return 'editor';
  }
  if (isVendorRole(user.role) && project.assigned_to === user.id) return 'editor';
  const member = await findProjectMember(client, project.id, user.id);
  if (member && !member.revoked_at) return member.permission;
  return null;
}

export async function listProjectMembersForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
): Promise<ProjectMemberSummary[]> {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    const project = await findProjectById(client, projectId);
    if (!project) {
      throw new AuthServiceError(404, 'BERSN_PROJECT_NOT_FOUND', 'Project not found.', { request_id: requestId });
    }
    const perm = await effectivePermission(client, user, project);
    if (!perm) {
      throw new AuthServiceError(403, 'BERSN_PROJECT_FORBIDDEN', 'You do not have access to this project.', { request_id: requestId });
    }
    const rows = await listProjectMembers(client, projectId);
    return rows.map(toMemberSummary);
  } finally {
    client.release();
  }
}

export async function shareProjectWithUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  input: ProjectMemberShareInput,
): Promise<ProjectMemberSummary> {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await findProjectById(client, projectId);
    if (!project) {
      throw new AuthServiceError(404, 'BERSN_PROJECT_NOT_FOUND', 'Project not found.', { request_id: requestId });
    }
    const perm = await effectivePermission(client, user, project);
    if (perm !== 'owner' && perm !== 'admin') {
      throw new AuthServiceError(403, 'BERSN_PROJECT_FORBIDDEN', 'Only owner or admin can share a project.', { request_id: requestId });
    }

    const target = await findUserByUsername(client, input.username);
    if (!target) {
      throw new AuthServiceError(404, 'BERSN_USER_NOT_FOUND', `User '${input.username}' not found.`, { request_id: requestId });
    }
    if (target.id === project.created_by) {
      throw new AuthServiceError(400, 'BERSN_API_VALIDATION_ERROR', 'Cannot share with project owner.', { request_id: requestId });
    }

    const existing = await findProjectMember(client, projectId, target.id);
    const member = await upsertProjectMember(client, {
      project_id: projectId,
      user_id: target.id,
      permission: input.permission,
      invited_by: user.id,
    });
    if (!member) {
      throw new AuthServiceError(500, 'BERSN_API_INTERNAL_ERROR', 'Failed to share project.', { request_id: requestId });
    }

    await insertProjectAuditLog(client, {
      project_id: projectId,
      user_id: user.id,
      action: existing ? 'PERMISSION_CHANGED' : 'SHARED',
      ip_address: getIpAddress(req),
      changed_fields: {
        target_user: target.username,
        permission: existing
          ? { from: existing.permission, to: input.permission }
          : { from: null, to: input.permission },
      },
    });
    await client.query('COMMIT');
    return toMemberSummary({ ...member, username: target.username });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof AuthServiceError) throw error;
    throw new AuthServiceError(500, 'BERSN_API_INTERNAL_ERROR', 'Internal server error.', { request_id: getRequestId(req) });
  } finally {
    client.release();
  }
}

export async function revokeProjectMemberForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  targetUserId: string,
): Promise<void> {
  const requestId = getRequestId(req);
  const user = await requireProjectUser(authState, requestId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const project = await findProjectById(client, projectId);
    if (!project) {
      throw new AuthServiceError(404, 'BERSN_PROJECT_NOT_FOUND', 'Project not found.', { request_id: requestId });
    }
    const perm = await effectivePermission(client, user, project);
    if (perm !== 'owner' && perm !== 'admin') {
      throw new AuthServiceError(403, 'BERSN_PROJECT_FORBIDDEN', 'Only owner or admin can revoke access.', { request_id: requestId });
    }
    const ok = await revokeProjectMember(client, projectId, targetUserId);
    if (!ok) {
      throw new AuthServiceError(404, 'BERSN_USER_NOT_FOUND', 'Member not found or already revoked.', { request_id: requestId });
    }
    await insertProjectAuditLog(client, {
      project_id: projectId,
      user_id: user.id,
      action: 'UNSHARED',
      ip_address: getIpAddress(req),
      changed_fields: { revoked_user_id: targetUserId },
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof AuthServiceError) throw error;
    throw new AuthServiceError(500, 'BERSN_API_INTERNAL_ERROR', 'Internal server error.', { request_id: getRequestId(req) });
  } finally {
    client.release();
  }
}
