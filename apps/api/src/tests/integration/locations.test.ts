// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Location routes
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import {
  createTestDealership,
  createTestUser,
  createTestUnit,
  createTestLot,
} from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Location Routes', () => {
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

  // ── GET /api/v1/units/:id/location-history ────────────────────────────────

  describe('GET /api/v1/units/:id/location-history', () => {
    it('returns 200 for a valid unit', async () => {
      const unit = await createTestUnit(app, dealershipId);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/units/${unit.id}/location-history`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });

    it('returns 404 for an unknown unit', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/units/${fakeId}/location-history`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── GET /api/v1/lots/:id/live-positions ───────────────────────────────────

  describe('GET /api/v1/lots/:id/live-positions', () => {
    it('returns 200 for a valid lot', async () => {
      const lot = await createTestLot(app, dealershipId);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/lots/${lot.id}/live-positions`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });
  });
});
