/**
 * Sensitivity Analysis Module
 * 
 * Computes ΔEEI estimates when major parameters change.
 * Uses finite difference approach for sensitivity estimation.
 */

import { ProjectInput } from '../zod/projectInput';
import { Tables } from './tables';
import { computeAll } from './engine';

export interface SensitivityResult {
    parameter: string;
    label: string;
    baseValue: number;
    testValue: number;
    baseEEI: number;
    newEEI: number;
    deltaEEI: number;
    percentChange: number;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SensitivityAnalysis {
    baseEEI: number;
    parameters: SensitivityResult[];
    topImpacts: SensitivityResult[];
}

// Standard perturbation factors
const PERTURBATIONS = {
    // Improve by 20%
    EAC: { factor: 0.8, label: 'HVAC Efficiency (EAC) -20%' },
    EL: { factor: 0.8, label: 'Lighting Efficiency (EL) -20%' },
    Et: { factor: 0.8, label: 'Elevator Efficiency (Et) -20%' },
    EHW: { factor: 0.8, label: 'DHW Efficiency (EHW) -20%' },
    // Envelope improvements
    windowU: { factor: 0.7, label: 'Window U-value -30%' },
    eta: { factor: 0.7, label: 'Window SHGC (η) -30%' },
    Ki: { factor: 0.7, label: 'Shading Coefficient (Ki) -30%' },
    WWR: { factor: 0.8, label: 'Window-to-Wall Ratio -20%' },
};

export function computeSensitivity(
    input: ProjectInput,
    tables: Tables
): SensitivityAnalysis {
    // Calculate base case
    const baseResult = computeAll(input, tables);
    const baseEEI = baseResult.KPIs.EEI;

    const parameters: SensitivityResult[] = [];

    // 1. HVAC Sensitivity (EAC)
    if (input.mep.hvac.EAC !== undefined) {
        const modifiedInput = deepClone(input);
        const originalValue = input.mep.hvac.EAC;
        modifiedInput.mep.hvac.EAC = originalValue * PERTURBATIONS.EAC.factor;
        const newResult = computeAll(modifiedInput, tables);

        parameters.push({
            parameter: 'EAC',
            label: PERTURBATIONS.EAC.label,
            baseValue: originalValue,
            testValue: modifiedInput.mep.hvac.EAC,
            baseEEI,
            newEEI: newResult.KPIs.EEI,
            deltaEEI: newResult.KPIs.EEI - baseEEI,
            percentChange: ((newResult.KPIs.EEI - baseEEI) / baseEEI) * 100,
            impact: categorizeImpact(newResult.KPIs.EEI - baseEEI)
        });
    }

    // 2. Lighting Sensitivity (EL)
    if (input.mep.lighting.EL !== undefined) {
        const modifiedInput = deepClone(input);
        const originalValue = input.mep.lighting.EL;
        modifiedInput.mep.lighting.EL = originalValue * PERTURBATIONS.EL.factor;
        const newResult = computeAll(modifiedInput, tables);

        parameters.push({
            parameter: 'EL',
            label: PERTURBATIONS.EL.label,
            baseValue: originalValue,
            testValue: modifiedInput.mep.lighting.EL,
            baseEEI,
            newEEI: newResult.KPIs.EEI,
            deltaEEI: newResult.KPIs.EEI - baseEEI,
            percentChange: ((newResult.KPIs.EEI - baseEEI) / baseEEI) * 100,
            impact: categorizeImpact(newResult.KPIs.EEI - baseEEI)
        });
    }

    // 3. Elevator Sensitivity (Et)
    if (input.mep.elevator.Et !== undefined) {
        const modifiedInput = deepClone(input);
        const originalValue = input.mep.elevator.Et;
        modifiedInput.mep.elevator.Et = originalValue * PERTURBATIONS.Et.factor;
        const newResult = computeAll(modifiedInput, tables);

        parameters.push({
            parameter: 'Et',
            label: PERTURBATIONS.Et.label,
            baseValue: originalValue,
            testValue: modifiedInput.mep.elevator.Et,
            baseEEI,
            newEEI: newResult.KPIs.EEI,
            deltaEEI: newResult.KPIs.EEI - baseEEI,
            percentChange: ((newResult.KPIs.EEI - baseEEI) / baseEEI) * 100,
            impact: categorizeImpact(newResult.KPIs.EEI - baseEEI)
        });
    }

    // 4. DHW Sensitivity (EHW) - only if DHW is applicable
    if (input.basics.hasCentralDHW && input.mep.dhw?.EHW !== undefined) {
        const modifiedInput = deepClone(input);
        const originalValue = input.mep.dhw!.EHW!;
        modifiedInput.mep.dhw!.EHW = originalValue * PERTURBATIONS.EHW.factor;
        const newResult = computeAll(modifiedInput, tables);

        parameters.push({
            parameter: 'EHW',
            label: PERTURBATIONS.EHW.label,
            baseValue: originalValue,
            testValue: modifiedInput.mep.dhw!.EHW!,
            baseEEI,
            newEEI: newResult.KPIs.EEI,
            deltaEEI: newResult.KPIs.EEI - baseEEI,
            percentChange: ((newResult.KPIs.EEI - baseEEI) / baseEEI) * 100,
            impact: categorizeImpact(newResult.KPIs.EEI - baseEEI)
        });
    }

    // 5. Window U-value sensitivity (apply to all orientations)
    {
        const modifiedInput = deepClone(input);
        let hasWindowU = false;
        modifiedInput.envelope.perOrientation.forEach(o => {
            if (o.windowU_override !== undefined) {
                hasWindowU = true;
                o.windowU_override = o.windowU_override * PERTURBATIONS.windowU.factor;
            }
        });

        if (hasWindowU) {
            const newResult = computeAll(modifiedInput, tables);
            parameters.push({
                parameter: 'windowU',
                label: PERTURBATIONS.windowU.label,
                baseValue: 1.0, // Normalized
                testValue: PERTURBATIONS.windowU.factor,
                baseEEI,
                newEEI: newResult.KPIs.EEI,
                deltaEEI: newResult.KPIs.EEI - baseEEI,
                percentChange: ((newResult.KPIs.EEI - baseEEI) / baseEEI) * 100,
                impact: categorizeImpact(newResult.KPIs.EEI - baseEEI)
            });
        }
    }

    // 6. Shading coefficient sensitivity (Ki)
    {
        const modifiedInput = deepClone(input);
        let hasKi = false;
        modifiedInput.envelope.perOrientation.forEach(o => {
            if (o.Ki_override !== undefined) {
                hasKi = true;
                o.Ki_override = o.Ki_override * PERTURBATIONS.Ki.factor;
            }
        });

        if (hasKi) {
            const newResult = computeAll(modifiedInput, tables);
            parameters.push({
                parameter: 'Ki',
                label: PERTURBATIONS.Ki.label,
                baseValue: 1.0,
                testValue: PERTURBATIONS.Ki.factor,
                baseEEI,
                newEEI: newResult.KPIs.EEI,
                deltaEEI: newResult.KPIs.EEI - baseEEI,
                percentChange: ((newResult.KPIs.EEI - baseEEI) / baseEEI) * 100,
                impact: categorizeImpact(newResult.KPIs.EEI - baseEEI)
            });
        }
    }

    // Sort by absolute deltaEEI (largest impact first)
    parameters.sort((a, b) => Math.abs(a.deltaEEI) - Math.abs(b.deltaEEI));

    // Get top 3 impacts
    const topImpacts = parameters.slice(0, 3);

    return {
        baseEEI,
        parameters,
        topImpacts
    };
}

function categorizeImpact(deltaEEI: number): 'HIGH' | 'MEDIUM' | 'LOW' {
    const absDelta = Math.abs(deltaEEI);
    if (absDelta >= 0.1) return 'HIGH';
    if (absDelta >= 0.05) return 'MEDIUM';
    return 'LOW';
}

function deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
}
