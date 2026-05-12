import type { Request } from 'express';
import type { PoolClient } from 'pg';

import pool from '../db.js';
import {
  findMeasureById,
  findMeasuresByIds,
  findScenarioById,
  insertScenario,
  insertScenarioMeasures,
  insertScenarioResult,
  listActiveMeasures,
  listScenarioMeasureIds,
  listScenariosForProject,
  deleteScenarioById,
  findLatestScenarioResult,
  type MeasureRow,
  type ProjectScenarioRow,
  type ScenarioResultRow,
} from '../models/optimizationModel.js';
import { findProjectById, findProjectUserContext } from '../models/projectModel.js';
import type { ScenarioCreateInput } from '../schemas/optimizationSchemas.js';
import type { AuthenticatedRequestState, TimestampValue } from '../types/auth.js';
import type { ProjectRow, ProjectUserContext } from '../types/projects.js';
import { AuthServiceError } from './authService.js';
import { buildGeometryPreviewLookupContext } from './configLookupService.js';
import {
  runGeometryPreviewInPython,
  type GeometryPreviewResult,
  type GeometryPreviewVariantSummary,
} from './pythonCalculationRunner.js';
import { isAdminRole, normalizeUserRole } from './userPolicy.js';

// ── Shared types returned to controllers ───────────────────────────────────────

export interface MeasureSummary {
  id: string;
  nameZh: string;
  nameEn: string;
  category: string;
  descriptionZh: string;
  descriptionEn: string;
  eligibility: Record<string, unknown>;
  patches: Array<{ section: string; field: string; value: unknown }>;
  costModel: { type: string; unitCost: number };
  sortOrder: number;
}

export interface ScenarioSummary {
  id: string;
  projectId: string;
  name: string;
  selectedMeasureIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  latestResult: ScenarioResultSummary | null;
}

export interface ScenarioResultSummary {
  scenarioId: string;
  simulatedEEI: number;
  simulatedScore: number;
  simulatedGrade: string;
  totalCostTwd: number;
  cpValue: number;
  baselineEEI: number | null;
  computedAt: string;
}

export interface MeasureImpactSummary {
  measureId: string;
  deltaEEI: number;
  deltaScore: number;
  cost: number;
  cpValue: number;
  isEligible: boolean;
  ineligibleReason?: string;
  simulatedEEI?: number;
  simulatedGrade?: string;
}

export interface MeasureSimulationBundle {
  baselineEEI: number;
  baselineScore: number;
  baselineGrade: string;
  metrics: {
    totalWallArea: number;
    totalWindowArea: number;
    roofArea: number;
    overallWwr: number;
    estimatedFloorArea: number;
  };
  impacts: MeasureImpactSummary[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRequestId(req: Request): string {
  return req.requestId || 'unknown';
}

function toDate(value: TimestampValue): Date {
  return value instanceof Date ? value : new Date(value);
}

function toJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toPatchList(value: unknown): MeasureSummary['patches'] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      section: String(entry.section ?? ''),
      field: String(entry.field ?? ''),
      value: entry.value ?? null,
    }));
}

function toCostModel(value: unknown): MeasureSummary['costModel'] {
  const obj = toJsonObject(value);
  return {
    type: String(obj.type ?? 'FIXED'),
    unitCost: Number(obj.unitCost ?? 0) || 0,
  };
}

function toMeasureSummary(row: MeasureRow): MeasureSummary {
  return {
    id: row.id,
    nameZh: row.name_zh,
    nameEn: row.name_en,
    category: row.category,
    descriptionZh: row.description_zh,
    descriptionEn: row.description_en,
    eligibility: toJsonObject(row.eligibility),
    patches: toPatchList(row.patches),
    costModel: toCostModel(row.cost_model),
    sortOrder: row.sort_order,
  };
}

function toScenarioResultSummary(row: ScenarioResultRow): ScenarioResultSummary {
  return {
    scenarioId: row.scenario_id,
    simulatedEEI: Number(row.simulated_eei),
    simulatedScore: Number(row.simulated_score),
    simulatedGrade: row.simulated_grade,
    totalCostTwd: Number(row.total_cost_twd),
    cpValue: Number(row.cp_value),
    baselineEEI: row.baseline_eei !== null ? Number(row.baseline_eei) : null,
    computedAt: toDate(row.computed_at).toISOString(),
  };
}

function isAgencyRole(role: string | undefined): boolean {
  return normalizeUserRole(role, '') === 'AGENCY_USER';
}

function isVendorRole(role: string | undefined): boolean {
  return normalizeUserRole(role, '') === 'VENDOR_USER';
}

async function requireOptimizationUser(
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
  if (isAdminRole(user.role)) return;
  if (isAgencyRole(user.role) && project.organization_id && project.organization_id === user.organization_id) return;
  if (isVendorRole(user.role) && project.assigned_to === user.id) return;
  throw new AuthServiceError(
    403,
    'BERSN_PROJECT_FORBIDDEN',
    'You do not have permission to access this project.',
    { request_id: requestId },
  );
}

function assertCanEditScenarios(user: ProjectUserContext, project: ProjectRow, requestId: string): void {
  if (isAdminRole(user.role)) return;
  if (isAgencyRole(user.role) && project.created_by === user.id) return;
  throw new AuthServiceError(
    403,
    'BERSN_SCENARIO_FORBIDDEN',
    'You do not have permission to edit scenarios for this project.',
    { request_id: requestId },
  );
}

interface PreviewPayloadShape {
  floor_height_m: number;
  envelope: Record<string, string>;
  lookupContext: unknown;
  mep: Record<string, string | number>;
  objects: unknown[];
  project: Record<string, unknown>;
  projectRecord: Record<string, unknown>;
}

function buildPreviewPayload(project: ProjectRow): PreviewPayloadShape {
  const input = {
    floor_height_m: 3.5,
    envelope: {
      selected_glazing: project.selected_glazing,
      selected_roof: project.selected_roof,
      selected_shading: project.selected_shading,
      selected_wall: project.selected_wall,
    },
    mep: {
      elevator_count: Number(project.elevator_count) || 0,
      selected_dhw: project.selected_dhw,
      selected_elevator: project.selected_elevator,
      selected_hvac: project.selected_hvac,
      selected_lighting: project.selected_lighting,
    },
    objects: Array.isArray(project.geometry_objects) ? project.geometry_objects : [],
    project: {
      exempt_areas: Array.isArray(project.exempt_areas) ? project.exempt_areas : [],
      selected_region: project.selected_region,
      selected_use_category: project.selected_use_category,
      total_floor_area: Number(project.total_floor_area) || undefined,
    },
  };

  return {
    floor_height_m: input.floor_height_m,
    envelope: input.envelope,
    lookupContext: buildGeometryPreviewLookupContext(input as Parameters<typeof buildGeometryPreviewLookupContext>[0]),
    mep: input.mep,
    objects: input.objects,
    project: input.project,
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
  };
}

function readBaselineEEI(result: GeometryPreviewResult): { eei: number; score: number; grade: string } {
  const performance = result.performance && typeof result.performance === 'object'
    ? (result.performance as Record<string, unknown>)
    : {};
  const kpis = performance.kpis && typeof performance.kpis === 'object'
    ? (performance.kpis as Record<string, unknown>)
    : {};
  return {
    eei: Number(kpis.eei ?? 0),
    score: Number(kpis.score ?? 0),
    grade: String(kpis.grade ?? '-'),
  };
}

function computeMeasureCost(costModel: MeasureSummary['costModel'], metrics: GeometryPreviewResult['metrics']): number {
  const { type, unitCost } = costModel;
  switch (type) {
    case 'PER_M2_WINDOW':
      return (metrics?.totalWindowArea || 0) * unitCost;
    case 'PER_M2_FACADE':
      return (metrics?.totalWallArea || 0) * unitCost;
    case 'PER_M2_ROOF':
      return (metrics?.roofArea || 0) * unitCost;
    case 'PER_UNIT':
    case 'FIXED':
    default:
      return unitCost;
  }
}

function checkEligibility(
  measure: MeasureSummary,
  baselineMetrics: { overallWwr: number },
  project: ProjectRow,
): { eligible: boolean; reason?: string } {
  const eligibility = measure.eligibility || {};
  const minWWR = typeof eligibility.minWWR === 'number' ? Number(eligibility.minWWR) : null;
  const maxWWR = typeof eligibility.maxWWR === 'number' ? Number(eligibility.maxWWR) : null;
  const useCategories = Array.isArray(eligibility.useCategory) ? eligibility.useCategory.map(String) : null;

  if (minWWR !== null && baselineMetrics.overallWwr < minWWR) {
    return { eligible: false, reason: `Requires WWR ≥ ${(minWWR * 100).toFixed(0)}%` };
  }
  if (maxWWR !== null && baselineMetrics.overallWwr > maxWWR) {
    return { eligible: false, reason: `Requires WWR ≤ ${(maxWWR * 100).toFixed(0)}%` };
  }
  if (useCategories && useCategories.length > 0 && !useCategories.includes(project.selected_use_category)) {
    return { eligible: false, reason: `Only for ${useCategories.join(', ')}` };
  }
  return { eligible: true };
}

async function fetchProjectAndAssertView(
  client: PoolClient,
  user: ProjectUserContext,
  projectId: string,
  requestId: string,
): Promise<ProjectRow> {
  const project = await findProjectById(client, projectId);
  if (!project) {
    throw new AuthServiceError(404, 'BERSN_PROJECT_NOT_FOUND', 'Project not found.', { request_id: requestId });
  }
  assertCanViewProject(user, project, requestId);
  return project;
}

async function loadScenarioSummaries(
  client: PoolClient,
  scenarios: ProjectScenarioRow[],
): Promise<ScenarioSummary[]> {
  if (scenarios.length === 0) return [];
  const measureRows = await listScenarioMeasureIds(client, scenarios.map((row) => row.id));
  const measureMap = new Map<string, string[]>();
  for (const row of measureRows) {
    const list = measureMap.get(row.scenario_id) ?? [];
    list.push(row.measure_id);
    measureMap.set(row.scenario_id, list);
  }

  const summaries: ScenarioSummary[] = [];
  for (const row of scenarios) {
    const latestResult = await findLatestScenarioResult(client, row.id);
    summaries.push({
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      selectedMeasureIds: measureMap.get(row.id) ?? [],
      createdBy: row.created_by,
      createdAt: toDate(row.created_at).toISOString(),
      updatedAt: toDate(row.updated_at).toISOString(),
      latestResult: latestResult ? toScenarioResultSummary(latestResult) : null,
    });
  }
  return summaries;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function getMeasureLibraryForUser(
  req: Request,
  authState: AuthenticatedRequestState,
): Promise<MeasureSummary[]> {
  const requestId = getRequestId(req);
  await requireOptimizationUser(authState, requestId);
  const client = await pool.connect();
  try {
    const rows = await listActiveMeasures(client);
    return rows.map(toMeasureSummary);
  } finally {
    client.release();
  }
}

export async function listProjectScenariosForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
): Promise<ScenarioSummary[]> {
  const requestId = getRequestId(req);
  const user = await requireOptimizationUser(authState, requestId);
  const client = await pool.connect();
  try {
    await fetchProjectAndAssertView(client, user, projectId, requestId);
    const scenarios = await listScenariosForProject(client, projectId);
    return await loadScenarioSummaries(client, scenarios);
  } finally {
    client.release();
  }
}

export async function createProjectScenarioForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  input: ScenarioCreateInput,
): Promise<ScenarioSummary> {
  const requestId = getRequestId(req);
  const user = await requireOptimizationUser(authState, requestId);
  const client = await pool.connect();
  try {
    const project = await fetchProjectAndAssertView(client, user, projectId, requestId);
    assertCanEditScenarios(user, project, requestId);

    const measures = await findMeasuresByIds(client, input.selected_measure_ids);
    const validIds = new Set(measures.filter((row) => row.is_active).map((row) => row.id));
    const orderedIds = input.selected_measure_ids.filter((id) => validIds.has(id));
    if (orderedIds.length === 0) {
      throw new AuthServiceError(
        400,
        'BERSN_SCENARIO_NO_VALID_MEASURES',
        'Scenario must reference at least one active measure.',
        { request_id: requestId, requested: input.selected_measure_ids },
      );
    }

    await client.query('BEGIN');
    let scenarioRow: ProjectScenarioRow;
    try {
      scenarioRow = await insertScenario(client, {
        project_id: projectId,
        name: input.name,
        created_by: user.id,
      });
      await insertScenarioMeasures(client, scenarioRow.id, orderedIds);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }

    return {
      id: scenarioRow.id,
      projectId: scenarioRow.project_id,
      name: scenarioRow.name,
      selectedMeasureIds: orderedIds,
      createdBy: scenarioRow.created_by,
      createdAt: toDate(scenarioRow.created_at).toISOString(),
      updatedAt: toDate(scenarioRow.updated_at).toISOString(),
      latestResult: null,
    };
  } finally {
    client.release();
  }
}

export async function deleteProjectScenarioForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  scenarioId: string,
): Promise<void> {
  const requestId = getRequestId(req);
  const user = await requireOptimizationUser(authState, requestId);
  const client = await pool.connect();
  try {
    const project = await fetchProjectAndAssertView(client, user, projectId, requestId);
    assertCanEditScenarios(user, project, requestId);
    const scenario = await findScenarioById(client, scenarioId);
    if (!scenario || scenario.project_id !== projectId) {
      throw new AuthServiceError(
        404,
        'BERSN_SCENARIO_NOT_FOUND',
        'Scenario not found for this project.',
        { request_id: requestId },
      );
    }
    await deleteScenarioById(client, scenarioId);
  } finally {
    client.release();
  }
}

export async function simulateProjectScenarioForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  scenarioId: string,
): Promise<ScenarioResultSummary> {
  const requestId = getRequestId(req);
  const user = await requireOptimizationUser(authState, requestId);
  const client = await pool.connect();
  try {
    const project = await fetchProjectAndAssertView(client, user, projectId, requestId);
    const scenario = await findScenarioById(client, scenarioId);
    if (!scenario || scenario.project_id !== projectId) {
      throw new AuthServiceError(
        404,
        'BERSN_SCENARIO_NOT_FOUND',
        'Scenario not found for this project.',
        { request_id: requestId },
      );
    }

    const measureRows = await listScenarioMeasureIds(client, [scenarioId]);
    if (measureRows.length === 0) {
      throw new AuthServiceError(
        400,
        'BERSN_SCENARIO_EMPTY',
        'Scenario has no measures to simulate.',
        { request_id: requestId },
      );
    }
    const measureIds = measureRows.map((row) => row.measure_id);
    const measureLookup = new Map<string, MeasureSummary>();
    for (const row of await findMeasuresByIds(client, measureIds)) {
      measureLookup.set(row.id, toMeasureSummary(row));
    }

    const combinedPatches = measureIds
      .map((id) => measureLookup.get(id))
      .filter((m): m is MeasureSummary => Boolean(m))
      .flatMap((m) => m.patches);

    const basePayload = buildPreviewPayload(project);
    const payload = {
      ...basePayload,
      simulationVariants: [{ id: 'scenario', patches: combinedPatches }],
    };
    const result = await runGeometryPreviewInPython(payload, requestId);

    const baseline = readBaselineEEI(result);
    const variant = result.simulations?.find((row) => row.id === 'scenario');
    if (!variant || variant.ok === false || !variant.kpis) {
      throw new AuthServiceError(
        422,
        'BERSN_SCENARIO_SIMULATION_FAILED',
        variant?.error || 'Scenario simulation failed.',
        { request_id: requestId },
      );
    }

    const totalCost = measureIds
      .map((id) => measureLookup.get(id))
      .filter((m): m is MeasureSummary => Boolean(m))
      .reduce((sum, m) => sum + computeMeasureCost(m.costModel, result.metrics), 0);
    const deltaEEI = baseline.eei - Number(variant.kpis.eei || 0);
    const cpValue = totalCost > 0 ? (deltaEEI * 1_000_000) / totalCost : 0;

    const persisted = await insertScenarioResult(client, {
      scenario_id: scenarioId,
      simulated_eei: Number(variant.kpis.eei || 0),
      simulated_score: Number(variant.kpis.score || 0),
      simulated_grade: String(variant.kpis.grade || '-'),
      total_cost_twd: totalCost,
      cp_value: cpValue,
      baseline_eei: baseline.eei,
    });

    return toScenarioResultSummary(persisted);
  } finally {
    client.release();
  }
}

export async function simulateAllMeasuresForUser(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
): Promise<MeasureSimulationBundle> {
  const requestId = getRequestId(req);
  const user = await requireOptimizationUser(authState, requestId);
  const client = await pool.connect();
  try {
    const project = await fetchProjectAndAssertView(client, user, projectId, requestId);
    const measureRows = await listActiveMeasures(client);
    const measures = measureRows.map(toMeasureSummary);

    const basePayload = buildPreviewPayload(project);
    const payload = {
      ...basePayload,
      simulationVariants: measures.map((m) => ({ id: m.id, patches: m.patches })),
    };
    const result = await runGeometryPreviewInPython(payload, requestId);
    const baseline = readBaselineEEI(result);
    const overallWwr = Number(result.metrics?.overallWwr ?? 0);

    const variantById = new Map<string, GeometryPreviewVariantSummary>();
    for (const sim of result.simulations || []) {
      variantById.set(sim.id, sim);
    }

    const impacts: MeasureImpactSummary[] = measures.map((measure) => {
      const eligibility = checkEligibility(measure, { overallWwr }, project);
      if (!eligibility.eligible) {
        return {
          measureId: measure.id,
          deltaEEI: 0,
          deltaScore: 0,
          cost: 0,
          cpValue: 0,
          isEligible: false,
          ineligibleReason: eligibility.reason,
        };
      }
      const variant = variantById.get(measure.id);
      if (!variant || variant.ok === false || !variant.kpis) {
        return {
          measureId: measure.id,
          deltaEEI: 0,
          deltaScore: 0,
          cost: 0,
          cpValue: 0,
          isEligible: false,
          ineligibleReason: variant?.error || 'Simulation failed for this measure.',
        };
      }
      const cost = computeMeasureCost(measure.costModel, result.metrics);
      const deltaEEI = baseline.eei - Number(variant.kpis.eei || 0);
      const deltaScore = Number(variant.kpis.score || 0) - baseline.score;
      const cpValue = cost > 0 ? (deltaEEI * 1_000_000) / cost : 0;
      return {
        measureId: measure.id,
        deltaEEI,
        deltaScore,
        cost,
        cpValue,
        isEligible: true,
        simulatedEEI: Number(variant.kpis.eei || 0),
        simulatedGrade: String(variant.kpis.grade || '-'),
      };
    });

    impacts.sort((a, b) => b.cpValue - a.cpValue);

    return {
      baselineEEI: baseline.eei,
      baselineScore: baseline.score,
      baselineGrade: baseline.grade,
      metrics: {
        totalWallArea: Number(result.metrics?.totalWallArea ?? 0),
        totalWindowArea: Number(result.metrics?.totalWindowArea ?? 0),
        roofArea: Number(result.metrics?.roofArea ?? 0),
        overallWwr,
        estimatedFloorArea: Number(result.metrics?.estimatedFloorArea ?? 0),
      },
      impacts,
    };
  } finally {
    client.release();
  }
}

export async function getScenarioWithMeasures(
  req: Request,
  authState: AuthenticatedRequestState,
  projectId: string,
  scenarioId: string,
): Promise<ScenarioSummary> {
  const requestId = getRequestId(req);
  const user = await requireOptimizationUser(authState, requestId);
  const client = await pool.connect();
  try {
    await fetchProjectAndAssertView(client, user, projectId, requestId);
    const scenario = await findScenarioById(client, scenarioId);
    if (!scenario || scenario.project_id !== projectId) {
      throw new AuthServiceError(
        404,
        'BERSN_SCENARIO_NOT_FOUND',
        'Scenario not found for this project.',
        { request_id: requestId },
      );
    }
    const measureRows = await listScenarioMeasureIds(client, [scenarioId]);
    const latestResult = await findLatestScenarioResult(client, scenarioId);
    return {
      id: scenario.id,
      projectId: scenario.project_id,
      name: scenario.name,
      selectedMeasureIds: measureRows.map((row) => row.measure_id),
      createdBy: scenario.created_by,
      createdAt: toDate(scenario.created_at).toISOString(),
      updatedAt: toDate(scenario.updated_at).toISOString(),
      latestResult: latestResult ? toScenarioResultSummary(latestResult) : null,
    };
  } finally {
    client.release();
  }
}

// Re-export findMeasureById for tests / future use.
export { findMeasureById };
