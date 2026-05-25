import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data/bersn_tables');

export interface Tables {
    regions: { regions: any[] };
    uses: { uses: any[] };
    constructions: { constructions: any[] };
    materials: { materials: any[] };
    glazing: { glazingTypes: any[] };
    shading: { shadingTypes: any[] };
    elevators: {
        serviceHeightCategories: any[];
        elevatorTypes: any[];
        YOHByUse: any[];
        occupancyFactor: number;
    };
    hvac: { systemTypes: any[]; efficiencyFactors: any };
    lighting: { systemTypes: any[]; controlFactors: any; targetIlluminance_lux: any };
    dhw: { systemTypes: any[]; hotWaterDemand_L_day_m2: any };
    measures: { measures: any[]; categories: string[] };
    grades: { gradeThresholds: any[]; scoringFormulas: any; euiScaleFormulas: any; weightFormulas: any };
}

async function safeLoad<T>(filename: string, fallback: T): Promise<T> {
    try {
        const filePath = path.join(DATA_DIR, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch (e) {
        console.warn(`Failed to load table ${filename}:`, e);
        return fallback;
    }
}

export async function loadAllTables(): Promise<Tables> {
    const [
        regions,
        uses,
        constructions,
        materials,
        glazing,
        shading,
        elevators,
        hvac,
        lighting,
        dhw,
        measures,
        grades
    ] = await Promise.all([
        safeLoad('regions.json', { regions: [] }),
        safeLoad('use_categories.json', { uses: [] }),
        safeLoad('constructions.json', { constructions: [] }),
        safeLoad('materials.json', { materials: [] }),
        safeLoad('glazing_types.json', { glazingTypes: [] }),
        safeLoad('shading_types.json', { shadingTypes: [] }),
        safeLoad('elevator_tables.json', {
            serviceHeightCategories: [],
            elevatorTypes: [],
            YOHByUse: [],
            occupancyFactor: 0.6
        }),
        safeLoad('hvac_systems.json', { systemTypes: [], efficiencyFactors: {} }),
        safeLoad('lighting_systems.json', { systemTypes: [], controlFactors: {}, targetIlluminance_lux: {} }),
        safeLoad('dhw_systems.json', { systemTypes: [], hotWaterDemand_L_day_m2: {} }),
        safeLoad('measures.json', { measures: [], categories: [] }),
        safeLoad('grade_thresholds.json', { gradeThresholds: [], scoringFormulas: {}, euiScaleFormulas: {}, weightFormulas: {} })
    ]);

    return { regions, uses, constructions, materials, glazing, shading, elevators, hvac, lighting, dhw, measures, grades };
}

// Synchronous loader for client-side (uses pre-loaded data)
let cachedTables: Tables | null = null;

export function getCachedTables(): Tables | null {
    return cachedTables;
}

export function setCachedTables(tables: Tables): void {
    cachedTables = tables;
}

// Helper functions to look up values
export function lookupRegion(tables: Tables, regionId: string) {
    return tables.regions.regions.find(r => r.id === regionId);
}

export function lookupUseCategory(tables: Tables, useId: string) {
    return tables.uses.uses.find(u => u.id === useId);
}

export function lookupGlazingType(tables: Tables, glazingId: string) {
    return tables.glazing.glazingTypes.find(g => g.id === glazingId);
}

export function lookupShadingType(tables: Tables, shadingId: string) {
    return tables.shading.shadingTypes.find(s => s.id === shadingId);
}

export function lookupConstruction(tables: Tables, constructionId: string) {
    return tables.constructions.constructions.find(c => c.id === constructionId);
}

export function lookupElevatorCategory(tables: Tables, categoryId: string) {
    return tables.elevators.serviceHeightCategories.find(c => c.id === categoryId);
}

export function lookupElevatorYOH(tables: Tables, useId: string): number {
    const entry = tables.elevators.YOHByUse.find(y => y.useId === useId);
    return entry?.YOHj ?? 3000; // Default
}

export function lookupHVACSystem(tables: Tables, systemId: string) {
    return tables.hvac.systemTypes.find(h => h.id === systemId);
}

export function lookupLightingSystem(tables: Tables, systemId: string) {
    return tables.lighting.systemTypes.find(l => l.id === systemId);
}

export function lookupDHWSystem(tables: Tables, systemId: string) {
    return tables.dhw.systemTypes.find(d => d.id === systemId);
}

export function lookupMeasure(tables: Tables, measureId: string) {
    return tables.measures.measures.find(m => m.id === measureId);
}
