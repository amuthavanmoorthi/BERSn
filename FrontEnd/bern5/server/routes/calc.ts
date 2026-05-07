/**
 * Calculation API — surfaces normalized inputs the energy engine can consume
 * without knowing anything about the 3D editor's internals.
 *
 *   GET  /geometry-summary  → per-floor area/perimeter/internal-edge breakdown
 *   GET  /envelope-summary  → wall/window/roof areas + glass/shading mix
 *   GET  /inputs            → bundled CalcInputs (★ stable contract for engines)
 *   GET  /params/:group     → raw stored params (baseline/envelope/mep/...)
 *   PUT  /params/:group     → upsert a params group (JSON blob)
 *   POST /run               → run the energy engine and save a snapshot
 *   GET  /snapshots         → list past snapshots
 */
import { Router, type Request, type Response } from 'express';
import { indexDb, openProjectDb, assertValidProjectId } from '../db.js';
import {
  buildCalcInputs,
  computeGeometrySummary,
  computeEnvelopeSummary,
  readFloors,
  type CalcInputs,
} from '../services/calcInputs.js';
import { calculateKPIs } from '../../services/calculationEngine.js';
import {
  BuildingCategory,
  GeographicRegion,
  HVACMode,
  type Floor,
  type GeometryObject,
  type GeometryType,
  type ProjectBaseline,
} from '../../types.js';

// ---- Helpers: convert local floor model → calculateKPIs inputs ----

function floorsToGeometryObjects(floors: Floor[]): GeometryObject[] {
  const objects: GeometryObject[] = [];
  for (const floor of floors) {
    for (const shape of floor.shapes) {
      objects.push({
        id: `${floor.id}-${shape.id}`,
        type: shape.type as GeometryType,
        params: {
          ...shape.params,
          // Inject floor height so wall-area formulas work correctly.
          height: floor.floorHeight,
        },
        position: shape.position
          ? [shape.position.x, 0, shape.position.y]
          : [0, 0, 0],
      } as GeometryObject);
    }
  }
  return objects;
}

const BUILDING_TYPE_TO_CATEGORY: Record<string, BuildingCategory> = {
  office:      BuildingCategory.OFFICE,
  hotel:       BuildingCategory.HOTEL,
  hospital:    BuildingCategory.HOSPITAL,
  school:      BuildingCategory.SCHOOL,
  retail:      BuildingCategory.MALL,
  mall:        BuildingCategory.MALL,
  residential: BuildingCategory.RESIDENTIAL,
  mixed:       BuildingCategory.MIXED,
};

const REGION_KEY_TO_ENUM: Record<string, GeographicRegion> = {
  A: GeographicRegion.A,
  B: GeographicRegion.B,
  C: GeographicRegion.C,
  D: GeographicRegion.D,
};

function buildBaseline(calcInputs: CalcInputs): ProjectBaseline {
  const b    = (calcInputs.baseline      ?? {}) as Record<string, unknown>;
  const ep   = (calcInputs.envelopeParams ?? {}) as Record<string, unknown>;
  const mepR = (calcInputs.mep           ?? {}) as Record<string, unknown>;
  const geo  = calcInputs.geometry;

  const hvacR     = (mepR.hvac      as Record<string, unknown> | null) ?? mepR;
  const lightingR = (mepR.lighting  as Record<string, unknown> | null) ?? mepR;
  const elevR     = (mepR.elevator  as Record<string, unknown> | null) ?? mepR;
  const dhwR      = (mepR.dhw       as Record<string, unknown> | null) ?? mepR;

  const buildingType = String(calcInputs.project?.building_type ?? b.buildingType ?? 'office').toLowerCase();
  const regionKey    = String(b.region ?? 'A').replace(/^REGION_/, '');

  return {
    id:      String(calcInputs.project?.id ?? ''),
    name:    String(calcInputs.project?.name ?? ''),
    address: String(calcInputs.project?.location ?? ''),

    category: BUILDING_TYPE_TO_CATEGORY[buildingType] ?? BuildingCategory.OFFICE,
    region:   REGION_KEY_TO_ENUM[regionKey]           ?? GeographicRegion.A,
    ur:       typeof b.ur === 'number' ? b.ur : 1.0,
    hvacMode: b.hvacMode === HVACMode.INTERMITTENT ? HVACMode.INTERMITTENT : HVACMode.YEAR_ROUND,

    intermittentChecks: {
      shortDepth:      Boolean(b.shortDepth),
      noCentralPlant:  Boolean(b.noCentralPlant),
      openableWindows: Boolean(b.openableWindows),
    },

    totalFloorAreaAF: geo.totalFloorArea > 0
      ? geo.totalFloorArea
      : typeof b.totalFloorAreaAF === 'number' ? b.totalFloorAreaAF : 1000,

    exemptAreas: Array.isArray(b.exemptAreas) ? b.exemptAreas as ProjectBaseline['exemptAreas'] : [],

    envelope: {
      wallMaterial:  String(ep.wallMaterial  ?? ''),
      wallThickness: Number(ep.wallThickness ?? 0.2),
      wallKValue:    Number(ep.wallKValue    ?? 1.0),
      wallUValue:    Number(ep.wallUValue    ?? 1.5),
      roofMaterial:  String(ep.roofMaterial  ?? ''),
      roofThickness: Number(ep.roofThickness ?? 0.2),
      roofKValue:    Number(ep.roofKValue    ?? 0.5),
      roofUValue:    Number(ep.roofUValue    ?? 0.5),
      eev:           Number(ep.eev           ?? 1.0),
      shadingKi:     Number(ep.shadingKi     ?? 1.0),
      glassUValue:   Number(ep.glassUValue   ?? 2.8),
      glassEtaI:     Number(ep.glassEtaI     ?? 0.7),
    },

    mep: {
      hvac: {
        systemType:      String(hvacR.systemType      ?? 'vrf'),
        cop:             Number(hvacR.cop             ?? 3.5),
        auxEff:          Number(hvacR.auxEff          ?? 1.0),
        controlStrategy: Number(hvacR.controlStrategy ?? 1.0),
        coverage:        Number(hvacR.coverage        ?? 1.0),
      },
      lighting: {
        lpd:           Number(lightingR.lpd           ?? 10),
        controlFactor: Number(lightingR.controlFactor ?? 1.0),
        coverage:      Number(lightingR.coverage      ?? 1.0),
      },
      elevator: {
        type:          String(elevR.type          ?? 'vvvf'),
        effConstant:   Number(elevR.effConstant   ?? 1.0),
        numElevators:  Number(elevR.numElevators  ?? 2),
        energyPerCycle:Number(elevR.energyPerCycle?? 0.04),
        yearlyHours:   Number(elevR.yearlyHours   ?? 3000),
      },
      dhw: {
        hasDhw:      Boolean(dhwR.hasDhw      ?? false),
        systemType:  String(dhwR.systemType  ?? 'none'),
        hpc:         Number(dhwR.hpc         ?? 0),
        ehwConstant: Number(dhwR.ehwConstant ?? 0),
        loadFactor:  Number(dhwR.loadFactor  ?? 0.7),
      },
    },
  };
}

export const calcRouter = Router({ mergeParams: true });

function projectExists(id: string): boolean {
  return !!indexDb().prepare('SELECT 1 FROM project_index WHERE id = ?').get(id);
}

function getId(req: Request): string {
  const id = String((req.params as any).id);
  assertValidProjectId(id);
  return id;
}

// ---- GET /geometry-summary ----
calcRouter.get('/geometry-summary', (req, res) => {
  const id = getId(req);
  if (!projectExists(id)) return res.status(404).json({ error: 'Project not found' });
  const floors = readFloors(id);
  res.json(computeGeometrySummary(floors));
});

// ---- GET /envelope-summary ----
calcRouter.get('/envelope-summary', (req, res) => {
  const id = getId(req);
  if (!projectExists(id)) return res.status(404).json({ error: 'Project not found' });
  const floors = readFloors(id);
  const geom = computeGeometrySummary(floors);
  const envelopeParams = (() => {
    const row = openProjectDb(id)
      .prepare('SELECT value_json FROM project_params WHERE group_key = ?')
      .get('envelope') as { value_json: string } | undefined;
    if (!row) return null;
    try { return JSON.parse(row.value_json); } catch { return null; }
  })();
  res.json(computeEnvelopeSummary(floors, geom, envelopeParams));
});

// ---- GET /inputs ----
calcRouter.get('/inputs', (req, res) => {
  const id = getId(req);
  if (!projectExists(id)) return res.status(404).json({ error: 'Project not found' });
  res.json(buildCalcInputs(id));
});

// ---- params (baseline / envelope / mep / ...) ----
const ALLOWED_GROUPS = new Set([
  'baseline', 'envelope', 'mep', 'hvac', 'lighting', 'elevator', 'dhw',
]);

calcRouter.get('/params/:group', (req, res) => {
  const id = getId(req);
  if (!projectExists(id)) return res.status(404).json({ error: 'Project not found' });
  const group = String((req.params as any).group);
  if (!ALLOWED_GROUPS.has(group)) return res.status(400).json({ error: 'unknown group' });
  const row = openProjectDb(id)
    .prepare('SELECT value_json, updated_at FROM project_params WHERE group_key = ?')
    .get(group) as { value_json: string; updated_at: number } | undefined;
  if (!row) return res.json({ group, value: null, updatedAt: null });
  let value: unknown = null;
  try { value = JSON.parse(row.value_json); } catch { /* ignore */ }
  res.json({ group, value, updatedAt: row.updated_at });
});

calcRouter.put('/params/:group', (req, res) => {
  const id = getId(req);
  if (!projectExists(id)) return res.status(404).json({ error: 'Project not found' });
  const group = String((req.params as any).group);
  if (!ALLOWED_GROUPS.has(group)) return res.status(400).json({ error: 'unknown group' });
  const value = req.body?.value;
  if (value === undefined) return res.status(400).json({ error: 'value is required' });

  const now = Date.now();
  openProjectDb(id).prepare(`
    INSERT INTO project_params (group_key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(group_key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(group, JSON.stringify(value), now);

  indexDb().prepare('UPDATE project_index SET updated_at = ? WHERE id = ?').run(now, id);
  res.json({ ok: true, group, updatedAt: now });
});

// ---- POST /run ----
// Builds ProjectBaseline + GeometryObject[] from the stored SQLite data,
// runs the real energy engine, saves a snapshot, and returns full KPIs.
calcRouter.post('/run', (req, res) => {
  const id = getId(req);
  if (!projectExists(id)) return res.status(404).json({ error: 'Project not found' });

  try {
    const inputs   = buildCalcInputs(id);
    const floors   = readFloors(id);
    const baseline = buildBaseline(inputs);
    const geoObjs  = floorsToGeometryObjects(floors);

    // Guard: need at least one shape to compute meaningful results.
    if (geoObjs.length === 0) {
      return res.status(422).json({
        error: 'No geometry shapes found. Add floors and shapes before running a calculation.',
      });
    }

    const kpis = calculateKPIs(baseline, geoObjs);
    const result = { inputs, kpis };
    const now  = Date.now();

    const info = openProjectDb(id)
      .prepare('INSERT INTO calc_snapshots (computed_at, result_json) VALUES (?, ?)')
      .run(now, JSON.stringify(result));

    // Also update the project index with the latest grade/EEI so the dashboard
    // can display it without re-running the engine.
    indexDb()
      .prepare('UPDATE project_index SET grade = ?, eei = ?, updated_at = ? WHERE id = ?')
      .run(kpis.grade, kpis.eei, now, id);

    res.json({
      ok: true,
      snapshotId: info.lastInsertRowid,
      computedAt: now,
      kpis: {
        eei:   kpis.eei,
        score: kpis.score,
        grade: kpis.grade,
        esr:   kpis.esr,
        isNZCB: kpis.isNZCB,
        afe:   kpis.afe,
        euiN:  kpis.euiN,
        euiG:  kpis.euiG,
        euiM:  kpis.euiM,
        euiMax: kpis.euiMax,
        weights: kpis.weights,
        eevCalculation: kpis.eevCalculation,
        mepResults: kpis.mepResults,
        breakdown: kpis.breakdown,
      },
      baseline: {
        category: baseline.category,
        region:   baseline.region,
        totalFloorAreaAF: baseline.totalFloorAreaAF,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[calc/run]', msg);
    res.status(500).json({ error: msg });
  }
});

// ---- GET /snapshots ----
calcRouter.get('/snapshots', (req, res) => {
  const id = getId(req);
  if (!projectExists(id)) return res.status(404).json({ error: 'Project not found' });
  const rows = openProjectDb(id)
    .prepare('SELECT id, computed_at FROM calc_snapshots ORDER BY computed_at DESC LIMIT 50')
    .all() as Array<{ id: number; computed_at: number }>;
  res.json({
    snapshots: rows.map(r => ({ id: r.id, computedAt: r.computed_at })),
  });
});

calcRouter.get('/snapshots/:snapshotId', (req, res) => {
  const id = getId(req);
  if (!projectExists(id)) return res.status(404).json({ error: 'Project not found' });
  const sid = Number((req.params as any).snapshotId);
  if (!Number.isInteger(sid)) return res.status(400).json({ error: 'invalid snapshotId' });
  const row = openProjectDb(id)
    .prepare('SELECT id, computed_at, result_json FROM calc_snapshots WHERE id = ?')
    .get(sid) as { id: number; computed_at: number; result_json: string } | undefined;
  if (!row) return res.status(404).json({ error: 'Snapshot not found' });
  let result: unknown = null;
  try { result = JSON.parse(row.result_json); } catch { /* ignore */ }
  res.json({ id: row.id, computedAt: row.computed_at, result });
});
