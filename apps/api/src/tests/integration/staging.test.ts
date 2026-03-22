// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Staging plan routes (/api/v1/staging-plans/*)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser, createTestLot } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Staging Plan Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let dealershipId: string;
  let lotId: string;

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
    const l = await createTestLot(app, dealershipId);
    lotId = l.id;
  });

  // ── POST /api/v1/staging-plans ───────────────────────────────────────────

  describe('POST /api/v1/staging-plans', () => {
    it('creates a staging plan successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: {
          name: 'Summer Layout',
          lot_id: lotId,
          rules: [],
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Summer Layout');
      expect(data['lot_id']).toBe(lotId);
      expect(data['dealership_id']).toBe(dealershipId);
      expect(data['is_active']).toBe(false);
      expect(data['is_template']).toBe(false);
    });

    it('creates a staging plan with is_template=true', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: {
          name: 'Template Plan',
          lot_id: lotId,
          rules: [],
          is_template: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['is_template']).toBe(true);
    });

    it('rejects creation with non-existent lot', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: {
          name: 'Bad Plan',
          lot_id: '00000000-0000-0000-0000-000000000000',
          rules: [],
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('rejects creation without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        payload: {
          name: 'No Auth Plan',
          lot_id: lotId,
          rules: [],
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/staging-plans ────────────────────────────────────────────

  describe('GET /api/v1/staging-plans', () => {
    it('lists staging plans for the dealership', async () => {
      // Create two plans
      await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Plan A', lot_id: lotId, rules: [] },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Plan B', lot_id: lotId, rules: [] },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data).toHaveLength(2);
    });

    it('filters plans by lot_id', async () => {
      const otherLot = await createTestLot(app, dealershipId, { name: 'Other Lot' });

      await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Plan A', lot_id: lotId, rules: [] },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Plan B', lot_id: otherLot.id, rules: [] },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/staging-plans?lot_id=${lotId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data).toHaveLength(1);
    });
  });

  // ── GET /api/v1/staging-plans/:id ────────────────────────────────────────

  describe('GET /api/v1/staging-plans/:id', () => {
    it('returns plan detail with stats', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Detail Plan', lot_id: lotId, rules: [] },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const planId = created['id'] as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/staging-plans/${planId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(planId);
      expect(data['name']).toBe('Detail Plan');
      expect(data).toHaveProperty('stats');
      const stats = data['stats'] as Record<string, unknown>;
      expect(stats['total']).toBe(0);
    });

    it('returns 404 for non-existent plan', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/staging-plans/00000000-0000-0000-0000-000000000000',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── PATCH /api/v1/staging-plans/:id ──────────────────────────────────────

  describe('PATCH /api/v1/staging-plans/:id', () => {
    it('updates the plan name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Original', lot_id: lotId, rules: [] },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const planId = created['id'] as string;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/staging-plans/${planId}`,
        headers: authHeader(token),
        payload: { name: 'Renamed Plan' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Renamed Plan');
    });

    it('returns 404 for non-existent plan', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/staging-plans/00000000-0000-0000-0000-000000000000',
        headers: authHeader(token),
        payload: { name: 'Ghost' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/staging-plans/:id/activate ──────────────────────────────

  describe('POST /api/v1/staging-plans/:id/activate', () => {
    it('activates a staging plan', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'To Activate', lot_id: lotId, rules: [] },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const planId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/staging-plans/${planId}/activate`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['is_active']).toBe(true);
    });

    it('rejects activation of already-active plan', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Active Plan', lot_id: lotId, rules: [] },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const planId = created['id'] as string;

      // Activate first
      await app.inject({
        method: 'POST',
        url: `/api/v1/staging-plans/${planId}/activate`,
        headers: authHeader(token),
      });

      // Try to activate again
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/staging-plans/${planId}/activate`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ── POST /api/v1/staging-plans/:id/deactivate ────────────────────────────

  describe('POST /api/v1/staging-plans/:id/deactivate', () => {
    it('deactivates an active plan', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'To Deactivate', lot_id: lotId, rules: [] },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const planId = created['id'] as string;

      // Activate first
      await app.inject({
        method: 'POST',
        url: `/api/v1/staging-plans/${planId}/activate`,
        headers: authHeader(token),
      });

      // Deactivate
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/staging-plans/${planId}/deactivate`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['is_active']).toBe(false);
    });

    it('rejects deactivation of already-inactive plan', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Inactive Plan', lot_id: lotId, rules: [] },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const planId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/staging-plans/${planId}/deactivate`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ── POST /api/v1/staging-plans/:id/clone ─────────────────────────────────

  describe('POST /api/v1/staging-plans/:id/clone', () => {
    it('clones a staging plan with default name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Original Plan', lot_id: lotId, rules: [] },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const planId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/staging-plans/${planId}/clone`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Original Plan (Copy)');
      expect(data['is_active']).toBe(false);
      expect(data['id']).not.toBe(planId);
    });

    it('clones a staging plan with custom name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Source Plan', lot_id: lotId, rules: [] },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const planId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/staging-plans/${planId}/clone`,
        headers: authHeader(token),
        payload: { name: 'My Clone' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('My Clone');
    });
  });

  // ── GET /api/v1/staging-plans/:id/compliance ─────────────────────────────

  describe('GET /api/v1/staging-plans/:id/compliance', () => {
    it('returns compliance score for a plan with a lot', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/staging-plans',
        headers: authHeader(token),
        payload: { name: 'Compliance Plan', lot_id: lotId, rules: [] },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const planId = created['id'] as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/staging-plans/${planId}/compliance`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });

    it('returns 404 for non-existent plan', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/staging-plans/00000000-0000-0000-0000-000000000000/compliance',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
