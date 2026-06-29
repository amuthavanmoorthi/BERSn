/**
 * BERSn Calculation Engine
 * 
 * Complete implementation of Taiwan MOI BERSn new-building energy performance equations.
 * All functions are pure, deterministic, and tested.
 */

import { ProjectInput, CalcResult, ProjectInputSchema } from '../zod/projectInput';
import { Tables } from './tables';

// ============================================
// Input Validation
// ============================================

export function validateInput(input: any) {
    return ProjectInputSchema.safeParse(input);
}

// ============================================
// Area Calculations
// ============================================

export interface AreaCalcResult {
    AFe: number;
    exemptTotal: number;
    qualifiedExempt: any[];
    breakdown: {
        outdoor: number;
        civilDefense: number;
        parking: number;
        storageEquipment: number;
    };
}

export function computeAreas(areas: ProjectInput['areas']): AreaCalcResult {
    const breakdown = {
        outdoor: 0,
        civilDefense: 0,
        parking: 0,
        storageEquipment: 0
    };

    const qualifiedExempt = areas.exemptAreas.filter(a => {
        switch (a.reason) {
            case 'OUTDOOR_FLOOR':
                // Outdoor floor areas are always exempt
                breakdown.outdoor += a.area_m2;
                return true;

            case 'CIVIL_DEFENSE':
                // Civil defense shelters are always exempt
                breakdown.civilDefense += a.area_m2;
                return true;

            case 'INDOOR_PARKING':
                // Indoor parking areas are always exempt
                breakdown.parking += a.area_m2;
                return true;

            case 'NO_AC_STORAGE_EQUIP':
                // Storage/equipment rooms: Must be ≥100m² contiguous AND no air conditioning
                const contiguousArea = a.contiguousArea_m2 ?? a.area_m2;
                const noAC = a.hasAirConditioning === false;
                if (contiguousArea >= 100 && noAC) {
                    breakdown.storageEquipment += a.area_m2;
                    return true;
                }
                return false;

            default:
                return false;
        }
    });

    const exemptTotal = qualifiedExempt.reduce((sum, a) => sum + a.area_m2, 0);
    const AFe = Math.max(0, areas.AF_total_m2 - exemptTotal);

    return { AFe, exemptTotal, qualifiedExempt, breakdown };
}

// ============================================
// Envelope Calculations (EEV)
// ============================================

export interface EEVCalcResult {
    EEV: number;
    details: {
        orientation: string;
        areaWall_m2: number;
        areaWindow_m2: number;
        U_wall: number;
        U_window: number;
        eta: number;
        Ki: number;
        WWR: number;
        term: number;
    }[];
    roofContribution: number;
    totalEnvelopeArea: number;
}

export function computeEEV(
    envelope: ProjectInput['envelope'],
    geometry: ProjectInput['geometry'],
    tables: Tables
): EEVCalcResult {
    const extracted = geometry.extracted;
    const overrides = geometry.overrides || {};

    let totalEnvelopeArea = 0;
    let weightedSum = 0;
    const details: EEVCalcResult['details'] = [];

    // Per-orientation calculations
    envelope.perOrientation.forEach(o => {
        const orient = o.orientation;

        // Get areas (with override support)
        const areaWall = o.areaWall_override ??
            (overrides.facadeAreasByOrientation?.[orient] ??
                (extracted.facadeAreasByOrientation[orient] || 0));
        const areaWindow = o.areaWindow_override ??
            (overrides.windowAreasByOrientation?.[orient] ??
                (extracted.windowAreasByOrientation[orient] || 0));

        // Lookup or use override values
        const glazingType = tables.glazing?.glazingTypes?.find(
            (g: any) => g.id === o.windowGlazingTypeId
        );
        const shadingType = tables.shading?.shadingTypes?.find(
            (s: any) => s.id === o.shadingTypeId
        );
        const wallConstruction = tables.constructions?.constructions?.find(
            (c: any) => c.id === o.wallConstructionId
        );

        const U_wall = wallConstruction?.U ?? 3.0; // Default if not found
        const U_window = o.windowU_override ?? glazingType?.U ?? 5.6;
        const eta = o.eta_override ?? glazingType?.eta ?? 0.7;
        const Ki = o.Ki_override ?? shadingType?.Ki ?? 1.0;

        // Calculate WWR for this orientation
        const totalFacade = areaWall + areaWindow;
        const WWR = totalFacade > 0 ? areaWindow / totalFacade : 0;

        // Envelope term: weighted by area
        // EEV formula contribution: (U_wall * A_wall) + (U_window * eta * Ki * A_window)
        const term = (areaWall * U_wall) + (areaWindow * U_window * eta * Ki);

        weightedSum += term;
        totalEnvelopeArea += totalFacade;

        details.push({
            orientation: orient,
            areaWall_m2: areaWall,
            areaWindow_m2: areaWindow,
            U_wall,
            U_window,
            eta,
            Ki,
            WWR,
            term
        });
    });

    // Roof contribution
    const roofArea = extracted.roofArea_m2 || 0;
    const roofConstruction = tables.constructions?.constructions?.find(
        (c: any) => c.id === envelope.roofConstructionId
    );
    const U_roof = roofConstruction?.U ?? 3.0;
    const roofContribution = roofArea * U_roof;
    weightedSum += roofContribution;
    totalEnvelopeArea += roofArea;

    // EEV = weighted average U-value across envelope
    const EEV = totalEnvelopeArea > 0 ? (weightedSum / totalEnvelopeArea) : 0;

    return { EEV, details, roofContribution, totalEnvelopeArea };
}

// ============================================
// MEP Calculations
// ============================================

export interface MEPCalcResult {
    EAC: number;
    EL: number;
    Et: number;
    EtEUI: number;
    EHW: number;
    HpEUI: number | null;
    Es: number;
    elevatorBreakdown: {
        groupName: string;
        Nej: number;
        Eelj: number;
        YOHj: number;
        contribution: number;
    }[];
}

export function computeMEP(
    mep: ProjectInput['mep'],
    AFe: number,
    tables: Tables,
    primaryUseId?: string
): MEPCalcResult {
    // HVAC Efficiency (EAC)
    const hvacSystem = tables.hvac?.systemTypes?.find(
        (h: any) => h.id === mep.hvac.systemTypeId
    );
    const EAC = mep.hvac.EAC ?? hvacSystem?.EAC_base ?? 1.0;

    // Lighting Efficiency (EL)
    const lightingSystem = tables.lighting?.systemTypes?.find(
        (l: any) => l.id === mep.lighting.systemTypeId
    );
    const EL = mep.lighting.EL ?? lightingSystem?.EL_base ?? 1.0;

    // Es (envelope-HVAC interaction factor) from building use
    const useCategory = tables.uses?.uses?.find((u: any) => u.id === primaryUseId);
    const Es = useCategory?.Es ?? 0.8;

    // Elevator Energy (Et / EtEUI)
    // EtEUI = (0.6 × Σ(Nej × Eelj × YOHj)) / AFe
    const OCCUPANCY_FACTOR = 0.6;
    const elevatorBreakdown: MEPCalcResult['elevatorBreakdown'] = [];

    let elevEnergy = 0;
    mep.elevator.groups.forEach(g => {
        const Eelj = g.Eelj;
        const YOHj = g.YOHj;
        const contribution = g.Nej * Eelj * YOHj;
        elevEnergy += contribution;

        elevatorBreakdown.push({
            groupName: g.name,
            Nej: g.Nej,
            Eelj,
            YOHj,
            contribution
        });
    });

    const EtEUI = AFe > 0 ? (OCCUPANCY_FACTOR * elevEnergy / AFe) : 0;
    const Et = mep.elevator.Et ?? 1.0; // Elevator efficiency factor

    // DHW (Domestic Hot Water)
    // HpEUI = (HPC × 8.0 × 365 × 0.7) / AFe
    let HpEUI: number | null = null;
    let EHW = 0;

    if (mep.dhw) {
        const dhwSystem = tables.dhw?.systemTypes?.find(
            (d: any) => d.id === mep.dhw?.systemTypeId
        );
        EHW = mep.dhw.EHW ?? dhwSystem?.EHW ?? 1.0;

        if (mep.dhw.HPC_kW && mep.dhw.HPC_kW > 0 && AFe > 0) {
            const HOURS_PER_DAY = 8.0;
            const DAYS_PER_YEAR = 365;
            const LOAD_FACTOR = 0.7;
            HpEUI = (mep.dhw.HPC_kW * HOURS_PER_DAY * DAYS_PER_YEAR * LOAD_FACTOR) / AFe;
        }
    }

    return { EAC, EL, Et, EtEUI, EHW, HpEUI, Es, elevatorBreakdown };
}

// ============================================
// Weight Calculations
// ============================================

export interface WeightCalcResult {
    a: number; // HVAC weight
    b: number; // Lighting weight
    c: number; // Elevator weight
    d: number; // DHW weight (0 if no DHW)
    hasDHW: boolean;
    totalDenominator: number;
}

export function computeWeights(
    AEUI: number,
    LEUI: number,
    EtEUI: number,
    HpEUI: number | null
): WeightCalcResult {
    const hasDHW = HpEUI !== null && HpEUI > 0;

    let a: number, b: number, c: number, d: number;
    let totalDenominator: number;

    if (hasDHW) {
        // With DHW: denominator includes HpEUI
        totalDenominator = AEUI + LEUI + EtEUI + HpEUI!;
        if (totalDenominator === 0) totalDenominator = 1; // Prevent division by zero

        a = AEUI / totalDenominator;
        b = LEUI / totalDenominator;
        c = EtEUI / totalDenominator;
        d = HpEUI! / totalDenominator;
    } else {
        // Without DHW
        totalDenominator = AEUI + LEUI + EtEUI;
        if (totalDenominator === 0) totalDenominator = 1;

        a = AEUI / totalDenominator;
        b = LEUI / totalDenominator;
        c = EtEUI / totalDenominator;
        d = 0;
    }

    return { a, b, c, d, hasDHW, totalDenominator };
}

// ============================================
// EEI Calculation
// ============================================

export interface EEICalcResult {
    EEI: number;
    hvacTerm: number;
    lightTerm: number;
    elevTerm: number;
    dhwTerm: number;
    termBreakdown: {
        name: string;
        weight: number;
        efficiency: number;
        contribution: number;
        percentage: number;
    }[];
}

export function computeEEI(
    mepStats: MEPCalcResult,
    EEV: number,
    weights: WeightCalcResult
): EEICalcResult {
    // EEI = a×(EAC − EEV×Es) + b×EL + c×Et + d×EHW

    // HVAC term: a × (EAC - EEV × Es)
    // Note: The envelope efficiency reduces HVAC load, so we subtract EEV×Es
    const hvacAdjusted = Math.max(0, mepStats.EAC - (EEV * mepStats.Es));
    const hvacTerm = weights.a * hvacAdjusted;

    // Lighting term: b × EL
    const lightTerm = weights.b * mepStats.EL;

    // Elevator term: c × Et
    const elevTerm = weights.c * mepStats.Et;

    // DHW term: d × EHW (only if applicable)
    const dhwTerm = weights.hasDHW ? (weights.d * mepStats.EHW) : 0;

    // Total EEI
    const EEI = hvacTerm + lightTerm + elevTerm + dhwTerm;

    // Contribution breakdown
    const total = EEI > 0 ? EEI : 1;
    const termBreakdown = [
        {
            name: 'HVAC',
            weight: weights.a,
            efficiency: hvacAdjusted,
            contribution: hvacTerm,
            percentage: (hvacTerm / total) * 100
        },
        {
            name: 'Lighting',
            weight: weights.b,
            efficiency: mepStats.EL,
            contribution: lightTerm,
            percentage: (lightTerm / total) * 100
        },
        {
            name: 'Elevator',
            weight: weights.c,
            efficiency: mepStats.Et,
            contribution: elevTerm,
            percentage: (elevTerm / total) * 100
        }
    ];

    if (weights.hasDHW) {
        termBreakdown.push({
            name: 'DHW',
            weight: weights.d,
            efficiency: mepStats.EHW,
            contribution: dhwTerm,
            percentage: (dhwTerm / total) * 100
        });
    }

    return { EEI, hvacTerm, lightTerm, elevTerm, dhwTerm, termBreakdown };
}

// ============================================
// Scoring (SCOREee)
// ============================================

export function computeScore(EEI: number): number {
    // SCOREee calculation:
    // if EEI ≤ 0.8: SCOREee = 50 + 40×(0.8−EEI)/0.3
    // else: SCOREee = 50×(2.0−EEI)/1.2

    if (EEI <= 0.8) {
        return 50 + 40 * (0.8 - EEI) / 0.3;
    } else {
        return 50 * (2.0 - EEI) / 1.2;
    }
}

// ============================================
// EUI Scale Calculations
// ============================================

export interface EUIScaleResult {
    AEUI: number;
    LEUI: number;
    EEUI: number;
    EtEUI: number;
    HpEUI: number;
    EUIn: number;  // Near-zero threshold
    EUIg: number;  // Good threshold
    EUIm: number;  // Minimum compliance threshold
    EUImax: number; // Maximum reference
}

export function computeEUIScale(
    UR: number,
    AEUI: number,
    LEUI: number,
    EEUI: number,
    EtEUI: number,
    HpEUI: number
): EUIScaleResult {
    // EUI scale formulas:
    // EUIn  = UR × (0.5 × (AEUI + LEUI + EtEUI + HpEUI) + EEUI)
    // EUIg  = UR × (0.8 × (AEUI + LEUI + EtEUI + HpEUI) + EEUI)
    // EUIm  = UR × (1.0 × (AEUI + LEUI + EtEUI + HpEUI) + EEUI)
    // EUImax= UR × (2.0 × (AEUI + LEUI + EtEUI + HpEUI) + EEUI)

    const operationalEUI = AEUI + LEUI + EtEUI + HpEUI;

    const EUIn = UR * (0.5 * operationalEUI + EEUI);
    const EUIg = UR * (0.8 * operationalEUI + EEUI);
    const EUIm = UR * (1.0 * operationalEUI + EEUI);
    const EUImax = UR * (2.0 * operationalEUI + EEUI);

    return { AEUI, LEUI, EEUI, EtEUI, HpEUI, EUIn, EUIg, EUIm, EUImax };
}

// ============================================
// Grade Determination
// ============================================

export function computeGrade(EEI: number, tables?: Tables): string {
    // Use configurable thresholds from tables if available
    const thresholds = tables?.grades?.gradeThresholds || [
        { grade: '1+', maxEEI: 0.50 },
        { grade: '1', maxEEI: 0.60 },
        { grade: '2', maxEEI: 0.70 },
        { grade: '3', maxEEI: 0.80 },
        { grade: '4', maxEEI: 1.00 },
        { grade: '5', maxEEI: 1.20 },
        { grade: '6', maxEEI: 1.50 },
        { grade: '7', maxEEI: 999 }
    ];

    for (const t of thresholds) {
        if (EEI <= t.maxEEI) {
            return t.grade;
        }
    }

    return '7';
}

export function getGradeInfo(grade: string, tables?: Tables) {
    const thresholds = tables?.grades?.gradeThresholds;
    if (thresholds) {
        const info = thresholds.find((t: any) => t.grade === grade);
        if (info) return info;
    }

    // Fallback defaults
    const defaults: Record<string, { label: string; color: string }> = {
        '1+': { label: '近零能耗建築', color: '#059669' },
        '1': { label: '超低能耗建築', color: '#10b981' },
        '2': { label: '高效能建築', color: '#22c55e' },
        '3': { label: '優良建築', color: '#84cc16' },
        '4': { label: '合格建築', color: '#eab308' },
        '5': { label: '待改善', color: '#f97316' },
        '6': { label: '高能耗', color: '#ef4444' },
        '7': { label: '極高能耗', color: '#dc2626' }
    };

    return defaults[grade] || { label: 'Unknown', color: '#9ca3af' };
}

// ============================================
// Main Computation Function
// ============================================

export function computeAll(input: ProjectInput, tables: Tables): CalcResult {
    const warnings: CalcResult['warnings'] = [];
    const resolvedLookups: CalcResult['resolvedLookups'] = [];

    // 1. Compute effective floor area
    const areaResult = computeAreas(input.areas);
    const AFe = areaResult.AFe;

    if (AFe <= 0) {
        warnings.push({
            code: 'ZERO_AFE',
            message: 'Effective floor area (AFe) is zero or negative',
            severity: 'ERROR',
            fields: ['areas.AF_total_m2']
        });
    }

    // 2. Get primary building use for lookups
    const primaryUse = input.basics.buildingUses[0];
    const primaryUseId = primaryUse?.useCategoryId;
    const useCategory = tables.uses?.uses?.find((u: any) => u.id === primaryUseId);

    if (useCategory) {
        resolvedLookups.push({
            tableName: 'use_categories',
            key: primaryUseId || '',
            rowUsed: useCategory
        });
    }

    // Get AEUI, LEUI, EEUI from building use category
    const AEUI = useCategory?.AEUI ?? 150;
    const LEUI = useCategory?.LEUI ?? 35;
    const EEUI = useCategory?.EEUI ?? 5;

    // 3. Compute envelope efficiency (EEV)
    const eevResult = computeEEV(input.envelope, input.geometry, tables);
    const EEV = eevResult.EEV;

    // 4. Compute MEP efficiencies
    const mepResult = computeMEP(input.mep, AFe, tables, primaryUseId);

    // 5. Compute weights
    const HpEUI = mepResult.HpEUI ?? 0;
    const weights = computeWeights(AEUI, LEUI, mepResult.EtEUI, input.basics.hasCentralDHW ? HpEUI : null);

    // 6. Compute EEI
    const eeiResult = computeEEI(mepResult, EEV, weights);
    const EEI = eeiResult.EEI;

    // 7. Compute score
    const SCOREee = computeScore(EEI);

    // 8. Compute EUI scale
    const euiScale = computeEUIScale(
        input.basics.UR,
        AEUI,
        LEUI,
        EEUI,
        mepResult.EtEUI,
        HpEUI
    );

    // 9. Determine grade
    const grade = computeGrade(EEI, tables as any);

    // Validation warnings
    if (EEI > 2.0) {
        warnings.push({
            code: 'HIGH_EEI',
            message: 'EEI exceeds maximum threshold (2.0)',
            severity: 'WARNING'
        });
    }

    // Check WWR by orientation
    eevResult.details.forEach(d => {
        if (d.WWR > 0.6) {
            warnings.push({
                code: 'HIGH_WWR',
                message: `High Window-to-Wall Ratio on ${d.orientation} facade (${(d.WWR * 100).toFixed(1)}%)`,
                severity: 'WARNING',
                fields: [`envelope.perOrientation.${d.orientation}`]
            });
        }
    });

    return {
        timestamp: new Date().toISOString(),
        resolvedLookups,
        intermediates: {
            EtEUI: mepResult.EtEUI,
            HpEUI: mepResult.HpEUI,
            weights: {
                a: weights.a,
                b: weights.b,
                c: weights.c,
                d: weights.d
            },
            hvacTerm: eeiResult.hvacTerm,
            lightTerm: eeiResult.lightTerm,
            elevTerm: eeiResult.elevTerm,
            dhwTerm: eeiResult.dhwTerm,
            EEV,
            eaveBreakdown: eevResult.details,
            AFe: areaResult.AFe,
            areaBreakdown: areaResult.breakdown,
            mepDetails: {
                EAC: mepResult.EAC,
                EL: mepResult.EL,
                Et: mepResult.Et,
                Es: mepResult.Es,
                EHW: mepResult.EHW,
                elevatorBreakdown: mepResult.elevatorBreakdown
            },
            termBreakdown: eeiResult.termBreakdown
        },
        KPIs: {
            EEI,
            SCOREee,
            grade,
            EUIn: euiScale.EUIn,
            EUIg: euiScale.EUIg,
            EUIm: euiScale.EUIm,
            EUImax: euiScale.EUImax
        },
        warnings
    };
}
