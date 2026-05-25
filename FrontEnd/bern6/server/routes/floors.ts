/**
 * 3D modeling persistence — floors + shapes for a single project.
 *
 * Storage layout (per-project DB):
 *   floors(id, name, floor_height, order_index, updated_at)
 *   shapes(id, floor_id FK, type, position_x, position_y, rotation, params_json, order_index, updated_at)
 *
 * Wire shape (matches App.tsx Floor[]):
 *   { id, name, floorHeight, shapes: [{ id, type, params, position:{x,y}, rotation }] }
 *
 * PUT semantics: full replace inside a single transaction (DELETE-then-INSERT).
 *   The client debounces (500ms) so we don't bother with diffing yet.
 */
import { Router, type Request, type Response } from 'express';
import { openProjectDb, indexDb, assertValidProjectId } from '../db.js';

export const floorsRouter = Router({ mergeParams: true });

interface FloorRow {
  id: string;
  name: string;
  floor_height: number;
  order_index: number;
}
interface ShapeRow {
  id: string;
  floor_id: string;
  type: string;
  position_x: number;
  position_y: number;
  rotation: number;
  params_json: string;
  order_index: number;
}

interface ShapeWire {
  id: string;
  type: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
  rotation: number;
}
interface FloorWire {
  id: string;
  name: string;
  floorHeight: number;
  shapes: ShapeWire[];
}

function projectExists(id: string): boolean {
  return !!indexDb().prepare('SELECT 1 FROM project_index WHERE id = ?').get(id);
}

// ---- GET ----
floorsRouter.get('/', (req: Request, res: Response) => {
  const projectId = String((req.params as any).id);
  assertValidProjectId(projectId);
  if (!projectExists(projectId)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const db = openProjectDb(projectId);
  const floorRows = db
    .prepare('SELECT id, name, floor_height, order_index FROM floors ORDER BY order_index ASC')
    .all() as FloorRow[];
  const shapeRows = db
    .prepare('SELECT id, floor_id, type, position_x, position_y, rotation, params_json, order_index FROM shapes ORDER BY order_index ASC')
    .all() as ShapeRow[];

  const shapesByFloor = new Map<string, ShapeWire[]>();
  for (const s of shapeRows) {
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(s.params_json); } catch { /* ignore corrupt row */ }
    const list = shapesByFloor.get(s.floor_id) ?? [];
    list.push({
      id: s.id,
      type: s.type,
      params: parsed,
      position: { x: s.position_x, y: s.position_y },
      rotation: s.rotation,
    });
    shapesByFloor.set(s.floor_id, list);
  }

  const floors: FloorWire[] = floorRows.map(f => ({
    id: f.id,
    name: f.name,
    floorHeight: f.floor_height,
    shapes: shapesByFloor.get(f.id) ?? [],
  }));

  res.json({ floors });
});

// ---- PUT (full replace) ----
floorsRouter.put('/', (req: Request, res: Response) => {
  const projectId = String((req.params as any).id);
  assertValidProjectId(projectId);
  if (!projectExists(projectId)) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const body = req.body as { floors?: FloorWire[] } | undefined;
  if (!body || !Array.isArray(body.floors)) {
    return res.status(400).json({ error: 'floors[] is required' });
  }
  const floors = body.floors;

  // Lightweight validation
  for (const f of floors) {
    if (typeof f?.id !== 'string' || typeof f?.name !== 'string' || typeof f?.floorHeight !== 'number') {
      return res.status(400).json({ error: 'invalid floor row' });
    }
    if (!Array.isArray(f.shapes)) {
      return res.status(400).json({ error: `floor ${f.id} missing shapes[]` });
    }
  }

  const db = openProjectDb(projectId);
  const now = Date.now();

  const tx = db.transaction((floors: FloorWire[]) => {
    db.prepare('DELETE FROM shapes').run();
    db.prepare('DELETE FROM floors').run();

    const insertFloor = db.prepare(`
      INSERT INTO floors (id, name, floor_height, order_index, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertShape = db.prepare(`
      INSERT INTO shapes (id, floor_id, type, position_x, position_y, rotation, params_json, order_index, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    floors.forEach((f, fi) => {
      insertFloor.run(f.id, f.name, f.floorHeight, fi, now);
      f.shapes.forEach((s, si) => {
        insertShape.run(
          s.id,
          f.id,
          s.type,
          Number(s.position?.x ?? 0),
          Number(s.position?.y ?? 0),
          Number(s.rotation ?? 0),
          JSON.stringify(s.params ?? {}),
          si,
          now,
        );
      });
    });
  });

  try {
    tx(floors);
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'write failed' });
  }

  // Bump index updated_at so dashboards reflect "last edited"
  indexDb()
    .prepare('UPDATE project_index SET updated_at = ? WHERE id = ?')
    .run(now, projectId);

  res.json({
    ok: true,
    floorCount: floors.length,
    shapeCount: floors.reduce((n, f) => n + f.shapes.length, 0),
    updatedAt: now,
  });
});
