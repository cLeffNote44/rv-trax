// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Transfer routes (/api/v1/transfers)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Transfer Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let dealershipId: string;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase(app);
    const dealership = await createTestDealership(app);
    dealershipId = dealership.id;
    const user = await createTestUser(app, dealershipId, 'owner');
    token = generateToken(app, { id: user.id, dealershipId, role: user.role });
  });

  // ── POST /api/v1/transfers ────────────────────────────────────────────────

  describe('POST /api/v1/transfers', () => {
    it('returns 422 or 400 for invalid FK references', async () => {
      const fakeUnitId = '00000000-0000-0000-0000-000000000001';
      const fakeDealershipId = '00000000-0000-0000-0000-000000000002';

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/transfers',
        headers: authHeader(token),
        payload: {
          unit_id: fakeUnitId,
          to_dealership_id: fakeDealershipId,
          notes: 'Test transfer',
        },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
    });
  });

  // ── GET /api/v1/transfers ─────────────────────────────────────────────────

  describe('GET /api/v1/transfers', () => {
    it('lists transfers and returns 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transfers',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('rejects without auth with 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/transfers',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
