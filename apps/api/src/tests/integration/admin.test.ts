// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Admin routes (/api/v1/admin/*)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import {
  createTestDealership,
  createTestUser,
  createTestUnit,
  createTestLot,
  createTestTracker,
} from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

const ADMIN_TOKEN = 'test-admin-token';

function adminHeaders(): Record<string, string> {
  return { 'x-admin-token': ADMIN_TOKEN };
}

describe('Admin Routes', () => {
  let app: FastifyInstance;
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
    await createTestUser(app, dealershipId, 'owner');
  });

  // ── GET /api/v1/admin/dealerships ────────────────────────────────────────

  describe('GET /api/v1/admin/dealerships', () => {
    it('lists dealerships with admin token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/dealerships',
        headers: adminHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBeGreaterThanOrEqual(1);

      // Verify enriched data includes unitCount
      const first = data[0] as Record<string, unknown>;
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('subscriptionTier');
      expect(first).toHaveProperty('unitCount');
    });

    it('returns 403 without admin token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/dealerships',
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 403 with wrong admin token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/dealerships',
        headers: { 'x-admin-token': 'wrong-token' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('supports pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/dealerships?limit=1',
        headers: adminHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
    });
  });

  // ── GET /api/v1/admin/dealerships/:id ────────────────────────────────────

  describe('GET /api/v1/admin/dealerships/:id', () => {
    it('returns dealership detail with counts', async () => {
      // Add some entities for the dealership
      await createTestUnit(app, dealershipId);
      await createTestUnit(app, dealershipId);
      await createTestLot(app, dealershipId);
      await createTestTracker(app, dealershipId);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/dealerships/${dealershipId}`,
        headers: adminHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(dealershipId);
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('counts');

      const counts = data['counts'] as Record<string, unknown>;
      expect(counts['units']).toBe(2);
      expect(counts['lots']).toBe(1);
      expect(counts['trackers']).toBe(1);
      expect(counts['users']).toBe(1); // The owner we created
    });

    it('returns 404 for non-existent dealership', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/dealerships/00000000-0000-0000-0000-000000000000',
        headers: adminHeaders(),
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 403 without admin token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/dealerships/${dealershipId}`,
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ── GET /api/v1/admin/system/health ──────────────────────────────────────

  describe('GET /api/v1/admin/system/health', () => {
    it('returns system health check with database and redis status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/system/health',
        headers: adminHeaders(),
      });

      // Could be 200 or 503 depending on Redis state in test env
      expect([200, 503]).toContain(response.statusCode);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('services');

      const services = body['services'] as Record<string, unknown>;
      expect(services).toHaveProperty('database');
      expect(services).toHaveProperty('redis');

      const db = services['database'] as Record<string, unknown>;
      expect(db['status']).toBe('healthy');
      expect(db).toHaveProperty('latency_ms');
    });

    it('returns 403 without admin token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/system/health',
      });

      expect(response.statusCode).toBe(403);
    });
  });

  // ── GET /api/v1/admin/system/stats ───────────────────────────────────────

  describe('GET /api/v1/admin/system/stats', () => {
    it('returns global system statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/system/stats',
        headers: adminHeaders(),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data).toHaveProperty('dealerships');
      expect(data).toHaveProperty('units');
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('trackers');
      expect(data).toHaveProperty('gateways');
      expect(data).toHaveProperty('timestamp');
    });
  });
});
