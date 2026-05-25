/**
 * Project lifecycle: CRUD on the central project_index plus per-project SQLite files.
 */
import { Router, type Request, type Response } from 'express';
import { indexDb, openProjectDb, deleteProjectDb, projectDbPath, assertValidProjectId } from '../db.js';

export const projectsRouter = Router();

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

function toApiShape(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    organization: row.organization ?? '',
    location: row.location ?? undefined,
    status: row.status as 'draft' | 'in-progress' | 'completed',
    category: row.category ?? undefined,
    buildingType: row.building_type ?? undefined,
    totalArea: row.total_area ?? undefined,
    grade: row.grade ?? undefined,
    eei: row.eei ?? undefined,
    thumbnail: row.thumbnail ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function deriveCategory(buildingType?: string): string | null {
  switch (buildingType) {
    case 'office':   return '辦公建築';
    case 'hospital': return '醫院';
    case 'retail':   return '零售';
    case 'school':   return '學校';
    case 'hotel':    return '旅館';
    default:         return buildingType ? '其他' : null;
  }
}

// ---- LIST ----
projectsRouter.get('/', (_req: Request, res: Response) => {
  const rows = indexDb()
    .prepare('SELECT * FROM project_index ORDER BY updated_at DESC')
    .all() as ProjectRow[];
  res.json({ projects: rows.map(toApiShape) });
});

// ---- CREATE ----
projectsRouter.post('/', (req: Request, res: Response) => {
  const { name, organization, location, buildingType, totalArea } = req.body || {};
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  assertValidProjectId(id);
  const now = Date.now();
  const category = deriveCategory(buildingType);

  // 1. Create per-project sqlite (auto-runs schema)
  const pdb = openProjectDb(id);
  pdb.prepare(`
    INSERT INTO project (id, name, address, category, region, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), location ?? null, category, null, now, now);

  // 2. Add to central index
  indexDb().prepare(`
    INSERT INTO project_index
      (id, name, organization, location, status, category, building_type, total_area, grade, eei, thumbnail, file_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)
  `).run(
    id,
    name.trim(),
    organization ?? null,
    location ?? null,
    category,
    buildingType ?? null,
    totalArea ?? null,
    projectDbPath(id),
    now,
    now,
  );

  const row = indexDb().prepare('SELECT * FROM project_index WHERE id = ?').get(id) as ProjectRow;
  res.status(201).json({ project: toApiShape(row) });
});

// ---- GET ONE ----
projectsRouter.get('/:id', (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  assertValidProjectId(projectId);
  const row = indexDb()
    .prepare('SELECT * FROM project_index WHERE id = ?')
    .get(projectId) as ProjectRow | undefined;
  if (!row) return res.status(404).json({ error: 'Project not found' });
  res.json({ project: toApiShape(row) });
});

// ---- UPDATE ----
projectsRouter.patch('/:id', (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  assertValidProjectId(projectId);
  const id = projectId;
  const exists = indexDb().prepare('SELECT 1 FROM project_index WHERE id = ?').get(id);
  if (!exists) return res.status(404).json({ error: 'Project not found' });

  const allowed: Record<string, string> = {
    name: 'name',
    organization: 'organization',
    location: 'location',
    status: 'status',
    category: 'category',
    buildingType: 'building_type',
    totalArea: 'total_area',
    grade: 'grade',
    eei: 'eei',
    thumbnail: 'thumbnail',
  };
  const sets: string[] = [];
  const values: any[] = [];
  for (const [apiKey, col] of Object.entries(allowed)) {
    if (apiKey in (req.body || {})) {
      sets.push(`${col} = ?`);
      values.push(req.body[apiKey]);
    }
  }
  if (sets.length === 0) {
    const row = indexDb().prepare('SELECT * FROM project_index WHERE id = ?').get(id) as ProjectRow;
    return res.json({ project: toApiShape(row) });
  }
  sets.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  indexDb().prepare(`UPDATE project_index SET ${sets.join(', ')} WHERE id = ?`).run(...values);

  // Mirror name/category to per-project DB for self-contained portability
  if ('name' in req.body || 'category' in req.body || 'location' in req.body || 'buildingType' in req.body) {
    const pdb = openProjectDb(id);
    pdb.prepare(`
      UPDATE project SET
        name     = COALESCE(?, name),
        address  = COALESCE(?, address),
        category = COALESCE(?, category),
        updated_at = ?
      WHERE id = ?
    `).run(
      req.body.name ?? null,
      req.body.location ?? null,
      req.body.category ?? deriveCategory(req.body.buildingType) ?? null,
      Date.now(),
      id,
    );
  }

  const row = indexDb().prepare('SELECT * FROM project_index WHERE id = ?').get(id) as ProjectRow;
  res.json({ project: toApiShape(row) });
});

// ---- DELETE ----
projectsRouter.delete('/:id', (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  assertValidProjectId(projectId);
  const id = projectId;
  indexDb().prepare('DELETE FROM project_index WHERE id = ?').run(id);
  deleteProjectDb(id);
  res.status(204).end();
});
