// Project Management Types
import type { Floor, GeometryObject } from '../types';

export type ProjectStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'REJECTED'
    | 'REVISION_REQUESTED'
    | 'COMPLETED'
    | 'ARCHIVED';
export type OrganizationType = 'GOVERNMENT' | 'VENDOR' | 'AGENCY';

export interface ProjectWorkflowEvent {
    id: string;
    projectId: string;
    fromStatus: ProjectStatus | null;
    toStatus: ProjectStatus;
    actorUserId: string;
    actorRole: string;
    actorUsername: string | null;
    reason: string | null;
    metadata: unknown;
    at: string;
}

export interface BuildingTypeOption {
    code: string;
    euiBaseline: number;
    id: number;
    isActive: boolean;
    labelEn: string;
    labelZh: string;
    source?: string;
    sortOrder: number;
    verificationStatus?: string;
}

export interface OrganizationOption {
    createdAt: string;
    id: string;
    isActive: boolean;
    name: string;
    type: OrganizationType;
}

export interface ProjectWorkspaceSettings {
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
    savedAt: string | null;
}

export interface ExemptArea {
    area: number;
    id: string;
    name: string;
    reason: 'outdoor' | 'shelter' | 'parking' | 'storage';
}

export interface GeometryObjectRecord {
    id: string;
    params: Record<string, unknown>;
    position?: [number, number, number];
    type: string;
}

export interface Project {
    id: string;
    name: string;
    organization: string;
    organizationId: string | null;
    location?: string;
    createdAt: string;
    updatedAt: string;
    status: ProjectStatus;
    thumbnail?: string;
    category?: string;
    buildingType?: string;
    buildingTypeCode?: string;
    buildingTypeEuiBaseline?: number;
    totalArea?: number;
    grade?: string;
    eei?: number;
    assignedTo?: string | null;
    createdBy?: string;
    workspace?: ProjectWorkspaceSettings | null;
}

export interface ProjectFormData {
    name: string;
    organizationId: string;
    location?: string;
    buildingTypeCode: string;
    totalArea: number;
}

export interface GeometryPreviewMetrics {
    averageFloors: number;
    effectiveShadingRatio: number;
    estimatedFloorArea: number;
    overallWwr: number;
    roofArea: number;
    totalWallArea: number;
    totalWindowArea: number;
    wallEast: number;
    wallNorth: number;
    wallSouth: number;
    wallWest: number;
    winEast: number;
    winNorth: number;
    winSouth: number;
    winWest: number;
}

export interface GeometryPreviewConfig {
    envelope: {
        selectedGlazing: string;
        selectedRoof: string;
        selectedShading: string;
        selectedWall: string;
    };
    mep: {
        elevatorCount: number;
        selectedDhw: string;
        selectedElevator: string;
        selectedHvac: string;
        selectedLighting: string;
    };
    project: {
        exemptAreas: ExemptArea[];
        selectedRegion: string;
        selectedUseCategory: string;
        totalFloorArea?: number;
    };
}

export interface GeometryPreviewObject {
    id: string;
    metrics: {
        estimatedFloorArea: number;
        floors: number;
        roofArea: number;
        wallArea: number;
        windowArea: number;
        wwr: number;
    };
    type: string;
}

export interface GeometryPreviewPerformance {
    branchType: string;
    formulaTrace: string[];
    formulaVersion: string;
    inputsUsed: Record<string, unknown>;
    kpis: {
        afe: number;
        af: number;
        afkTotal: number;
        ceiStar: number;
        eei: number;
        esr: number;
        esrRatio: number;
        euiStar: number;
        grade: string;
        isNZCB: boolean;
        score: number;
        scoreDisplay: number;
        teui: number;
    };
    officialReferences: Record<string, unknown>;
    outputs: Record<string, unknown>;
    source: string;
}

export interface GeometryPreview {
    envelope?: unknown;
    geometry?: {
        metrics: GeometryPreviewMetrics;
        objects: GeometryPreviewObject[];
    };
    metrics: GeometryPreviewMetrics;
    mep?: unknown;
    objects: GeometryPreviewObject[];
    performance?: GeometryPreviewPerformance;
    project?: unknown;
    renderParams: {
        objects: GeometryObject[];
    };
}

export interface NamedLookupOption {
    id: string;
    name: string;
    nameEn: string;
    source?: string;
    verificationStatus?: string;
}

export interface ClimateRegionLookup extends NamedLookupOption {
    code: string;
    counties: string[];
}

export interface UseCategoryLookup extends NamedLookupOption {
    aliases: string[];
    appendix1Code: string | null;
    appendix1Label: string;
    esByAreaBand: Record<string, number> | null;
    fullYearAc: {
        AEUI: number;
        LEUI: number;
        EEUI: number;
    } | null;
    hasCentralDhwDefault: boolean;
    hotwaterBranchCategory: string | null;
    intermittentAc: {
        AEUI: number;
        LEUI: number;
        EEUI: number;
    } | null;
    supportsIntermittentAc: boolean | null;
    table32Label: string;
    urByRegion: Record<string, number>;
    warnings: string[];
    yohjHPerYr: number | null;
}

export interface AreaBandLookup {
    key: string;
    label: string;
    min_inclusive: number | null;
    max_exclusive: number | null;
}

export interface ProjectConfigLookup {
    areaBands: AreaBandLookup[];
    climateRegions: ClimateRegionLookup[];
    gradeThresholds?: unknown;
    useCategories: UseCategoryLookup[];
}

export interface WallConstructionLookup extends NamedLookupOption {
    uValue: number;
}

export interface RoofConstructionLookup extends NamedLookupOption {
    uValue: number;
}

export interface ShadingTypeLookup extends NamedLookupOption {
    ki: number;
    renderShadingType?: string;
    shadingCoverage?: number;
}

export interface GlazingTypeLookup extends NamedLookupOption {
    etaI: number;
    ug: number;
}

export interface EnvelopeConfigLookup {
    glazingTypes: GlazingTypeLookup[];
    officialEnvelopeThresholds?: unknown;
    roofConstructions: RoofConstructionLookup[];
    shadingTypes: ShadingTypeLookup[];
    wallConstructions: WallConstructionLookup[];
}

export interface HvacSystemLookup extends NamedLookupOption {
    eac: number;
    params?: Record<string, unknown>;
}

export interface LightingSystemLookup extends NamedLookupOption {
    el: number;
    params?: Record<string, unknown>;
}

export interface ElevatorTypeLookup extends NamedLookupOption {
    et: number;
}

export interface DhwSystemLookup extends NamedLookupOption {
    ehw: number;
    legacyIds?: string[];
}

export interface MepConfigLookup {
    dhwSystems: DhwSystemLookup[];
    elevatorReference?: unknown;
    elevatorTypes: ElevatorTypeLookup[];
    hotwaterReference?: unknown;
    hvacSystems: HvacSystemLookup[];
    lightingSystems: LightingSystemLookup[];
}

export interface ConfigLookups {
    envelope: EnvelopeConfigLookup;
    mep: MepConfigLookup;
    project: ProjectConfigLookup;
    sources: unknown[];
    version: string;
}
