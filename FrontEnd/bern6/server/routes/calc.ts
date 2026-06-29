/**
 * Calculation API — surfaces normalized inputs the energy engine can consume
 * without knowing anything about the 3D editor's internals.
 *
 *   GET  /geometry-summary  → per-floor area/perimeter/internal-edge breakdown
 *   GET  /envelope-summary  → wall/window/roof areas + glass/shading mix
 *   GET  /inputs            → bundled CalcInputs (★ stable contract for engines)
 *   GET  /params/:group     → raw stored params (baseline/envelope/mep/...)
 *   PUT  /params/:group     → upsert a params group (JSON blob)
 *   POST /run               → run the engine (placeholder; saves a snapshot)
 *   GET  /snapshots         → list past snapshots
 */
import { Router, type Request, type Response } from 'express';
import { indexDb, openProjectDb, assertValidProjectId } from '../db.js';
import {
  buildCalcInputs,
  computeGeometrySummary,
  computeEnvelopeSummary,
  readFloors,
} from '../services/calcInputs.js';

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
// Placeholder: echoes the inputs back as the "result" and saves to calc_snapshots.
// Will wire into services/calculationEngine.ts later (A-path: server is source of truth).
calcRouter.post('/run', (req, res) => {
  const id = getId(req);
  if (!projectExists(id)) return res.status(404).json({ error: 'Project not found' });
  const inputs = buildCalcInputs(id);

  // TODO(PR4+): import { calculateKPIs } from '../../services/calculationEngine'
  // and run it here. For now we store inputs verbatim so the table is exercised.
  const result = { inputs, kpis: null as any };
  const now = Date.now();
  const info = openProjectDb(id)
    .prepare('INSERT INTO calc_snapshots (computed_at, result_json) VALUES (?, ?)')
    .run(now, JSON.stringify(result));
  res.json({ ok: true, snapshotId: info.lastInsertRowid, computedAt: now, result });
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
