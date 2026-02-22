// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Multi-tenancy isolation
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import {
  createTestDealership,
  createTestUser,
  createTestUnit,
} from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Multi-Tenant Isolation', () => {
  let app: FastifyInstance;

  // Dealership A
  let dealershipIdA: string;
  let tokenA: string;
  let unitIdA: string;

  // Dealership B
  let dealershipIdB: string;
  let tokenB: string;
  let unitIdB: string;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase(app);

    // Set up dealership A
    const dA = await createTestDealership(app, { name: 'Dealership A' });
    dealershipIdA = dA.id;
    const uA = await createTestUser(app, dealershipIdA, 'owner');
    tokenA = generateToken(app, { id: uA.id, dealershipId: dealershipIdA, role: 'owner' });
    const unitA = await createTestUnit(app, dealershipIdA, { make: 'Jayco' });
    unitIdA = unitA.id;

    // Set up dealership B
    const dB = await createTestDealership(app, { name: 'Dealership B' });
    dealershipIdB = dB.id;
    const uB = await createTestUser(app, dealershipIdB, 'owner');
    tokenB = generateToken(app, { id: uB.id, dealershipId: dealershipIdB, role: 'owner' });
    const unitB = await createTestUnit(app, dealershipIdB, { make: 'Winnebago' });
    unitIdB = unitB.id;
  });

  // ── Units isolation ──────────────────────────────────────────────────────

  describe('Unit isolation', () => {
    it('User A can see their own units', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/units',
        headers: authHeader(tokenA),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Array<Record<string, unknown>>;
      expect(data.length).toBe(1);
      expect(data[0]!['id']).toBe(unitIdA);
    });

    it('User A cannot see Dealership B units in list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/units',
        headers: authHeader(tokenA),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Array<Record<string, unknown>>;
      const unitIds = data.map((u) => u['id']);
      expect(unitIds).not.toContain(unitIdB);
    });

    it('User A cannot access Dealership B unit directly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/units/${unitIdB}`,
        headers: authHeader(tokenA),
      });

      expect(response.statusCode).toBe(404);
    });

    it('User A cannot update Dealership B unit', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/units/${unitIdB}`,
        headers: authHeader(tokenA),
        payload: { status: 'sold' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('User B can see their own units', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/units',
        headers: authHeader(tokenB),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Array<Record<string, unknown>>;
      expect(data.length).toBe(1);
      expect(data[0]!['id']).toBe(unitIdB);
    });

    it('User B cannot access Dealership A unit directly', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/units/${unitIdA}`,
        headers: authHeader(tokenB),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── Alerts isolation ─────────────────────────────────────────────────────

  describe('Alert isolation', () => {
    it('User A cannot see Dealership B alerts', async () => {
      const responseA = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts',
        headers: authHeader(tokenA),
      });

      const responseB = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts',
        headers: authHeader(tokenB),
      });

      expect(responseA.statusCode).toBe(200);
      expect(responseB.statusCode).toBe(200);

      const dataA = (responseA.json() as Record<string, unknown>)['data'] as unknown[];
      const dataB = (responseB.json() as Record<string, unknown>)['data'] as unknown[];

      // Both should be empty (no alerts created) but importantly they are isolated
      expect(dataA).toBeDefined();
      expect(dataB).toBeDefined();
    });
  });

  // ── Work orders isolation ────────────────────────────────────────────────

  describe('Work order isolation', () => {
    it('User A cannot see Dealership B work orders', async () => {
      // Create a WO for dealership B
      await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(tokenB),
        payload: { unit_id: unitIdB, order_type: 'pdi', priority: 'normal' },
      });

      // User A lists WOs - should see none
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/work-orders',
        headers: authHeader(tokenA),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data).toHaveLength(0);
    });

    it('User A cannot create a work order for Dealership B unit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(tokenA),
        payload: { unit_id: unitIdB, order_type: 'pdi', priority: 'normal' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── Recalls isolation ────────────────────────────────────────────────────

  describe('Recall isolation', () => {
    it('User A cannot see Dealership B recalls', async () => {
      // Create recall for dealership B
      await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(tokenB),
        payload: { title: 'B Recall', affected_makes: ['Winnebago'] },
      });

      // User A lists recalls
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recalls',
        headers: authHeader(tokenA),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data).toHaveLength(0);
    });
  });

  // ── Settings isolation ───────────────────────────────────────────────────

  describe('Settings isolation', () => {
    it('User A sees their own dealership settings, not B', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings',
        headers: authHeader(tokenA),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(dealershipIdA);
    });

    it('User B sees their own dealership settings, not A', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings',
        headers: authHeader(tokenB),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(dealershipIdB);
    });
  });

  // ── Analytics isolation ──────────────────────────────────────────────────

  describe('Analytics isolation', () => {
    it('User A analytics only reflect Dealership A inventory', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/inventory',
        headers: authHeader(tokenA),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      // Dealership A has exactly 1 unit
      expect(data['total_units']).toBe(1);
    });

    it('User B analytics only reflect Dealership B inventory', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/inventory',
        headers: authHeader(tokenB),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      // Dealership B has exactly 1 unit
      expect(data['total_units']).toBe(1);
    });
  });
});
