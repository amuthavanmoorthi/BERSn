/**
 * Shared geometry-metrics computation for the AUTO-CALC panel and for the
 * persisted workspace snapshot. Single source of truth so the displayed
 * numbers and the values stored in the backend can never drift apart.
 *
 * Built on `analyzeGeometry` (the same analyzer that feeds the EEV/EEI score),
 * so the per-orientation split reflects real azimuth and Ki reflects the
 * window-weighted shading of the actual shapes — not a global dropdown lookup.
 */
import { GeometryObject, Floor } from '../types';
import { analyzeGeometry } from './calculationEngine';
import { floorUnionArea, computeInternalEdgeLength } from './areaUnion';
import { getFaceSpecs } from '../utils/faceSpecs';

export interface DisplayGeometryMetrics {
  wallNorth: number;
  wallSouth: number;
  wallEast: number;
  wallWest: number;
  winNorth: number;
  winSouth: number;
  winEast: number;
  winWest: number;
  totalWallArea: number;
  totalWindowArea: number;
  roofArea: number;
  wwr: number;
  ki: number;
}

// Compute effective WWR for a floor shape, averaging per-face WWR values
// and respecting noWindowFaces (faces with no windows = 0% for averaging).
const getEffectiveWwr = (shape: Floor['shapes'][0]): number => {
  const specs = getFaceSpecs(shape, 'zh');
  if (specs.length === 0) return shape.params.wwr ?? 0.35;
  const noWinSet = new Set(shape.params.noWindowFaces || []);
  const wwrs = specs.map(spec => {
    if (noWinSet.has(spec.key)) return 0;
    return shape.params.wwrByFace?.[spec.key] ?? shape.params.wwr ?? 0.35;
  });
  return wwrs.reduce((a, b) => a + b, 0) / wwrs.length;
};

export function computeGeometryMetrics(
  objects: GeometryObject[],
  floors?: Floor[],
): DisplayGeometryMetrics {
  const m = analyzeGeometry(objects);
  let winN = m.winNorth, winS = m.winSouth, winE = m.winEast, winW = m.winWest;
  let totalWindowArea = m.totalWindowArea;
  let roofArea = m.roofArea;

  if (floors && floors.length > 0) {
    // Roof area: per-floor union (avoid double-counting overlaps).
    roofArea = floors.reduce((sum, f) => sum + floorUnionArea(f.shapes), 0);
    // Window area: deduct shared / internal edge windows (faces that overlap or
    // sit inside another shape don't open windows).
    let internalWinDeduct = 0;
    for (const fl of floors) {
      for (const sh of fl.shapes) {
        const internalLen = computeInternalEdgeLength(sh, fl.shapes);
        if (internalLen <= 0) continue;
        const wwr = getEffectiveWwr(sh);
        const h = (sh.params as any).extrudeHeight || fl.floorHeight || 3.5;
        internalWinDeduct += internalLen * h * wwr;
      }
    }
    // Spread the deduction across orientations in proportion to each one's
    // window share, so the four cards still sum to the WIN total.
    const rawWin = winN + winS + winE + winW;
    const keep = rawWin > 0 ? Math.max(0, rawWin - internalWinDeduct) / rawWin : 1;
    winN *= keep; winS *= keep; winE *= keep; winW *= keep;
    totalWindowArea = Math.max(0, totalWindowArea - internalWinDeduct);
  }

  return {
    wallNorth: m.wallNorth,
    wallSouth: m.wallSouth,
    wallEast: m.wallEast,
    wallWest: m.wallWest,
    winNorth: winN,
    winSouth: winS,
    winEast: winE,
    winWest: winW,
    totalWallArea: m.totalWallArea,
    totalWindowArea,
    roofArea,
    wwr: m.totalWallArea > 0 ? totalWindowArea / m.totalWallArea : 0,
    // Ki = window-area-weighted shading ratio from the real shapes (same value
    // the calc engine uses), replacing the old global shading-dropdown lookup.
    ki: m.effectiveShadingRatio,
  };
}
