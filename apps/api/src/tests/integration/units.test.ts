// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Unit routes (/api/v1/units)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Unit Routes', () => {
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

  // ── POST /api/v1/units ─────────────────────────────────────────────────────

  describe('POST /api/v1/units', () => {
    const validUnit = {
      stock_number: 'TEST-001',
      year: 2025,
      make: 'Jayco',
      model: 'Eagle',
      unit_type: 'travel_trailer',
      status: 'available',
    };

    it('creates a unit and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: validUnit,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      const data = body['data'] as Record<string, unknown>;
      expect(data['stockNumber']).toBe('TEST-001');
      expect(data['year']).toBe(2025);
      expect(data['make']).toBe('Jayco');
      expect(data['model']).toBe('Eagle');
      expect(data['unitType']).toBe('travel_trailer');
      expect(data['status']).toBe('available');
      expect(data['dealershipId']).toBe(dealershipId);
      expect(typeof data['id']).toBe('string');
    });

    it('rejects duplicate stock number with 409', async () => {
      // Create first
      await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: validUnit,
      });

      // Attempt duplicate
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: validUnit,
      });

      expect(response.statusCode).toBe(409);
      const body = response.json() as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('CONFLICT');
    });

    it('rejects without auth with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        payload: validUnit,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/units ──────────────────────────────────────────────────────

  describe('GET /api/v1/units', () => {
    it('lists units for the dealership', async () => {
      // Create two units
      await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'LIST-001',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'LIST-002',
          year: 2024,
          make: 'Winnebago',
          model: 'Vista',
          unit_type: 'motorhome',
          status: 'available',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/units',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(2);
      expect(body).toHaveProperty('pagination');
    });

    it('supports status filter', async () => {
      // Create one available, one sold
      await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'FILTER-001',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'FILTER-002',
          year: 2024,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'sold',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/units?status=available',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Array<Record<string, unknown>>;
      expect(data.length).toBe(1);
      expect(data[0]!['status']).toBe('available');
    });

    it('supports search filter', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'SEARCH-ALPHA',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'SEARCH-BETA',
          year: 2025,
          make: 'Winnebago',
          model: 'Vista',
          unit_type: 'motorhome',
          status: 'available',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/units?search=ALPHA',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(1);
    });

    it('returns empty list for a different dealership (multi-tenancy)', async () => {
      // Create a unit under the current dealership
      await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'TENANT-001',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });

      // Create a second dealership with its own user/token
      const otherDealership = await createTestDealership(app);
      const otherUser = await createTestUser(app, otherDealership.id, 'owner');
      const otherToken = generateToken(app, {
        id: otherUser.id,
        dealershipId: otherDealership.id,
        role: otherUser.role,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/units',
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(0);
    });
  });

  // ── GET /api/v1/units/:id ──────────────────────────────────────────────────

  describe('GET /api/v1/units/:id', () => {
    it('returns a unit with tracker info', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'GET-001',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      const created = createRes.json() as Record<string, unknown>;
      const unitData = created['data'] as Record<string, unknown>;
      const unitId = unitData['id'] as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/units/${unitId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(unitId);
      expect(data['stockNumber']).toBe('GET-001');
      expect(data).toHaveProperty('tracker'); // null when no tracker assigned
      expect(data['tracker']).toBeNull();
    });

    it('returns 404 for non-existent id', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/units/${fakeId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
      const body = response.json() as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('NOT_FOUND');
    });

    it('returns 404 for a unit belonging to a different dealership', async () => {
      // Create unit under current dealership
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'XDEAL-001',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      const created = createRes.json() as Record<string, unknown>;
      const unitData = created['data'] as Record<string, unknown>;
      const unitId = unitData['id'] as string;

      // Get a token for a different dealership
      const otherDealership = await createTestDealership(app);
      const otherUser = await createTestUser(app, otherDealership.id, 'owner');
      const otherToken = generateToken(app, {
        id: otherUser.id,
        dealershipId: otherDealership.id,
        role: otherUser.role,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/units/${unitId}`,
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── PATCH /api/v1/units/:id ────────────────────────────────────────────────

  describe('PATCH /api/v1/units/:id', () => {
    it('updates unit fields', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'PATCH-001',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      const created = createRes.json() as Record<string, unknown>;
      const unitData = created['data'] as Record<string, unknown>;
      const unitId = unitData['id'] as string;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/units/${unitId}`,
        headers: authHeader(token),
        payload: {
          make: 'Winnebago',
          status: 'sold',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['make']).toBe('Winnebago');
      expect(data['status']).toBe('sold');
      // Stock number should remain unchanged
      expect(data['stockNumber']).toBe('PATCH-001');
    });

    it('rejects conflicting stock number with 409', async () => {
      // Create two units
      await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'CONFLICT-A',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });

      const secondRes = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'CONFLICT-B',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      const secondData = (secondRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const secondId = secondData['id'] as string;

      // Try to rename CONFLICT-B to CONFLICT-A
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/units/${secondId}`,
        headers: authHeader(token),
        payload: { stock_number: 'CONFLICT-A' },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  // ── DELETE /api/v1/units/:id ───────────────────────────────────────────────

  describe('DELETE /api/v1/units/:id', () => {
    it('soft-deletes (archives) a unit', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'DEL-001',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      const created = createRes.json() as Record<string, unknown>;
      const unitData = created['data'] as Record<string, unknown>;
      const unitId = unitData['id'] as string;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/units/${unitId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body['message']).toBe('Unit archived successfully');

      // Confirm the unit is no longer returned in lists
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/units',
        headers: authHeader(token),
      });
      const listBody = listRes.json() as Record<string, unknown>;
      const listData = listBody['data'] as unknown[];
      expect(listData.length).toBe(0);
    });

    it('returns 404 for an already archived unit', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'DEL-002',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      const created = createRes.json() as Record<string, unknown>;
      const unitData = created['data'] as Record<string, unknown>;
      const unitId = unitData['id'] as string;

      // Archive once
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/units/${unitId}`,
        headers: authHeader(token),
      });

      // Attempt to archive again
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/units/${unitId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
