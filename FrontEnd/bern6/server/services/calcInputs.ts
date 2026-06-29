/**
 * Compose the calculation inputs the energy formula consumes.
 *
 * Reads from a project's SQLite, runs geometry math, and returns a stable
 * shape (CalcInputs) regardless of how the 3D editor evolves. The energy
 * engine only needs to call /calc/inputs.
 *
 * Geometry math is shared with the client (no duplication) by importing the
 * existing `services/areaUnion` module — types.ts has zero browser deps.
 */
import {
  shapeToPolygons,
  computeInternalEdgeLength,
  floorUnionArea,
} from '../../services/areaUnion.js';
import type { Floor, FloorShape, GlassType, ShadingType } from '../../types.js';
import { openProjectDb, indexDb } from '../db.js';

interface ProjectRow {
  id: string;
  name: string;
  organization: string | null;
  location: string | null;
  status: string;
  category: string | null;
  building_type: string | null;
  total_area: number | null;
  grade: string | null;
  eei: number | null;
  thumbnail: string | null;
  created_at: number;
  updated_at: number;
}

// ---- Local DB → Floor[] (matches floorsRouter) ----
function readFloors(projectId: string): Floor[] {
  const db = openProjectDb(projectId);
  const floorRows = db
    .prepare('SELECT id, name, floor_height, order_index FROM floors ORDER BY order_index ASC')
    .all() as Array<{ id: string; name: string; floor_height: number; order_index: number }>;
  const shapeRows = db
    .prepare('SELECT id, floor_id, type, position_x, position_y, rotation, params_json, order_index FROM shapes ORDER BY order_index ASC')
    .all() as Array<{
      id: string; floor_id: string; type: string;
      position_x: number; position_y: number; rotation: number;
      params_json: string; order_index: number;
    }>;
  const byFloor = new Map<string, FloorShape[]>();
  for (const s of shapeRows) {
    let params: any = {};
    try { params = JSON.parse(s.params_json); } catch { /* ignore */ }
    const list = byFloor.get(s.floor_id) ?? [];
    list.push({
      id: s.id,
      type: s.type as FloorShape['type'],
      params,
      position: { x: s.position_x, y: s.position_y },
      rotation: s.rotation,
    });
    byFloor.set(s.floor_id, list);
  }
  return floorRows.map(f => ({
    id: f.id,
    name: f.name,
    floorHeight: f.floor_height,
    shapes: byFloor.get(f.id) ?? [],
  }));
}

function readProjectMeta(projectId: string): ProjectRow | null {
  return (indexDb()
    .prepare('SELECT * FROM project_index WHERE id = ?')
    .get(projectId) as ProjectRow | undefined) ?? null;
}

function readParams(projectId: string, group: string): Record<string, unknown> | null {
  const db = openProjectDb(projectId);
  const row = db
    .prepare('SELECT value_json FROM project_params WHERE group_key = ?')
    .get(group) as { value_json: string } | undefined;
  if (!row) return null;
  try { return JSON.parse(row.value_json); } catch { return null; }
}

// ---- Geometry summary ----

function polygonPerimeter(poly: { x: number; y: number }[]): number {
  if (poly.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

function shapePerimeter(s: FloorShape): number {
  let total = 0;
  for (const poly of shapeToPolygons(s)) total += polygonPerimeter(poly);
  return total;
}

export interface PerFloorGeometry {
  id: string;
  name: string;
  floorHeight: number;
  area: number;                  // union footprint (m²)
  perimeter: number;             // sum over shapes (m)
  externalEdgeLength: number;    // perimeter - internal edges (m)
  internalEdgeLength: number;    // shared/inside-other-shape edges (m)
  shapeCount: number;
}

export interface GeometrySummary {
  totalFloorArea: number;        // sum of per-floor union areas
  floorCount: number;
  shapeCount: number;
  perFloor: PerFloorGeometry[];
}

export function computeGeometrySummary(floors: Floor[]): GeometrySummary {
  let totalArea = 0;
  let totalShapes = 0;
  const perFloor: PerFloorGeometry[] = floors.map(f => {
    const area = floorUnionArea(f.shapes);
    let perim = 0;
    let internal = 0;
    for (const s of f.shapes) {
      perim += shapePerimeter(s);
      internal += computeInternalEdgeLength(s, f.shapes);
    }
    const external = Math.max(0, perim - internal);
    totalArea += area;
    totalShapes += f.shapes.length;
    return {
      id: f.id,
      name: f.name,
      floorHeight: f.floorHeight,
      area,
      perimeter: perim,
      externalEdgeLength: external,
      internalEdgeLength: internal,
      shapeCount: f.shapes.length,
    };
  });
  return {
    totalFloorArea: totalArea,
    floorCount: floors.length,
    shapeCount: totalShapes,
    perFloor,
  };
}

// ---- Envelope summary ----

const GLASS_PERFORMANCE: Record<GlassType, { u: number; eta: number }> = {
  'Single':      { u: 5.8, eta: 0.85 },
  'Double':      { u: 2.8, eta: 0.70 },
  'Triple-LowE': { u: 1.2, eta: 0.45 },
  'Vacuum':      { u: 0.7, eta: 0.35 },
};
const SHADING_FACTOR: Record<ShadingType, number> = {
  'None': 1.0, 'Horizontal': 0.8, 'Vertical': 0.85, 'Eggcrate': 0.7, 'Louver': 0.75,
};

export interface EnvelopeSummary {
  totalWallArea: number;       // external wall area only (m²)
  totalWindowArea: number;     // wall × wwr (per-shape weighted)
  totalRoofArea: number;       // top floor union area
  glassMix:   Record<string, number>;   // area-weighted shares (sum = 1 if any windows)
  shadingMix: Record<string, number>;
  uValueWeighted: { wall: number | null; glass: number | null; roof: number | null };
  etaWeighted:    { glass: number | null };
}

export function computeEnvelopeSummary(
  floors: Floor[],
  geom: GeometrySummary,
  envelopeParams?: Record<string, any> | null,
): EnvelopeSummary {
  let wallTotal = 0;
  let winTotal = 0;
  const glassAreaByType: Record<string, number> = {};
  const shadingAreaByType: Record<string, number> = {};

  floors.forEach((f, fi) => {
    const perFloorRow = geom.perFloor[fi];
    const externalLen = perFloorRow?.externalEdgeLength ?? 0;
    if (externalLen <= 0 || f.shapes.length === 0) return;

    // Distribute external length per shape proportional to shape's external share
    // (we just compute per shape directly: shape's perimeter - its internal length)
    for (const s of f.shapes) {
      const sPerim = shapePerimeter(s);
      const sInternal = computeInternalEdgeLength(s, f.shapes);
      const sExternal = Math.max(0, sPerim - sInternal);
      const wallA = sExternal * f.floorHeight;
      wallTotal += wallA;

      const wwr = Math.min(0.95, Math.max(0, s.params?.wwr ?? 0));
      const winA = wallA * wwr;
      winTotal += winA;
      const gt = s.params?.glassType ?? 'Double';
      const sh = s.params?.shadingType ?? 'None';
      glassAreaByType[gt] = (glassAreaByType[gt] ?? 0) + winA;
      shadingAreaByType[sh] = (shadingAreaByType[sh] ?? 0) + winA;
    }
  });

  // Roof = top floor's union area (≈ footprint of the highest floor present)
  const topFloor = geom.perFloor[geom.perFloor.length - 1];
  const roofTotal = topFloor?.area ?? 0;

  const norm = (m: Record<string, number>, total: number): Record<string, number> => {
    if (total <= 0) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) out[k] = v / total;
    return out;
  };

  // U-value / eta weighting (area-weighted)
  let uGlass: number | null = null;
  let etaGlass: number | null = null;
  if (winTotal > 0) {
    let uSum = 0;
    let etaSum = 0;
    for (const [k, a] of Object.entries(glassAreaByType)) {
      const perf = GLASS_PERFORMANCE[k as GlassType] ?? GLASS_PERFORMANCE['Double'];
      uSum += perf.u * a;
      etaSum += perf.eta * a;
    }
    uGlass = uSum / winTotal;
    etaGlass = etaSum / winTotal;
    // shadingMix already computed; envelope-level eta applies shading factor too
    let shadingFactor = 0;
    for (const [k, a] of Object.entries(shadingAreaByType)) {
      shadingFactor += (SHADING_FACTOR[k as ShadingType] ?? 1.0) * a;
    }
    shadingFactor /= winTotal;
    etaGlass = etaGlass * shadingFactor;
  }

  // Wall / roof U-values come from envelopeParams (set in ProjectSettingsPanel)
  const uWall = typeof envelopeParams?.wallUValue === 'number' ? envelopeParams.wallUValue : null;
  const uRoof = typeof envelopeParams?.roofUValue === 'number' ? envelopeParams.roofUValue : null;

  return {
    totalWallArea: wallTotal,
    totalWindowArea: winTotal,
    totalRoofArea: roofTotal,
    glassMix:   norm(glassAreaByType, winTotal),
    shadingMix: norm(shadingAreaByType, winTotal),
    uValueWeighted: { wall: uWall, glass: uGlass, roof: uRoof },
    etaWeighted: { glass: etaGlass },
  };
}

// ---- Top-level ----
export interface CalcInputs {
  project: any;
  geometry: GeometrySummary;
  envelope: EnvelopeSummary;
  envelopeParams: Record<string, unknown> | null;
  mep: Record<string, unknown> | null;
  baseline: Record<string, unknown> | null;
  generatedAt: number;
}

export function buildCalcInputs(projectId: string): CalcInputs {
  const meta = readProjectMeta(projectId);
  const floors = readFloors(projectId);
  const envelopeParams = readParams(projectId, 'envelope');
  const mep = readParams(projectId, 'mep');
  const baseline = readParams(projectId, 'baseline');
  const geometry = computeGeometrySummary(floors);
  const envelope = computeEnvelopeSummary(floors, geometry, envelopeParams);
  return {
    project: meta,
    geometry,
    envelope,
    envelopeParams,
    mep,
    baseline,
    generatedAt: Date.now(),
  };
}

// Re-export for routes that just want one piece
export { readFloors };
