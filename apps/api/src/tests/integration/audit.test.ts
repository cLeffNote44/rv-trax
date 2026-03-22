// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Audit Log routes (/api/v1/audit-log)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Audit Log Routes', () => {
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

  // ── GET /api/v1/audit-log ─────────────────────────────────────────────────

  describe('GET /api/v1/audit-log', () => {
    it('lists audit entries and returns 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-log',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });

    it('rejects without auth with 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-log',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
