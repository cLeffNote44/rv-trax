// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Geo-fence routes (/api/v1/*)
// Geofence routes are registered at prefix '/api/v1', so:
//   - POST/GET /api/v1/lots/:lotId/geofences
//   - GET/PATCH/DELETE /api/v1/geofences/:id
//   - GET /api/v1/geofences/:id/events
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import {
  createTestDealership,
  createTestUser,
  createTestLot,
} from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';
import { lots } from '@rv-trax/db';
import { eq } from 'drizzle-orm';

describe('Geofence Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let dealershipId: string;
  let lotId: string;

  // A valid boundary polygon (roughly a small square around Austin, TX)
  const validBoundary: [number, number][] = [
    [30.25, -97.75],
    [30.26, -97.75],
    [30.26, -97.74],
    [30.25, -97.74],
  ];

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

    // Create a lot with a boundary that encompasses our test geofences
    const lot = await createTestLot(app, dealershipId);
    lotId = lot.id;

    // Update the lot's boundary to cover our test area via DB directly
    await app.db
      .update(lots)
      .set({
        boundary: JSON.stringify([
          [30.24, -97.76],
          [30.27, -97.76],
          [30.27, -97.73],
          [30.24, -97.73],
        ]),
      })
      .where(eq(lots.id, lotId));
  });

  // ── POST /api/v1/lots/:lotId/geofences ─────────────────────────────────────

  describe('POST /api/v1/lots/:lotId/geofences', () => {
    it('creates a lot_boundary geofence and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Main Boundary',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
          color: '#FF0000',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Main Boundary');
      expect(data['fenceType']).toBe('lot_boundary');
      expect(data['color']).toBe('#FF0000');
      expect(data['dealershipId']).toBe(dealershipId);
      expect(data['lotId']).toBe(lotId);
      expect(typeof data['id']).toBe('string');
    });

    it('creates a zone geofence within the lot boundary', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Display Zone',
          fence_type: 'zone',
          boundary: [
            [30.252, -97.752],
            [30.255, -97.752],
            [30.255, -97.748],
            [30.252, -97.748],
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['fenceType']).toBe('zone');
    });

    it('rejects without auth with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        payload: {
          name: 'No Auth Fence',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 404 for a non-existent lot', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${fakeId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Ghost Lot Fence',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('rejects boundary with fewer than 3 points', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Too Small',
          fence_type: 'lot_boundary',
          boundary: [
            [30.25, -97.75],
            [30.26, -97.75],
          ],
        },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
    });
  });

  // ── GET /api/v1/lots/:lotId/geofences ──────────────────────────────────────

  describe('GET /api/v1/lots/:lotId/geofences', () => {
    it('lists geofences for a lot', async () => {
      // Create two fences
      await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Fence A',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Fence B',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(2);
    });

    it('returns empty for a different dealership (multi-tenancy)', async () => {
      // Create a fence under the first dealership's lot
      await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Tenant Fence',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });

      // Second dealership tries to access the same lot
      const otherDealership = await createTestDealership(app);
      const otherUser = await createTestUser(app, otherDealership.id, 'owner');
      const otherToken = generateToken(app, {
        id: otherUser.id,
        dealershipId: otherDealership.id,
        role: otherUser.role,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(otherToken),
      });

      // The lot doesn't belong to the other dealership, so 404
      expect(response.statusCode).toBe(404);
    });
  });

  // ── GET /api/v1/geofences/:id ──────────────────────────────────────────────

  describe('GET /api/v1/geofences/:id', () => {
    it('returns geofence detail with recent_events', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Detail Fence',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });
      const fenceData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const fenceId = fenceData['id'] as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/geofences/${fenceId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(fenceId);
      expect(data['name']).toBe('Detail Fence');
      expect(data).toHaveProperty('recent_events');
      expect(Array.isArray(data['recent_events'])).toBe(true);
    });

    it('returns 404 for non-existent geofence', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/geofences/${fakeId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── PATCH /api/v1/geofences/:id ────────────────────────────────────────────

  describe('PATCH /api/v1/geofences/:id', () => {
    it('updates geofence name and color', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Original Name',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });
      const fenceData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const fenceId = fenceData['id'] as string;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/geofences/${fenceId}`,
        headers: authHeader(token),
        payload: {
          name: 'Updated Name',
          color: '#00FF00',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Updated Name');
      expect(data['color']).toBe('#00FF00');
    });

    it('can deactivate a geofence', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'To Deactivate',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });
      const fenceData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const fenceId = fenceData['id'] as string;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/geofences/${fenceId}`,
        headers: authHeader(token),
        payload: { is_active: false },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['isActive']).toBe(false);
    });

    it('returns 404 for non-existent geofence', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/geofences/${fakeId}`,
        headers: authHeader(token),
        payload: { name: 'Ghost' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── DELETE /api/v1/geofences/:id ───────────────────────────────────────────

  describe('DELETE /api/v1/geofences/:id', () => {
    it('soft-deletes a geofence', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'To Delete',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });
      const fenceData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const fenceId = fenceData['id'] as string;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/geofences/${fenceId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body['message']).toBe('Geo-fence deleted successfully');

      // Verify it no longer appears in the list
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
      });
      const listData = (listRes.json() as Record<string, unknown>)['data'] as unknown[];
      expect(listData.length).toBe(0);
    });

    it('returns 404 for already-deleted geofence', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Double Delete',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });
      const fenceData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const fenceId = fenceData['id'] as string;

      // Delete once
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/geofences/${fenceId}`,
        headers: authHeader(token),
      });

      // Delete again
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/geofences/${fenceId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── GET /api/v1/geofences/:id/events ───────────────────────────────────────

  describe('GET /api/v1/geofences/:id/events', () => {
    it('returns empty events list for a new geofence', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/v1/lots/${lotId}/geofences`,
        headers: authHeader(token),
        payload: {
          name: 'Events Fence',
          fence_type: 'lot_boundary',
          boundary: validBoundary,
        },
      });
      const fenceData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const fenceId = fenceData['id'] as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/geofences/${fenceId}/events`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(0);
      expect(body).toHaveProperty('pagination');
      const pagination = body['pagination'] as Record<string, unknown>;
      expect(pagination['has_more']).toBe(false);
    });

    it('returns 404 for non-existent geofence', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/geofences/${fakeId}/events`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
