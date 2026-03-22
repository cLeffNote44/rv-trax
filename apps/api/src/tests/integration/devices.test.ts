// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Device routes (/api/v1/devices)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

const validToken = {
  token: 'fcm-token-abc123xyz',
  platform: 'android',
};

describe('Device Routes', () => {
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

  // ── POST /api/v1/devices/register ─────────────────────────────────────────

  describe('POST /api/v1/devices/register', () => {
    it('registers a device token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/devices/register',
        headers: authHeader(token),
        payload: validToken,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data).toHaveProperty('id');
      expect(data['platform']).toBe('android');
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/devices/register',
        payload: validToken,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── DELETE /api/v1/devices/unregister ──────────────────────────────────────

  describe('DELETE /api/v1/devices/unregister', () => {
    it('deactivates a device token', async () => {
      // Register first
      await app.inject({
        method: 'POST',
        url: '/api/v1/devices/register',
        headers: authHeader(token),
        payload: validToken,
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/devices/unregister',
        headers: authHeader(token),
        payload: { token: validToken.token },
      });

      expect(response.statusCode).toBe(204);
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/devices/unregister',
        payload: { token: validToken.token },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
