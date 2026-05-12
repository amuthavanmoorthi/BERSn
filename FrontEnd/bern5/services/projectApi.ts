import type {
    BuildingTypeOption,
    ConfigLookups,
    ExemptArea,
    GeometryObjectRecord,
    GeometryPreview,
    GeometryPreviewConfig,
    OrganizationOption,
    Project,
    ProjectFormData,
    ProjectWorkspaceSettings,
    ProjectStatus,
    ProjectWorkflowEvent,
} from '../types/project';
import type { Floor, GeometryObject } from '../types';
import { API_BASE_URL, buildFingerprint, buildJsonHeaders } from './authApi';

interface ProjectApiResponse {
    ok: boolean;
    building_types?: BuildingTypeOption[];
    config?: ConfigLookups;
    organizations?: OrganizationOption[];
    project?: BackendProject;
    projects?: BackendProject[];
    preview?: GeometryPreview;
    history?: ProjectWorkflowEvent[];
    message?: string;
    error_code?: string;
    details?: {
        field_errors?: Record<string, string[]>;
    };
}

export interface WorkspaceSettingsPayload {
    elevatorCount: number;
    exemptAreas: ExemptArea[];
    geometryObjects: GeometryObjectRecord[];
    floors?: Floor[] | null;
    selectedDhw: string;
    selectedElevator: string;
    selectedGlazing: string;
    selectedHvac: string;
    selectedLighting: string;
    selectedRegion: string;
    selectedRoof: string;
    selectedShading: string;
    selectedUseCategory: string;
    selectedWall: string;
    thumbnail?: string | null;
}

interface BackendProject {
    assignedTo: string | null;
    buildingType: {
        code: string;
        euiBaseline: number;
        labelEn: string;
        labelZh: string;
    };
    createdAt: string;
    createdBy: string;
    creatorUsername: string | null;
    elevatorCount: number;
    exemptAreas: ExemptArea[];
    floors?: Floor[] | null;
    geometryObjects: GeometryObjectRecord[];
    id: string;
    latestCalculation: {
        eeiResult: number | null;
        grade: string | null;
    };
    latestCalculationAt: string | null;
    /**
     * Server-computed live preview of EEI/grade based on the project's
     * current workspace settings + geometry. Null when geometry is missing
     * or the preview fails — the dashboard renders "—" in that case.
     */
    livePreview?: {
        eei: number | null;
        grade: string | null;
    } | null;
    location: string | null;
    organization: string;
    organizationId: string | null;
    projectName: string;
    selectedDhw: string;
    selectedElevator: string;
    selectedGlazing: string;
    selectedHvac: string;
    selectedLighting: string;
    selectedRegion: string;
    selectedRoof: string;
    selectedShading: string;
    selectedUseCategory: string;
    selectedWall: string;
    status: Project['status'];
    totalFloorArea: number;
    updatedAt: string;
    workspaceSavedAt: string | null;
    workspaceThumbnail?: string | null;
}

export class ProjectApiError extends Error {
    fieldErrors?: Record<string, string[]>;

    constructor(message: string, fieldErrors?: Record<string, string[]>) {
        super(message);
        this.fieldErrors = fieldErrors;
    }
}

async function parseResponse(response: Response): Promise<ProjectApiResponse> {
    return response.json().catch(() => ({ ok: false }));
}

function mapProject(project: BackendProject): Project {
    return {
        id: project.id,
        name: project.projectName,
        organization: project.organization,
        organizationId: project.organizationId,
        location: project.location || undefined,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        status: project.status,
        thumbnail: project.workspaceThumbnail ?? undefined,
        category: project.buildingType.labelZh,
        buildingType: project.buildingType.labelEn,
        buildingTypeCode: project.buildingType.code,
        buildingTypeEuiBaseline: project.buildingType.euiBaseline,
        totalArea: project.totalFloorArea,
        // Prefer the freshly-computed live preview; fall back to the last persisted calculation.
        grade: project.livePreview?.grade ?? project.latestCalculation.grade ?? undefined,
        eei: project.livePreview?.eei ?? project.latestCalculation.eeiResult ?? undefined,
        assignedTo: project.assignedTo,
        createdBy: project.createdBy,
        workspace: {
            elevatorCount: project.elevatorCount ?? 4,
            exemptAreas: Array.isArray(project.exemptAreas) ? project.exemptAreas : [],
            floors: Array.isArray(project.floors) ? project.floors : null,
            geometryObjects: Array.isArray(project.geometryObjects) ? project.geometryObjects : [],
            selectedDhw: project.selectedDhw ?? 'DHW_NONE',
            selectedElevator: project.selectedElevator ?? 'ET_VVVF',
            selectedGlazing: project.selectedGlazing ?? 'GLZ_DBL_LOW_E',
            selectedHvac: project.selectedHvac ?? 'HVAC_VRF',
            selectedLighting: project.selectedLighting ?? 'LGT_LED',
            selectedRegion: project.selectedRegion ?? 'REGION_A',
            selectedRoof: project.selectedRoof ?? 'CONS_ROOF_RC_INS',
            selectedShading: project.selectedShading ?? 'SH_OVERHANG',
            selectedUseCategory: project.selectedUseCategory ?? 'USE_OFFICE',
            selectedWall: project.selectedWall ?? 'CONS_WALL_RC_INS',
            savedAt: project.workspaceSavedAt ?? null,
        },
    };
}

function assertSuccess(body: ProjectApiResponse, fallbackMessage: string): never {
    throw new ProjectApiError(body.message || fallbackMessage, body.details?.field_errors);
}

export async function getBuildingTypes(): Promise<BuildingTypeOption[]> {
    const response = await fetch(`${API_BASE_URL}/api/building-types`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'X-Device-Fingerprint': buildFingerprint(),
        },
    });
    const body = await parseResponse(response);
    if (response.ok && body.ok && Array.isArray(body.building_types)) {
        return body.building_types;
    }
    return assertSuccess(body, 'Failed to load building types.');
}

export async function getOrganizations(): Promise<OrganizationOption[]> {
    const response = await fetch(`${API_BASE_URL}/api/organizations`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'X-Device-Fingerprint': buildFingerprint(),
        },
    });
    const body = await parseResponse(response);
    if (response.ok && body.ok && Array.isArray(body.organizations)) {
        return body.organizations;
    }
    return assertSuccess(body, 'Failed to load organizations.');
}

/** Admin: create or reactivate an organization by name + type. */
export async function createOrganization(input: { name: string; type: 'GOVERNMENT' | 'VENDOR' | 'AGENCY' }): Promise<OrganizationOption> {
    const response = await fetch(`${API_BASE_URL}/api/organizations`, {
        method: 'POST',
        credentials: 'include',
        headers: buildJsonHeaders(),
        body: JSON.stringify(input),
    });
    const body = await parseResponse(response);
    const organization = (body as ProjectApiResponse & { organization?: OrganizationOption }).organization;
    if (response.ok && body.ok && organization) {
        return organization;
    }
    return assertSuccess(body, 'Failed to create organization.');
}

export async function getProjects(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'X-Device-Fingerprint': buildFingerprint(),
        },
    });
    const body = await parseResponse(response);
    if (response.ok && body.ok && Array.isArray(body.projects)) {
        return body.projects.map(mapProject);
    }
    return assertSuccess(body, 'Failed to load projects.');
}

export async function getProject(projectId: string): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'X-Device-Fingerprint': buildFingerprint(),
        },
    });
    const body = await parseResponse(response);
    if (response.ok && body.ok && body.project) {
        return mapProject(body.project);
    }
    return assertSuccess(body, 'Failed to load project.');
}

export async function getConfigLookups(): Promise<ConfigLookups> {
    const response = await fetch(`${API_BASE_URL}/api/lookup/config`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'X-Device-Fingerprint': buildFingerprint(),
        },
    });
    const body = await parseResponse(response);
    if (response.ok && body.ok && body.config) {
        return body.config;
    }
    return assertSuccess(body, 'Failed to load BERSn configuration lookups.');
}

export async function createProject(input: ProjectFormData): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        credentials: 'include',
        headers: buildJsonHeaders(),
        body: JSON.stringify({
            project_name: input.name,
            organization_id: input.organizationId,
            location: input.location || '',
            building_type_code: input.buildingTypeCode,
            total_floor_area: input.totalArea,
        }),
    });
    const body = await parseResponse(response);
    if (response.ok && body.ok && body.project) {
        return mapProject(body.project);
    }
    return assertSuccess(body, 'Failed to create project.');
}

export async function updateWorkspaceSettings(
    projectId: string,
    settings: WorkspaceSettingsPayload,
): Promise<Project> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/workspace-settings`,
        {
            method: 'PATCH',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify({
                elevator_count: settings.elevatorCount,
                exempt_areas: settings.exemptAreas,
                floors: settings.floors ?? null,
                geometry_objects: settings.geometryObjects,
                selected_dhw: settings.selectedDhw,
                selected_elevator: settings.selectedElevator,
                selected_glazing: settings.selectedGlazing,
                selected_hvac: settings.selectedHvac,
                selected_lighting: settings.selectedLighting,
                selected_region: settings.selectedRegion,
                selected_roof: settings.selectedRoof,
                selected_shading: settings.selectedShading,
                selected_use_category: settings.selectedUseCategory,
                selected_wall: settings.selectedWall,
                thumbnail: settings.thumbnail ?? null,
            }),
        },
    );
    const body = await parseResponse(response);
    if (response.ok && body.ok && body.project) {
        return mapProject(body.project);
    }
    return assertSuccess(body, 'Failed to save workspace settings.');
}

export async function previewProjectGeometry(
    projectId: string,
    objects: GeometryObject[],
    config?: GeometryPreviewConfig,
): Promise<GeometryPreview> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/geometry/preview`, {
        method: 'POST',
        credentials: 'include',
        headers: buildJsonHeaders(),
        body: JSON.stringify({
            floor_height_m: 3.5,
            envelope: config ? {
                selected_glazing: config.envelope.selectedGlazing,
                selected_roof: config.envelope.selectedRoof,
                selected_shading: config.envelope.selectedShading,
                selected_wall: config.envelope.selectedWall,
            } : undefined,
            mep: config ? {
                elevator_count: config.mep.elevatorCount,
                selected_dhw: config.mep.selectedDhw,
                selected_elevator: config.mep.selectedElevator,
                selected_hvac: config.mep.selectedHvac,
                selected_lighting: config.mep.selectedLighting,
            } : undefined,
            objects,
            project: config ? {
                exempt_areas: config.project.exemptAreas,
                selected_region: config.project.selectedRegion,
                selected_use_category: config.project.selectedUseCategory,
                total_floor_area: config.project.totalFloorArea,
            } : undefined,
        }),
    });
    const body = await parseResponse(response);
    if (response.ok && body.ok && body.preview) {
        return body.preview;
    }
    return assertSuccess(body, 'Failed to calculate geometry preview.');
}

export async function submitProject(projectId: string, reason?: string): Promise<Project> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/submit`,
        {
            method: 'POST',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify(reason ? { reason } : {}),
        },
    );
    const body = await parseResponse(response);
    if (response.ok && body.ok && body.project) {
        return mapProject(body.project);
    }
    return assertSuccess(body, 'Failed to submit project.');
}

/**
 * Change the workflow status of a project (agency / admin only).
 * Backend enforces the allowed (from → to) transitions per role.
 */
export async function updateProjectStatus(
    projectId: string,
    status: ProjectStatus,
    reason?: string,
): Promise<Project> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/status`,
        {
            method: 'PATCH',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify(reason ? { status, reason } : { status }),
        },
    );
    const body = await parseResponse(response);
    if (response.ok && body.ok && body.project) {
        return mapProject(body.project);
    }
    return assertSuccess(body, 'Failed to update project status.');
}

export async function getProjectWorkflowHistory(projectId: string): Promise<ProjectWorkflowEvent[]> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/workflow-history`,
        {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Device-Fingerprint': buildFingerprint(),
            },
        },
    );
    const body = await parseResponse(response);
    if (response.ok && body.ok && Array.isArray(body.history)) {
        return body.history;
    }
    return assertSuccess(body, 'Failed to load workflow history.');
}

// ── Optimization (measures + scenarios) ────────────────────────────────────────

export interface BackendMeasure {
    id: string;
    nameZh: string;
    nameEn: string;
    category: 'ENVELOPE' | 'HVAC' | 'LIGHTING' | 'ELEVATOR' | 'DHW' | 'CONTROL';
    descriptionZh: string;
    descriptionEn: string;
    eligibility: Record<string, unknown>;
    patches: Array<{ section: string; field: string; value: unknown }>;
    costModel: { type: string; unitCost: number };
    sortOrder: number;
}

export interface BackendScenarioResult {
    scenarioId: string;
    simulatedEEI: number;
    simulatedScore: number;
    simulatedGrade: string;
    totalCostTwd: number;
    cpValue: number;
    baselineEEI: number | null;
    computedAt: string;
}

export interface BackendScenario {
    id: string;
    projectId: string;
    name: string;
    selectedMeasureIds: string[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    latestResult: BackendScenarioResult | null;
}

export interface BackendMeasureImpact {
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

export interface BackendMeasureSimulationBundle {
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
    impacts: BackendMeasureImpact[];
}

interface OptimizationApiResponse {
    ok: boolean;
    measures?: BackendMeasure[];
    scenarios?: BackendScenario[];
    scenario?: BackendScenario;
    result?: BackendScenarioResult;
    baselineEEI?: number;
    baselineScore?: number;
    baselineGrade?: string;
    metrics?: BackendMeasureSimulationBundle['metrics'];
    impacts?: BackendMeasureImpact[];
    message?: string;
    details?: { field_errors?: Record<string, string[]> };
}

async function parseOptimization(response: Response): Promise<OptimizationApiResponse> {
    return response.json().catch(() => ({ ok: false }));
}

function assertOptimizationSuccess(body: OptimizationApiResponse, fallbackMessage: string): never {
    throw new ProjectApiError(body.message || fallbackMessage, body.details?.field_errors);
}

export async function getMeasureLibrary(): Promise<BackendMeasure[]> {
    const response = await fetch(`${API_BASE_URL}/api/reference/measures`, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'X-Device-Fingerprint': buildFingerprint(),
        },
    });
    const body = await parseOptimization(response);
    if (response.ok && body.ok && Array.isArray(body.measures)) {
        return body.measures;
    }
    return assertOptimizationSuccess(body, 'Failed to load measure library.');
}

export async function listProjectScenarios(projectId: string): Promise<BackendScenario[]> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/scenarios`,
        {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Device-Fingerprint': buildFingerprint(),
            },
        },
    );
    const body = await parseOptimization(response);
    if (response.ok && body.ok && Array.isArray(body.scenarios)) {
        return body.scenarios;
    }
    return assertOptimizationSuccess(body, 'Failed to load scenarios.');
}

export async function createProjectScenario(
    projectId: string,
    input: { name: string; selectedMeasureIds: string[] },
): Promise<BackendScenario> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/scenarios`,
        {
            method: 'POST',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify({
                name: input.name,
                selected_measure_ids: input.selectedMeasureIds,
            }),
        },
    );
    const body = await parseOptimization(response);
    if (response.ok && body.ok && body.scenario) {
        return body.scenario;
    }
    return assertOptimizationSuccess(body, 'Failed to create scenario.');
}

export async function deleteProjectScenario(projectId: string, scenarioId: string): Promise<void> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/scenarios/${encodeURIComponent(scenarioId)}`,
        {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'X-Device-Fingerprint': buildFingerprint(),
            },
        },
    );
    if (response.status === 204 || response.ok) {
        return;
    }
    const body = await parseOptimization(response);
    return assertOptimizationSuccess(body, 'Failed to delete scenario.');
}

export async function simulateProjectScenario(
    projectId: string,
    scenarioId: string,
): Promise<BackendScenarioResult> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/scenarios/${encodeURIComponent(scenarioId)}/simulate`,
        {
            method: 'POST',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify({}),
        },
    );
    const body = await parseOptimization(response);
    if (response.ok && body.ok && body.result) {
        return body.result;
    }
    return assertOptimizationSuccess(body, 'Failed to simulate scenario.');
}

export async function simulateAllMeasures(projectId: string): Promise<BackendMeasureSimulationBundle> {
    const response = await fetch(
        `${API_BASE_URL}/api/projects/${encodeURIComponent(projectId)}/measures/simulate-all`,
        {
            method: 'POST',
            credentials: 'include',
            headers: buildJsonHeaders(),
            body: JSON.stringify({}),
        },
    );
    const body = await parseOptimization(response);
    if (
        response.ok
        && body.ok
        && typeof body.baselineEEI === 'number'
        && body.metrics
        && Array.isArray(body.impacts)
    ) {
        return {
            baselineEEI: body.baselineEEI,
            baselineScore: body.baselineScore ?? 0,
            baselineGrade: body.baselineGrade ?? '-',
            metrics: body.metrics,
            impacts: body.impacts,
        };
    }
    return assertOptimizationSuccess(body, 'Failed to compute measure impacts.');
}
