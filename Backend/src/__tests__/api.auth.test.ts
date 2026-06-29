/**
 * Auth API integration tests.
 * Requires backend running on localhost:4000.
 */
import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:4000';
const ORIGIN = 'http://localhost:3002';

const headers = {
  'Content-Type': 'application/json',
  'Origin': ORIGIN,
};

// Credentials match the RBAC seed (npm run db:seed-rbac).
const TEST_USER = { username: 'amuthavanmmoorthi@gmail.com', password: 'Password123!' };

let accessCookie = '';
let refreshCookie = '';

function extractCookies(res: Response): { access: string; refresh: string } {
  const raw = res.headers.getSetCookie?.() ?? [];
  const setCookieHeader = Array.isArray(raw) ? raw : [raw];
  const access = setCookieHeader.find((c: string) => c.startsWith('bersn_access_token=')) ?? '';
  const refresh = setCookieHeader.find((c: string) => c.startsWith('bersn_refresh_token=')) ?? '';
  return { access, refresh };
}

describe('POST /api/auth/login', () => {
  it('rejects bad credentials', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ username: TEST_USER.username, password: 'wrong', remember_me: false }),
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(false);
  });

  it('accepts valid credentials and sets cookies', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...TEST_USER, remember_me: false }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; user: { username: string; role: string } };
    expect(body.ok).toBe(true);
    expect(body.user.username).toBe(TEST_USER.username);
    expect(body.user.role).toBe('SYS_ADMIN');

    const cookies = extractCookies(res);
    expect(cookies.access).toBeTruthy();
    accessCookie = cookies.access.split(';')[0];
    refreshCookie = cookies.refresh.split(';')[0];
  });
});

describe('GET /api/auth/me', () => {
  beforeAll(async () => {
    if (!accessCookie) {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...TEST_USER, remember_me: false }),
      });
      const cookies = extractCookies(res);
      accessCookie = cookies.access.split(';')[0];
      refreshCookie = cookies.refresh.split(';')[0];
    }
  });

  it('returns 401 without cookie', async () => {
    const res = await fetch(`${BASE}/api/auth/me`, { headers });
    expect(res.status).toBe(401);
  });

  it('returns user info with valid cookie', async () => {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { ...headers, cookie: accessCookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; user: { username: string; organization: string | null; organization_id: string | null } };
    expect(body.ok).toBe(true);
    expect(body.user.username).toBe(TEST_USER.username);
    // organization fields added in fix #8
    expect('organization' in body.user).toBe(true);
    expect('organization_id' in body.user).toBe(true);
  });
});
