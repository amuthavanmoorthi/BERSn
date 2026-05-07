/**
 * SQLite connection management.
 *
 * - One .sqlite file per project, under DATA_DIR (default: data/projects/).
 * - One central _index.sqlite tracks all projects (id, name, file_path, ...)
 *   so we don't have to open every per-project file just to list them.
 * - Connections are cached. Migrations are auto-applied on first open.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data', 'projects');
export const INDEX_DB_PATH = path.join(DATA_DIR, '_index.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

const projectCache = new Map<string, Database.Database>();
let indexDbInstance: Database.Database | null = null;

function applyPragmas(db: Database.Database) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
}

// ---------- Index DB ----------
const INDEX_SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS project_index (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  organization  TEXT,
  location      TEXT,
  status        TEXT NOT NULL DEFAULT 'draft',
  category      TEXT,
  building_type TEXT,
  total_area    REAL,
  grade         TEXT,
  eei           REAL,
  thumbnail     TEXT,
  file_path     TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
INSERT OR IGNORE INTO schema_version (version) VALUES (1);
`;

export function indexDb(): Database.Database {
  if (indexDbInstance) return indexDbInstance;
  const db = new Database(INDEX_DB_PATH);
  applyPragmas(db);
  db.exec(INDEX_SCHEMA);
  indexDbInstance = db;
  return db;
}

// ---------- Per-project DB ----------
const PROJECT_SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY);

CREATE TABLE IF NOT EXISTS project (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  address     TEXT,
  category    TEXT,
  region      TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_params (
  group_key   TEXT PRIMARY KEY,
  value_json  TEXT NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS floors (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  floor_height REAL NOT NULL,
  order_index  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shapes (
  id           TEXT PRIMARY KEY,
  floor_id     TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  position_x   REAL NOT NULL,
  position_y   REAL NOT NULL,
  rotation     REAL NOT NULL,
  params_json  TEXT NOT NULL,
  order_index  INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shapes_floor ON shapes(floor_id);

CREATE TABLE IF NOT EXISTS calc_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  computed_at  INTEGER NOT NULL,
  result_json  TEXT NOT NULL
);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
`;

export function projectDbPath(projectId: string): string {
  // projectId is sanitized at the route layer; here we trust it.
  return path.join(DATA_DIR, `${projectId}.sqlite`);
}

export function openProjectDb(projectId: string): Database.Database {
  const cached = projectCache.get(projectId);
  if (cached) return cached;
  const dbPath = projectDbPath(projectId);
  const db = new Database(dbPath);
  applyPragmas(db);
  db.exec(PROJECT_SCHEMA);
  projectCache.set(projectId, db);
  return db;
}

export function closeProjectDb(projectId: string) {
  const db = projectCache.get(projectId);
  if (db) {
    db.close();
    projectCache.delete(projectId);
  }
}

export function deleteProjectDb(projectId: string) {
  closeProjectDb(projectId);
  const p = projectDbPath(projectId);
  for (const ext of ['', '-wal', '-shm', '-journal']) {
    try { fs.unlinkSync(p + ext); } catch { /* ignore */ }
  }
}

// ---------- Validation ----------
const ID_RE = /^[A-Za-z0-9_-]+$/;
export function assertValidProjectId(id: string) {
  if (!id || !ID_RE.test(id) || id.startsWith('_') || id.length > 64) {
    throw Object.assign(new Error('Invalid projectId'), { status: 400 });
  }
}
