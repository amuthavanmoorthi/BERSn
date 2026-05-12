
import { ProjectBaseline, GeometryObject, Measure, MeasureImpact, EnergyKPIs, BuildingCategory, Scenario } from '../types';
import { calculateKPIs } from './calculationEngine';

/**
 * 輔助函數：根據路徑修改物件屬性 (Deep set)
 */
function patchObject(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current[parts[i]] = { ...current[parts[i]] };
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * 檢查措施是否適用於當前專案
 */
export function checkEligibility(baseline: ProjectBaseline, kpis: EnergyKPIs, measure: Measure): { eligible: boolean; reason?: string } {
  const { eligibility } = measure;
  
  if (eligibility.buildingUse && !eligibility.buildingUse.includes(baseline.category)) {
    return { eligible: false, reason: `Only for ${eligibility.buildingUse.join(', ')}` };
  }
  
  if (eligibility.minWWR && kpis.metrics.overallWwr < eligibility.minWWR) {
    return { eligible: false, reason: `Requires WWR > ${(eligibility.minWWR * 100).toFixed(0)}%` };
  }

  if (eligibility.maxWWR && kpis.metrics.overallWwr > eligibility.maxWWR) {
    return { eligible: false, reason: `Requires WWR < ${(eligibility.maxWWR * 100).toFixed(0)}%` };
  }

  return { eligible: true };
}

/**
 * 估算措施實施成本
 */
export function estimateCost(baseline: ProjectBaseline, kpis: EnergyKPIs, measure: Measure): number {
  const { costModel } = measure;
  switch (costModel.type) {
    case 'PER_M2_WINDOW':
      return kpis.metrics.totalWindowArea * costModel.unitCost;
    case 'PER_M2_FACADE':
      return kpis.metrics.totalWallArea * costModel.unitCost;
    case 'PER_M2_ROOF':
      return kpis.metrics.roofArea * costModel.unitCost;
    case 'PER_UNIT':
      return costModel.unitCost; // 這裡假設單次專案為一單位
    case 'FIXED':
      return costModel.unitCost;
    default:
      return 0;
  }
}

/**
 * 模擬單一措施的影響
 */
export function simulateMeasure(baseline: ProjectBaseline, objects: GeometryObject[], kpis: EnergyKPIs, measure: Measure): MeasureImpact {
  const { eligible, reason } = checkEligibility(baseline, kpis, measure);
  
  if (!eligible) {
    return {
      measureId: measure.id,
      deltaEEI: 0,
      deltaScore: 0,
      cost: 0,
      totalCost: 0,
      cpValue: 0,
      isEligible: false,
      ineligibleReason: reason
    };
  }

  // Clone baseline 並套用 patches
  const clonedBaseline = JSON.parse(JSON.stringify(baseline));
  measure.patches.forEach(patch => patchObject(clonedBaseline, patch.path, patch.value));
  
  const newKPIs = calculateKPIs(clonedBaseline, objects);
  const cost = estimateCost(baseline, kpis, measure);
  const deltaEEI = kpis.eei - newKPIs.eei;
  const deltaScore = newKPIs.score - kpis.score;
  
  return {
    measureId: measure.id,
    deltaEEI,
    deltaScore,
    cost,
    totalCost: cost,
    cpValue: cost > 0 ? (deltaEEI * 1000000) / cost : 0, // 縮放係數方便排序顯示
    isEligible: true
  };
}

/**
 * 模擬組合方案（Scenario）
 */
export function simulateScenario(baseline: ProjectBaseline, objects: GeometryObject[], originalKPIs: EnergyKPIs, measures: Measure[]): { kpis: EnergyKPIs; totalCost: number } {
  const clonedBaseline = JSON.parse(JSON.stringify(baseline));
  let totalCost = 0;

  measures.forEach(m => {
    m.patches.forEach(patch => patchObject(clonedBaseline, patch.path, patch.value));
    totalCost += estimateCost(baseline, originalKPIs, m);
  });

  return {
    kpis: calculateKPIs(clonedBaseline, objects),
    totalCost
  };
}
