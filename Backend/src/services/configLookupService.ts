import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { ProjectGeometryPreviewInput } from '../schemas/projectSchemas.js';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonRecord = Record<string, JsonValue>;

interface EuiSet {
  AEUI: number;
  LEUI: number;
  EEUI: number;
}

interface BaselineEuiEntry {
  full_year_ac: EuiSet | null;
  intermittent_ac: EuiSet | null;
  UR: Record<string, number>;
  notes?: string;
  ref?: string | string[];
}

interface BaselineEuiFile {
  baseline_eui: Record<string, BaselineEuiEntry>;
  source: string;
  units: string;
  version: string;
}

interface BuildingTypeMapEntry {
  aliases?: string[];
  appendix1_code: string | null;
  appendix1_label: string;
  hotwater_branch_category: string | null;
  notes: string | null;
  supports_intermittent_ac: boolean | null;
  table_3_2_label: string;
}

interface BuildingTypeMapsFile {
  maps: Record<string, BuildingTypeMapEntry>;
  source: string;
  version: string;
}

interface AreaBand {
  key: string;
  label: string;
  min_inclusive: number | null;
  max_exclusive: number | null;
}

interface EsYohjRow {
  es_by_area_band: Record<string, number>;
  source_label: string;
  yohj_h_per_yr: number;
}

interface EsYohjFile {
  area_bands: AreaBand[];
  rows: EsYohjRow[];
  source: JsonRecord;
  units: JsonRecord;
  version: string;
}

interface ElevatorReferenceRow {
  eelj_kwh_per_car_hr: number;
  floor_band: string;
  rated_load_kg_per_car: number;
  rated_persons_per_car: number;
  rated_speed_m_per_min: number;
}

interface ElevatorReferenceFile {
  rows: ElevatorReferenceRow[];
  source: JsonRecord;
  units: JsonRecord;
  version: string;
}

interface HotWaterReferenceFile {
  derived_constants_for_engine: JsonRecord;
  rows: JsonRecord[];
  source: JsonRecord;
  units: JsonRecord;
  version: string;
}

interface EnvelopeReferenceFile {
  meta: JsonRecord;
  rows: JsonRecord[];
  schema_version: string;
}

interface GradeThresholdFile {
  display_threshold_formula_order: string[];
  eui_threshold_formulas: JsonRecord;
  rounding: JsonRecord;
  score_bands: JsonRecord[];
  source: JsonRecord;
  version: string;
}

interface UiLookupItem extends JsonRecord {
  id: string;
}

interface UiLookupsFile {
  dhwSystems: UiLookupItem[];
  elevatorTypes: UiLookupItem[];
  glazingTypes: UiLookupItem[];
  hvacSystems: UiLookupItem[];
  lightingSystems: UiLookupItem[];
  roofConstructions: UiLookupItem[];
  shadingTypes: UiLookupItem[];
  source: string;
  version: string;
  wallConstructions: UiLookupItem[];
}

interface OfficialUseCategory {
  aliases: string[];
  appendix1Code: string | null;
  appendix1Label: string;
  esByAreaBand: Record<string, number> | null;
  fullYearAc: EuiSet | null;
  hasCentralDhwDefault: boolean;
  hotwaterBranchCategory: string | null;
  id: string;
  intermittentAc: EuiSet | null;
  name: string;
  nameEn: string;
  source: string;
  supportsIntermittentAc: boolean | null;
  table32Label: string;
  urByRegion: Record<string, number>;
  verificationStatus: string;
  warnings: string[];
  yohjHPerYr: number | null;
}

interface ClimateRegionLookup {
  code: 'A' | 'B' | 'C' | 'D';
  counties: string[];
  id: string;
  name: string;
  nameEn: string;
  source: string;
  verificationStatus: string;
}

interface ConfigLookups {
  envelope: {
    glazingTypes: UiLookupItem[];
    officialEnvelopeThresholds: {
      meta: JsonRecord;
      rows: JsonRecord[];
      schemaVersion: string;
    };
    roofConstructions: UiLookupItem[];
    shadingTypes: UiLookupItem[];
    wallConstructions: UiLookupItem[];
  };
  mep: {
    dhwSystems: UiLookupItem[];
    elevatorReference: {
      rows: ElevatorReferenceRow[];
      source: JsonRecord;
      units: JsonRecord;
    };
    elevatorTypes: UiLookupItem[];
    hotwaterReference: {
      derivedConstantsForEngine: JsonRecord;
      rows: JsonRecord[];
      source: JsonRecord;
      units: JsonRecord;
    };
    hvacSystems: UiLookupItem[];
    lightingSystems: UiLookupItem[];
  };
  project: {
    areaBands: AreaBand[];
    climateRegions: ClimateRegionLookup[];
    gradeThresholds: {
      displayThresholdFormulaOrder: string[];
      euiThresholdFormulas: JsonRecord;
      rounding: JsonRecord;
      scoreBands: JsonRecord[];
      source: JsonRecord;
    };
    useCategories: OfficialUseCategory[];
  };
  sources: JsonRecord[];
  version: string;
}

export interface GeometryPreviewLookupContext {
  envelope: {
    availableOptions: {
      glazingTypes: UiLookupItem[];
      roofConstructions: UiLookupItem[];
      shadingTypes: UiLookupItem[];
      wallConstructions: UiLookupItem[];
    };
    glazingType: UiLookupItem;
    roofConstruction: UiLookupItem;
    shadingType: UiLookupItem;
    wallConstruction: UiLookupItem;
  };
  mep: {
    availableOptions: {
      dhwSystems: UiLookupItem[];
      elevatorTypes: UiLookupItem[];
      hvacSystems: UiLookupItem[];
      lightingSystems: UiLookupItem[];
    };
    dhwSystem: UiLookupItem;
    elevatorType: UiLookupItem;
    hvacSystem: UiLookupItem;
    lightingSystem: UiLookupItem;
  };
  project: {
    availableOptions: {
      climateRegions: ClimateRegionLookup[];
      useCategories: OfficialUseCategory[];
    };
    areaBand: AreaBand | null;
    buildingUseCategory: OfficialUseCategory;
    climateRegion: ClimateRegionLookup & { ur: number };
    esValue: number | null;
    totalFloorArea: number | null;
  };
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR_CANDIDATES = [
  path.resolve(process.cwd(), 'data'),
  path.resolve(process.cwd(), 'Backend', 'data'),
  path.resolve(MODULE_DIR, '../../data'),
];
const DATA_DIR = DATA_DIR_CANDIDATES.find((candidate) => {
  try {
    readFileSync(path.join(candidate, 'bersn-ui-lookups.json'));
    return true;
  } catch {
    return false;
  }
}) || DATA_DIR_CANDIDATES[0];
const CALCENGINE_DATA_DIR = path.join(DATA_DIR, 'calcengine', 'v1.0');

const LEGACY_USE_CATEGORY_ALIASES: Record<string, string> = {
  USE_DORM: 'H1_H2_NON_RESIDENTIAL',
  USE_GYM: 'D1_FITNESS_LEISURE',
  USE_HOSPITAL: 'F1_HOSPITAL_LONG_TERM_CARE',
  USE_HOTEL: 'B4_HOTEL',
  USE_OFFICE: 'G2_OFFICE',
  USE_RETAIL: 'B2_DEPARTMENT_STORE',
};

const LEGACY_DHW_ALIASES: Record<string, string> = {
  DHW_ELECTRIC: 'electric_storage',
  DHW_GAS: 'natural_gas_boiler',
  DHW_HEATPUMP: 'heat_pump_storage',
  DHW_HEATPUMP_TANK: 'heat_pump_storage',
  DHW_SOLAR: 'DHW_NONE',
};

const CLIMATE_REGIONS: ClimateRegionLookup[] = [
  {
    code: 'A',
    counties: ['桃園市', '台北市', '新北市', '基隆市', '新竹市', '新竹縣', '苗栗縣'],
    id: 'REGION_A',
    name: 'A區',
    nameEn: 'Zone A',
    source: 'CalcEngine baseline_eui_tableA.UR',
    verificationStatus: 'OFFICIAL_CALCENGINE_REFERENCE',
  },
  {
    code: 'B',
    counties: ['台中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣'],
    id: 'REGION_B',
    name: 'B區',
    nameEn: 'Zone B',
    source: 'CalcEngine baseline_eui_tableA.UR',
    verificationStatus: 'OFFICIAL_CALCENGINE_REFERENCE',
  },
  {
    code: 'C',
    counties: ['台南市', '高雄市', '屏東縣'],
    id: 'REGION_C',
    name: 'C區',
    nameEn: 'Zone C',
    source: 'CalcEngine baseline_eui_tableA.UR',
    verificationStatus: 'OFFICIAL_CALCENGINE_REFERENCE',
  },
  {
    code: 'D',
    counties: ['宜蘭縣', '花蓮縣', '台東縣', '澎湖縣', '金門縣', '連江縣'],
    id: 'REGION_D',
    name: 'D區',
    nameEn: 'Zone D',
    source: 'CalcEngine baseline_eui_tableA.UR',
    verificationStatus: 'OFFICIAL_CALCENGINE_REFERENCE',
  },
];

let cachedLookups: ConfigLookups | null = null;

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function calcenginePath(fileName: string): string {
  return path.join(CALCENGINE_DATA_DIR, fileName);
}

function uiLookupPath(): string {
  return path.join(DATA_DIR, 'bersn-ui-lookups.json');
}

function toJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function getAreaBand(area: number | null | undefined, areaBands: AreaBand[]): AreaBand | null {
  if (typeof area !== 'number' || !Number.isFinite(area) || area < 0) {
    return null;
  }
  return areaBands.find((band) => {
    const minOk = band.min_inclusive === null || area >= band.min_inclusive;
    const maxOk = band.max_exclusive === null || area < band.max_exclusive;
    return minOk && maxOk;
  }) || null;
}

function selectEsValue(
  category: OfficialUseCategory,
  totalFloorArea: number | null | undefined,
  areaBands: AreaBand[],
): number | null {
  const band = getAreaBand(totalFloorArea, areaBands);
  if (!band || !category.esByAreaBand) {
    return null;
  }
  const value = category.esByAreaBand[band.key];
  return typeof value === 'number' ? value : null;
}

function sourceSummary(document: string, table: string, detail: string): JsonRecord {
  return { document, table, detail };
}

function buildUseCategories(
  baselineFile: BaselineEuiFile,
  mapFile: BuildingTypeMapsFile,
  esYohjFile: EsYohjFile,
): OfficialUseCategory[] {
  const esRowsByLabel = new Map(esYohjFile.rows.map((row) => [row.source_label, row]));

  return Object.entries(mapFile.maps).map(([id, mapEntry]) => {
    const baseline = mapEntry.appendix1_code
      ? baselineFile.baseline_eui[mapEntry.appendix1_code] || null
      : null;
    const esRow = esRowsByLabel.get(mapEntry.table_3_2_label) || null;
    const warnings: string[] = [];

    if (!baseline) {
      warnings.push('Appendix 1 baseline crosswalk is not available for this Table 3.2 category.');
    }
    if (!esRow) {
      warnings.push('Table 3.2 Es/YOHj row was not found for this category.');
    }
    if (mapEntry.notes) {
      warnings.push(mapEntry.notes);
    }
    if (baseline?.notes) {
      warnings.push(baseline.notes);
    }
    if (baseline?.ref) {
      warnings.push(`Appendix baseline references ${Array.isArray(baseline.ref) ? baseline.ref.join(' or ') : baseline.ref}.`);
    }

    return {
      aliases: mapEntry.aliases || [],
      appendix1Code: mapEntry.appendix1_code,
      appendix1Label: mapEntry.appendix1_label,
      esByAreaBand: esRow?.es_by_area_band || null,
      fullYearAc: baseline?.full_year_ac || null,
      hasCentralDhwDefault: Boolean(mapEntry.hotwater_branch_category),
      hotwaterBranchCategory: mapEntry.hotwater_branch_category,
      id,
      intermittentAc: baseline?.intermittent_ac || null,
      name: mapEntry.table_3_2_label,
      nameEn: mapEntry.table_3_2_label,
      source: 'CalcEngine building_type_maps + baseline_eui_tableA + table_3_2_es_yohj',
      supportsIntermittentAc: mapEntry.supports_intermittent_ac,
      table32Label: mapEntry.table_3_2_label,
      urByRegion: Object.fromEntries(
        Object.entries(baseline?.UR || {}).map(([regionCode, value]) => [`REGION_${regionCode}`, value]),
      ),
      verificationStatus: 'OFFICIAL_CALCENGINE_NORMALIZED',
      warnings,
      yohjHPerYr: esRow?.yohj_h_per_yr || null,
    };
  });
}

function buildConfigLookups(): ConfigLookups {
  const baselineFile = readJsonFile<BaselineEuiFile>(calcenginePath('baseline_eui_tableA_v1.0_A1_O6_full.json'));
  const mapFile = readJsonFile<BuildingTypeMapsFile>(calcenginePath('building_type_maps.json'));
  const esYohjFile = readJsonFile<EsYohjFile>(calcenginePath('table_3_2_es_yohj.json'));
  const elevatorFile = readJsonFile<ElevatorReferenceFile>(calcenginePath('table_3_1_elevator_eelj.json'));
  const hotwaterFile = readJsonFile<HotWaterReferenceFile>(calcenginePath('table_3_3_hotwater_defaults.json'));
  const envelopeFile = readJsonFile<EnvelopeReferenceFile>(calcenginePath('envelope_evc_evmin.json'));
  const gradeFile = readJsonFile<GradeThresholdFile>(calcenginePath('grade_thresholds.json'));
  const uiLookups = readJsonFile<UiLookupsFile>(uiLookupPath());

  return {
    envelope: {
      glazingTypes: uiLookups.glazingTypes,
      officialEnvelopeThresholds: {
        meta: envelopeFile.meta,
        rows: envelopeFile.rows,
        schemaVersion: envelopeFile.schema_version,
      },
      roofConstructions: uiLookups.roofConstructions,
      shadingTypes: uiLookups.shadingTypes,
      wallConstructions: uiLookups.wallConstructions,
    },
    mep: {
      dhwSystems: uiLookups.dhwSystems,
      elevatorReference: {
        rows: elevatorFile.rows,
        source: elevatorFile.source,
        units: elevatorFile.units,
      },
      elevatorTypes: uiLookups.elevatorTypes,
      hotwaterReference: {
        derivedConstantsForEngine: hotwaterFile.derived_constants_for_engine,
        rows: hotwaterFile.rows,
        source: hotwaterFile.source,
        units: hotwaterFile.units,
      },
      hvacSystems: uiLookups.hvacSystems,
      lightingSystems: uiLookups.lightingSystems,
    },
    project: {
      areaBands: esYohjFile.area_bands,
      climateRegions: CLIMATE_REGIONS,
      gradeThresholds: {
        displayThresholdFormulaOrder: gradeFile.display_threshold_formula_order,
        euiThresholdFormulas: gradeFile.eui_threshold_formulas,
        rounding: gradeFile.rounding,
        scoreBands: gradeFile.score_bands,
        source: gradeFile.source,
      },
      useCategories: buildUseCategories(baselineFile, mapFile, esYohjFile),
    },
    sources: [
      sourceSummary('Technical.pdf', 'Appendix 1 Table A', baselineFile.source),
      sourceSummary('Technical.pdf', 'Table 3.2', String(esYohjFile.source.title || 'Es and YOHj')),
      sourceSummary('Technical.pdf', 'Table 3.1', String(elevatorFile.source.title || 'Elevator Eelj')),
      sourceSummary('Technical.pdf', 'Table 3.3', String(hotwaterFile.source.title || 'Hot-water defaults')),
      sourceSummary('Technical.pdf', 'Appendix 2 §3', String(envelopeFile.meta.source_table || 'Envelope EVc/EVmin')),
      sourceSummary(
        'Technical.pdf',
        'Appendix 2 Tables 1, 4, 5, 6, 7, 8, 9, 10, 11 and §4 formulas',
        uiLookups.source,
      ),
    ],
    version: uiLookups.version,
  };
}

export function getConfigLookups(): ConfigLookups {
  cachedLookups ||= buildConfigLookups();
  return cachedLookups;
}

export function getConfigLookupSection(section: keyof ConfigLookups): ConfigLookups[keyof ConfigLookups] {
  return getConfigLookups()[section];
}

export function getProjectConfigLookups(): ConfigLookups['project'] {
  return getConfigLookups().project;
}

export function getEnvelopeConfigLookups(): ConfigLookups['envelope'] {
  return getConfigLookups().envelope;
}

export function getMepConfigLookups(): ConfigLookups['mep'] {
  return getConfigLookups().mep;
}

function normalizeUseCategoryId(rawId: string | undefined): string {
  const id = String(rawId || 'G2_OFFICE');
  return LEGACY_USE_CATEGORY_ALIASES[id] || id;
}

function normalizeDhwId(rawId: string | undefined): string {
  const id = String(rawId || 'DHW_NONE');
  return LEGACY_DHW_ALIASES[id] || id;
}

function pickById<T extends { id: string }>(
  items: T[],
  rawId: string | undefined,
  fallbackId: string,
): T {
  const item = items.find((candidate) => {
    const legacyIds = Array.isArray(toJsonRecord(candidate).legacyIds)
      ? toJsonRecord(candidate).legacyIds as JsonValue[]
      : [];
    return candidate.id === rawId || legacyIds.includes(rawId || '');
  });
  return item || items.find((candidate) => candidate.id === fallbackId) || items[0];
}

export function buildGeometryPreviewLookupContext(
  input: ProjectGeometryPreviewInput,
): GeometryPreviewLookupContext {
  const lookups = getConfigLookups();
  const normalizedUseCategoryId = normalizeUseCategoryId(input.project.selected_use_category);
  const useCategory = pickById(lookups.project.useCategories, normalizedUseCategoryId, 'G2_OFFICE');
  const requestedRegion = pickById(lookups.project.climateRegions, input.project.selected_region, 'REGION_A');
  const region = useCategory.urByRegion[requestedRegion.id] !== undefined
    ? requestedRegion
    : pickById(lookups.project.climateRegions, 'REGION_A', 'REGION_A');
  const totalFloorArea = typeof input.project.total_floor_area === 'number'
    ? input.project.total_floor_area
    : null;
  const areaBand = getAreaBand(totalFloorArea, lookups.project.areaBands);
  const esValue = selectEsValue(useCategory, totalFloorArea, lookups.project.areaBands);
  const ur = useCategory.urByRegion[region.id] ?? useCategory.urByRegion.REGION_A ?? 1;

  return {
    envelope: {
      availableOptions: {
        glazingTypes: lookups.envelope.glazingTypes,
        roofConstructions: lookups.envelope.roofConstructions,
        shadingTypes: lookups.envelope.shadingTypes,
        wallConstructions: lookups.envelope.wallConstructions,
      },
      glazingType: pickById(lookups.envelope.glazingTypes, input.envelope.selected_glazing, 'GLZ_DBL_LOW_E'),
      roofConstruction: pickById(lookups.envelope.roofConstructions, input.envelope.selected_roof, 'CONS_ROOF_RC_INS'),
      shadingType: pickById(lookups.envelope.shadingTypes, input.envelope.selected_shading, 'SH_OVERHANG'),
      wallConstruction: pickById(lookups.envelope.wallConstructions, input.envelope.selected_wall, 'CONS_WALL_RC_INS'),
    },
    mep: {
      availableOptions: {
        dhwSystems: lookups.mep.dhwSystems,
        elevatorTypes: lookups.mep.elevatorTypes,
        hvacSystems: lookups.mep.hvacSystems,
        lightingSystems: lookups.mep.lightingSystems,
      },
      dhwSystem: pickById(lookups.mep.dhwSystems, normalizeDhwId(input.mep.selected_dhw), 'DHW_NONE'),
      elevatorType: pickById(lookups.mep.elevatorTypes, input.mep.selected_elevator, 'ET_VVVF'),
      hvacSystem: pickById(lookups.mep.hvacSystems, input.mep.selected_hvac, 'HVAC_VRF'),
      lightingSystem: pickById(lookups.mep.lightingSystems, input.mep.selected_lighting, 'LGT_LED'),
    },
    project: {
      availableOptions: {
        climateRegions: lookups.project.climateRegions,
        useCategories: lookups.project.useCategories,
      },
      areaBand,
      buildingUseCategory: useCategory,
      climateRegion: { ...region, ur },
      esValue,
      totalFloorArea,
    },
  };
}
