// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Widget routes (/api/v1/widget)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Widget Routes', () => {
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

  // ── GET /api/v1/widget ────────────────────────────────────────────────────

  describe('GET /api/v1/widget', () => {
    it('returns widget config', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/widget',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/widget',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── PATCH /api/v1/widget ──────────────────────────────────────────────────

  describe('PATCH /api/v1/widget', () => {
    it('updates widget config', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/widget',
        headers: authHeader(token),
        payload: {
          enabled: true,
          theme: 'dark',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['enabled']).toBe(true);
      expect(data['theme']).toBe('dark');
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/widget',
        payload: { enabled: false },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
