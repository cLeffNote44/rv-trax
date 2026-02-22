// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Lot routes (/api/v1/lots)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Lot Routes', () => {
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

  const validLot = {
    name: 'Main Lot',
    address: '456 Lot Ave',
    boundary: [
      [30.0, -97.0],
      [30.001, -97.0],
      [30.001, -96.999],
      [30.0, -96.999],
    ],
  };

  // ── POST /api/v1/lots ──────────────────────────────────────────────────────

  describe('POST /api/v1/lots', () => {
    it('creates a lot and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        headers: authHeader(token),
        payload: validLot,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Main Lot');
      expect(data['dealershipId']).toBe(dealershipId);
      expect(typeof data['id']).toBe('string');
    });

    it('rejects without auth with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        payload: validLot,
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects lot with insufficient boundary points', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        headers: authHeader(token),
        payload: {
          name: 'Bad Lot',
          boundary: [
            [30.0, -97.0],
            [30.001, -97.0],
          ],
        },
      });

      // Should fail validation (boundary needs >= 3 points)
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
    });
  });

  // ── GET /api/v1/lots ───────────────────────────────────────────────────────

  describe('GET /api/v1/lots', () => {
    it('lists lots for the dealership', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        headers: authHeader(token),
        payload: validLot,
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        headers: authHeader(token),
        payload: { ...validLot, name: 'Overflow Lot' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/lots',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(2);
    });

    it('returns empty for a different dealership (multi-tenancy)', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        headers: authHeader(token),
        payload: validLot,
      });

      const otherDealership = await createTestDealership(app);
      const otherUser = await createTestUser(app, otherDealership.id, 'owner');
      const otherToken = generateToken(app, {
        id: otherUser.id,
        dealershipId: otherDealership.id,
        role: otherUser.role,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/lots',
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(0);
    });
  });

  // ── PATCH /api/v1/lots/:id ─────────────────────────────────────────────────

  describe('PATCH /api/v1/lots/:id', () => {
    it('updates lot name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        headers: authHeader(token),
        payload: validLot,
      });
      const lotData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const lotId = lotData['id'] as string;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lots/${lotId}`,
        headers: authHeader(token),
        payload: { name: 'Renamed Lot' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Renamed Lot');
    });

    it('returns 404 for non-existent lot', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lots/${fakeId}`,
        headers: authHeader(token),
        payload: { name: 'Ghost Lot' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/lots/:id/grid — create spots ─────────────────────────────

  describe('POST /api/v1/lots/:id/grid', () => {
    it('creates spots for a lot and returns spot count', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        headers: authHeader(token),
        payload: validLot,
      });
      const lotData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const lotId = lotData['id'] as string;

      const spots = [
        {
          row_label: 'A',
          spot_number: 1,
          center_lat: 30.0001,
          center_lng: -97.0001,
          spot_type: 'standard',
        },
        {
          row_label: 'A',
          spot_number: 2,
          center_lat: 30.0002,
          center_lng: -97.0002,
          spot_type: 'wide',
        },
        {
          row_label: 'B',
          spot_number: 1,
          center_lat: 30.0003,
          center_lng: -97.0003,
          spot_type: 'pull_through',
        },
      ];

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/grid`,
        headers: authHeader(token),
        payload: spots,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      expect(body['spot_count']).toBe(3);
    });

    it('returns 404 for a non-existent lot', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${fakeId}/grid`,
        headers: authHeader(token),
        payload: [
          { row_label: 'A', spot_number: 1, center_lat: 30.0, center_lng: -97.0 },
        ],
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── GET /api/v1/lots/:id/grid — get spots ─────────────────────────────────

  describe('GET /api/v1/lots/:id/grid', () => {
    it('returns spots defined for a lot', async () => {
      // Create lot
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        headers: authHeader(token),
        payload: validLot,
      });
      const lotData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const lotId = lotData['id'] as string;

      // Define grid
      await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/grid`,
        headers: authHeader(token),
        payload: [
          { row_label: 'A', spot_number: 1, center_lat: 30.0001, center_lng: -97.0001 },
          { row_label: 'A', spot_number: 2, center_lat: 30.0002, center_lng: -97.0002 },
        ],
      });

      // Fetch grid
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/lots/${lotId}/grid`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(2);
    });
  });

  // ── Full lot lifecycle ─────────────────────────────────────────────────────

  describe('Full lot lifecycle', () => {
    it('creates, lists, gets, updates, and adds spots to a lot', async () => {
      // 1. Create lot
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/lots',
        headers: authHeader(token),
        payload: validLot,
      });
      expect(createRes.statusCode).toBe(201);
      const lotData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const lotId = lotData['id'] as string;

      // 2. List should include the new lot
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/lots',
        headers: authHeader(token),
      });
      expect(listRes.statusCode).toBe(200);
      const listData = (listRes.json() as Record<string, unknown>)['data'] as unknown[];
      expect(listData.length).toBeGreaterThanOrEqual(1);

      // 3. Update name
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/lots/${lotId}`,
        headers: authHeader(token),
        payload: { name: 'Updated Lot Name' },
      });
      expect(patchRes.statusCode).toBe(200);
      const updatedData = (patchRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      expect(updatedData['name']).toBe('Updated Lot Name');

      // 4. Add spots
      const gridRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/grid`,
        headers: authHeader(token),
        payload: [
          { row_label: 'A', spot_number: 1, center_lat: 30.0001, center_lng: -97.0001 },
          { row_label: 'A', spot_number: 2, center_lat: 30.0002, center_lng: -97.0002 },
        ],
      });
      expect(gridRes.statusCode).toBe(201);
      const gridBody = gridRes.json() as Record<string, unknown>;
      expect(gridBody['spot_count']).toBe(2);

      // 5. Verify spots via grid endpoint
      const getGridRes = await app.inject({
        method: 'GET',
        url: `/api/v1/lots/${lotId}/grid`,
        headers: authHeader(token),
      });
      expect(getGridRes.statusCode).toBe(200);
      const spotsData = (getGridRes.json() as Record<string, unknown>)['data'] as unknown[];
      expect(spotsData.length).toBe(2);
    });
  });
});
