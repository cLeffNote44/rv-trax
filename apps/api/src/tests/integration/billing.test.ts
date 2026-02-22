// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Billing routes (/api/v1/billing/*)
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

describe('Billing Routes', () => {
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
    const d = await createTestDealership(app);
    dealershipId = d.id;
    const u = await createTestUser(app, dealershipId, 'owner');
    token = generateToken(app, { id: u.id, dealershipId, role: 'owner' });
  });

  // ── GET /api/v1/billing ──────────────────────────────────────────────────

  describe('GET /api/v1/billing', () => {
    it('returns billing overview with tier info and counts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['dealershipId']).toBe(dealershipId);
      expect(data).toHaveProperty('subscriptionTier');
      expect(data).toHaveProperty('subscriptionStatus');
      expect(data).toHaveProperty('unitCount');
      expect(data).toHaveProperty('unitLimit');
      expect(data).toHaveProperty('lotCount');
      expect(data).toHaveProperty('lotLimit');
      expect(data).toHaveProperty('isOverLimit');
    });

    it('returns correct unit and lot counts', async () => {
      await createTestUnit(app, dealershipId);
      await createTestUnit(app, dealershipId);
      await createTestLot(app, dealershipId);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['unitCount']).toBe(2);
      expect(data['lotCount']).toBe(1);
    });

    it('reports isOverLimit=false for starter tier within limits', async () => {
      // Starter allows 100 units, 1 lot
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['isOverLimit']).toBe(false);
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── Starter tier lot limit enforcement ───────────────────────────────────

  describe('Starter tier limits', () => {
    it('shows correct limits for starter tier', async () => {
      // The factory creates dealership with tier='professional' by default
      // Create a separate starter dealership
      const starterDealership = await createTestDealership(app, { tier: 'starter' });
      const starterUser = await createTestUser(app, starterDealership.id, 'owner');
      const starterToken = generateToken(app, {
        id: starterUser.id,
        dealershipId: starterDealership.id,
        role: 'owner',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing',
        headers: authHeader(starterToken),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['unitLimit']).toBe(100);
      expect(data['lotLimit']).toBe(1);
    });

    it('shows correct limits for professional tier', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/billing',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      // Factory defaults to 'professional' tier: 300 units, 3 lots
      expect(data['unitLimit']).toBe(300);
      expect(data['lotLimit']).toBe(3);
    });
  });
});
