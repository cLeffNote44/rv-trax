// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: White-label routes (/api/v1/white-label)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('White-Label Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let dealershipId: string;
  let groupId: string;

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
    groupId = dealership.groupId;
    const user = await createTestUser(app, dealershipId, 'owner');
    token = generateToken(app, { id: user.id, dealershipId, role: user.role });
  });

  // ── GET /api/v1/white-label/branding ──────────────────────────────────────

  describe('GET /api/v1/white-label/branding', () => {
    it('requires group membership to access branding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/white-label/branding',
        headers: authHeader(token),
      });

      // User belongs to the group via their dealership, so this should succeed
      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });

    it('rejects user from a different group', async () => {
      const otherDealership = await createTestDealership(app);
      const otherUser = await createTestUser(app, otherDealership.id, 'owner');
      const otherToken = generateToken(app, {
        id: otherUser.id,
        dealershipId: otherDealership.id,
        role: otherUser.role,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/white-label/branding?groupId=${groupId}`,
        headers: authHeader(otherToken),
      });

      // Other user does not belong to this group
      expect(response.statusCode).toBeGreaterThanOrEqual(403);
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/white-label/branding',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
