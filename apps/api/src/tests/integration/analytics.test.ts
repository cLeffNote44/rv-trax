// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Analytics routes (/api/v1/analytics/*)
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

describe('Analytics Routes', () => {
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

    // Create some test units so analytics have data
    await createTestUnit(app, dealershipId, { make: 'Jayco', unitType: 'travel_trailer', status: 'available' });
    await createTestUnit(app, dealershipId, { make: 'Jayco', unitType: 'fifth_wheel', status: 'available' });
    await createTestUnit(app, dealershipId, { make: 'Winnebago', unitType: 'motorhome', status: 'sold' });

    // Create a lot so lot-utilization has data
    await createTestLot(app, dealershipId, { totalSpots: 100 });
  });

  // ── GET /api/v1/analytics/inventory ──────────────────────────────────────

  describe('GET /api/v1/analytics/inventory', () => {
    it('returns inventory analytics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/inventory',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      const data = body['data'] as Record<string, unknown>;
      expect(data).toHaveProperty('total_units');
      expect(data).toHaveProperty('average_age_days');
      expect(data).toHaveProperty('by_type');
      expect(data).toHaveProperty('by_status');
      expect(data).toHaveProperty('aging_buckets');
    });

    it('returns non-zero total_units when units exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/inventory',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['total_units']).toBeGreaterThanOrEqual(2);
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/inventory',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/analytics/lot-utilization ────────────────────────────────

  describe('GET /api/v1/analytics/lot-utilization', () => {
    it('returns lot utilization data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/lot-utilization',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/lot-utilization',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/analytics/movements ──────────────────────────────────────

  describe('GET /api/v1/analytics/movements', () => {
    it('returns movement analytics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/movements',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      const data = body['data'] as Record<string, unknown>;
      expect(data).toHaveProperty('most_moved_units');
      expect(data).toHaveProperty('idle_units');
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/movements',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/analytics/dashboard ──────────────────────────────────────

  describe('GET /api/v1/analytics/dashboard', () => {
    it('returns combined dashboard KPIs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/dashboard',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      const data = body['data'] as Record<string, unknown>;
      expect(data).toHaveProperty('total_units');
      expect(data).toHaveProperty('average_age_days');
      expect(data).toHaveProperty('stock_turn_rate');
      expect(data).toHaveProperty('lot_utilization_pct');
      expect(data).toHaveProperty('compliance_score_pct');
      expect(data).toHaveProperty('moves_today');
      expect(data).toHaveProperty('idle_unit_count');
      expect(data).toHaveProperty('aging_over_90');
    });

    it('returns non-zero total_units when units exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/dashboard',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['total_units']).toBeGreaterThanOrEqual(2);
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/dashboard',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/analytics/staging ────────────────────────────────────────

  describe('GET /api/v1/analytics/staging', () => {
    it('returns staging effectiveness data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/staging',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/staging',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
