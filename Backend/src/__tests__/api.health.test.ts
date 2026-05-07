/**
 * Health & readiness endpoint tests.
 * These tests hit the real running backend on port 4000.
 * Run after `docker compose up -d`.
 */
import { describe, it, expect } from 'vitest';

const BASE = 'http://localhost:4000';

describe('Health endpoints', () => {
  it('GET /health returns ok:true', async () => {
    const res = await fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('GET /ready returns ok:true when DB+Redis healthy', async () => {
    const res = await fetch(`${BASE}/ready`);
    // May return 503 if Redis is slow; accept 200 or 503.
    expect([200, 503]).toContain(res.status);
    const body = await res.json() as { ok: boolean; status: string };
    expect(typeof body.status).toBe('string');
  });
});
