// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Group routes (/api/v1/groups)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Group Routes', () => {
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

  // ── POST /api/v1/groups ───────────────────────────────────────────────────

  describe('POST /api/v1/groups', () => {
    it('creates a group and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/groups',
        headers: authHeader(token),
        payload: { name: 'Sunshine Auto Group' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Sunshine Auto Group');
    });
  });

  // ── GET /api/v1/groups ────────────────────────────────────────────────────

  describe('GET /api/v1/groups', () => {
    it('lists groups and returns 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/groups',
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
        url: '/api/v1/groups',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
