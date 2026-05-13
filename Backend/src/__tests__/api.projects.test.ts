/**
 * Projects API integration tests.
 * Requires backend running on localhost:4000.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:4000';
const ORIGIN = 'http://localhost:3002';
const HEADERS = { 'Content-Type': 'application/json', 'Origin': ORIGIN };
const TEST_USER = { username: 'admin', password: 'Taoyuan@2026Platform!' };

let cookie = '';
let createdProjectId = '';

async function loginCookie(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ...TEST_USER, remember_me: false }),
  });
  const raw = res.headers.getSetCookie?.() ?? [];
  const setCookieHeader = Array.isArray(raw) ? raw : [raw];
  const access = setCookieHeader.find((c: string) => c.startsWith('bersn_access_token=')) ?? '';
  return access.split(';')[0];
}

beforeAll(async () => {
  cookie = await loginCookie();
});

describe('GET /api/building-types', () => {
  it('returns building types list', async () => {
    const res = await fetch(`${BASE}/api/building-types`, {
      headers: { ...HEADERS, cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; building_types: unknown[] };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.building_types)).toBe(true);
    expect(body.building_types.length).toBeGreaterThan(0);
  });
});

describe('GET /api/lookup/config', () => {
  it('returns full config lookup', async () => {
    const res = await fetch(`${BASE}/api/lookup/config`, {
      headers: { ...HEADERS, cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe('POST /api/projects', () => {
  it('creates a project', async () => {
    const res = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { ...HEADERS, cookie },
      body: JSON.stringify({
        project_name: 'Test Building Integration',
        organization_id: null,
        location: 'Taoyuan District',
        building_type_code: 'G2_OFFICE',   // OFFICE is now inactive (legacy); use BERSn code
        total_floor_area: 2500,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; project: { id: string; status: string } };
    expect(body.ok).toBe(true);
    expect(body.project.status).toBe('DRAFT');
    createdProjectId = body.project.id;
  });

  it('rejects invalid building type', async () => {
    const res = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { ...HEADERS, cookie },
      body: JSON.stringify({
        project_name: 'Bad Project',
        building_type_code: 'NONEXISTENT_TYPE',
        total_floor_area: 500,
      }),
    });
    // Backend returns 400 for an unrecognised building type code
    expect([400, 404]).toContain(res.status);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns project with floors field', async () => {
    const res = await fetch(`${BASE}/api/projects/${createdProjectId}`, {
      headers: { ...HEADERS, cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; project: Record<string, unknown> };
    expect(body.ok).toBe(true);
    // floors column added in migration 011
    expect('floors' in body.project).toBe(true);
  });
});

describe('PATCH /api/projects/:id/workspace-settings', () => {
  it('saves floors array to database', async () => {
    const floors = [{
      id: 'floor-test-1',
      name: 'F1',
      floorHeight: 4.0,
      shapes: [{
        id: 'shape-1', type: 'box',
        params: { width: 20, length: 30, height: 4, azimuth: 0, wwr: 0.4 },
        position: { x: 0, y: 0 }, rotation: 0,
      }],
    }];
    const res = await fetch(`${BASE}/api/projects/${createdProjectId}/workspace-settings`, {
      method: 'PATCH',
      headers: { ...HEADERS, cookie },
      body: JSON.stringify({
        floors,
        geometry_objects: [],
        exempt_areas: [],
        elevator_count: 2,
        selected_region: 'REGION_A',
        selected_use_category: 'USE_OFFICE',
        selected_wall: 'CONS_WALL_RC_INS',
        selected_roof: 'CONS_ROOF_RC_INS',
        selected_shading: 'SH_OVERHANG',
        selected_glazing: 'GLZ_DBL_LOW_E',
        selected_hvac: 'HVAC_VRF',
        selected_lighting: 'LGT_LED',
        selected_elevator: 'ET_VVVF',
        selected_dhw: 'DHW_NONE',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; project: { floors: unknown[] } };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.project.floors)).toBe(true);
    expect((body.project.floors as unknown[]).length).toBe(1);
  });
});

describe('POST /api/projects/:id/calculations', () => {
  it('creates a calculation with BERS grade', async () => {
    const res = await fetch(`${BASE}/api/projects/${createdProjectId}/calculations`, {
      method: 'POST',
      headers: { ...HEADERS, cookie },
      body: JSON.stringify({
        eui_result: 180,
        green_building_grade: '3',
        notes: 'Integration test calculation',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { ok: boolean; calculation: { grade: string } };
    expect(body.ok).toBe(true);
    expect(body.calculation.grade).toBe('3');
  });

  it('rejects invalid BERS grade', async () => {
    const res = await fetch(`${BASE}/api/projects/${createdProjectId}/calculations`, {
      method: 'POST',
      headers: { ...HEADERS, cookie },
      body: JSON.stringify({ green_building_grade: 'GOLD' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects/:id/calculations', () => {
  it('lists calculation history', async () => {
    const res = await fetch(`${BASE}/api/projects/${createdProjectId}/calculations`, {
      headers: { ...HEADERS, cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; calculations: unknown[] };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.calculations)).toBe(true);
    expect(body.calculations.length).toBeGreaterThan(0);
  });
});

describe('GET /api/projects/:id/audit-log', () => {
  it('returns audit trail', async () => {
    const res = await fetch(`${BASE}/api/projects/${createdProjectId}/audit-log`, {
      headers: { ...HEADERS, cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; logs: Array<{ action: string }> };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.logs)).toBe(true);
    // Project was created and workspace was saved
    const actions = body.logs.map(l => l.action);
    expect(actions).toContain('CREATED');
  });
});

describe('GET /api/dashboard/stats', () => {
  it('returns stats with expected shape', async () => {
    const res = await fetch(`${BASE}/api/dashboard/stats`, {
      headers: { ...HEADERS, cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      ok: boolean;
      stats: {
        totalProjects: number;
        byStatus: Record<string, number>;
        byGrade: Record<string, number>;
        totalFloorAreaM2: number;
        recentActivity: unknown[];
      };
    };
    expect(body.ok).toBe(true);
    expect(typeof body.stats.totalProjects).toBe('number');
    expect(typeof body.stats.byStatus).toBe('object');
    expect(typeof body.stats.totalFloorAreaM2).toBe('number');
    expect(Array.isArray(body.stats.recentActivity)).toBe(true);
  });
});

describe('PATCH /api/projects/:id/status', () => {
  it('transitions project to UNDER_REVIEW', async () => {
    const res = await fetch(`${BASE}/api/projects/${createdProjectId}/status`, {
      method: 'PATCH',
      headers: { ...HEADERS, cookie },
      body: JSON.stringify({ status: 'UNDER_REVIEW' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; project: { status: string } };
    expect(body.ok).toBe(true);
    expect(body.project.status).toBe('UNDER_REVIEW');
  });
});

describe('DELETE /api/projects/:id', () => {
  it('soft-deletes the test project', async () => {
    const res = await fetch(`${BASE}/api/projects/${createdProjectId}`, {
      method: 'DELETE',
      headers: { ...HEADERS, cookie },
    });
    expect(res.status).toBe(200);
  });

  it('project no longer accessible after deletion', async () => {
    const res = await fetch(`${BASE}/api/projects/${createdProjectId}`, {
      headers: { ...HEADERS, cookie },
    });
    expect(res.status).toBe(404);
  });
});
