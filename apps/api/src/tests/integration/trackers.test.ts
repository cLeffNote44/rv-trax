// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Tracker routes (/api/v1/trackers)
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

describe('Tracker Routes', () => {
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

  const trackerPayload = (suffix: string) => ({
    device_eui: `EUI-TEST-${suffix}`,
    label: `Test Tracker ${suffix}`,
  });

  // ── POST /api/v1/trackers ──────────────────────────────────────────────────

  describe('POST /api/v1/trackers', () => {
    it('creates a tracker and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('001'),
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['device_eui']).toBe('EUI-TEST-001');
      expect(data['label']).toBe('Test Tracker 001');
      expect(data['status']).toBe('unassigned');
      expect(data['dealership_id']).toBe(dealershipId);
    });

    it('rejects duplicate device_eui with 409', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('DUP'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('DUP'),
      });

      expect(response.statusCode).toBe(409);
      const body = response.json() as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('CONFLICT');
    });

    it('rejects without auth with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        payload: trackerPayload('NOAUTH'),
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/trackers ───────────────────────────────────────────────────

  describe('GET /api/v1/trackers', () => {
    it('lists trackers for the dealership', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('LIST-1'),
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('LIST-2'),
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/trackers',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(2);
      expect(body).toHaveProperty('pagination');
    });
  });

  // ── GET /api/v1/trackers/:id ───────────────────────────────────────────────

  describe('GET /api/v1/trackers/:id', () => {
    it('returns tracker details with null assigned_unit when unassigned', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('DETAIL'),
      });
      const trackerData = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const trackerId = trackerData['id'] as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/trackers/${trackerId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(trackerId);
      expect(data['device_eui']).toBe('EUI-TEST-DETAIL');
      expect(data['assigned_unit']).toBeNull();
    });

    it('returns 404 for non-existent tracker', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/trackers/${fakeId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/trackers/:id/assign ───────────────────────────────────────

  describe('POST /api/v1/trackers/:id/assign', () => {
    it('assigns a tracker to a unit', async () => {
      // Create tracker
      const trackerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('ASSIGN'),
      });
      const trackerData = (trackerRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const trackerId = trackerData['id'] as string;

      // Create unit via factory (direct DB insert)
      const unit = await createTestUnit(app, dealershipId);

      // Assign
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/trackers/${trackerId}/assign`,
        headers: authHeader(token),
        payload: { unit_id: unit.id },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['tracker_id']).toBe(trackerId);
      expect(data['unit_id']).toBe(unit.id);
    });

    it('rejects assigning an already-assigned tracker with 409', async () => {
      // Create tracker
      const trackerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('DOUBLE'),
      });
      const trackerData = (trackerRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const trackerId = trackerData['id'] as string;

      // Create two units
      const unit1 = await createTestUnit(app, dealershipId, { stockNumber: 'DOUBLE-U1' });
      const unit2 = await createTestUnit(app, dealershipId, { stockNumber: 'DOUBLE-U2' });

      // Assign to first unit
      await app.inject({
        method: 'POST',
        url: `/api/v1/trackers/${trackerId}/assign`,
        headers: authHeader(token),
        payload: { unit_id: unit1.id },
      });

      // Try to assign to second unit without unassigning
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/trackers/${trackerId}/assign`,
        headers: authHeader(token),
        payload: { unit_id: unit2.id },
      });

      expect(response.statusCode).toBe(409);
    });

    it('shows assignment in tracker detail after assign', async () => {
      // Create tracker
      const trackerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('VERIFY'),
      });
      const trackerData = (trackerRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const trackerId = trackerData['id'] as string;

      // Create unit
      const unit = await createTestUnit(app, dealershipId, { stockNumber: 'VERIFY-U1' });

      // Assign
      await app.inject({
        method: 'POST',
        url: `/api/v1/trackers/${trackerId}/assign`,
        headers: authHeader(token),
        payload: { unit_id: unit.id },
      });

      // Get tracker detail — should show assigned_unit
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/trackers/${trackerId}`,
        headers: authHeader(token),
      });

      expect(detailRes.statusCode).toBe(200);
      const detailBody = detailRes.json() as Record<string, unknown>;
      const detailData = detailBody['data'] as Record<string, unknown>;
      expect(detailData['assigned_unit']).not.toBeNull();
      const assignedUnit = detailData['assigned_unit'] as Record<string, unknown>;
      expect(assignedUnit['unit_id']).toBe(unit.id);
      expect(assignedUnit['stock_number']).toBe('VERIFY-U1');
    });

    it('shows tracker in unit detail after assign', async () => {
      // Create tracker
      const trackerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('UNITCHK'),
      });
      const trackerData = (trackerRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const trackerId = trackerData['id'] as string;

      // Create unit via API so it has correct fields
      const unitRes = await app.inject({
        method: 'POST',
        url: '/api/v1/units',
        headers: authHeader(token),
        payload: {
          stock_number: 'UNITCHK-001',
          year: 2025,
          make: 'Jayco',
          model: 'Eagle',
          unit_type: 'travel_trailer',
          status: 'available',
        },
      });
      const unitData = (unitRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const unitId = unitData['id'] as string;

      // Assign
      await app.inject({
        method: 'POST',
        url: `/api/v1/trackers/${trackerId}/assign`,
        headers: authHeader(token),
        payload: { unit_id: unitId },
      });

      // Get unit detail — should show tracker
      const unitDetailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/units/${unitId}`,
        headers: authHeader(token),
      });

      expect(unitDetailRes.statusCode).toBe(200);
      const unitDetailBody = unitDetailRes.json() as Record<string, unknown>;
      const unitDetail = unitDetailBody['data'] as Record<string, unknown>;
      expect(unitDetail['tracker']).not.toBeNull();
      const tracker = unitDetail['tracker'] as Record<string, unknown>;
      expect(tracker['tracker_id']).toBe(trackerId);
      expect(tracker['device_eui']).toBe('EUI-TEST-UNITCHK');
    });
  });

  // ── POST /api/v1/trackers/:id/unassign ─────────────────────────────────────

  describe('POST /api/v1/trackers/:id/unassign', () => {
    it('unassigns a tracker from a unit', async () => {
      // Create and assign
      const trackerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('UNASSIGN'),
      });
      const trackerData = (trackerRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const trackerId = trackerData['id'] as string;

      const unit = await createTestUnit(app, dealershipId, { stockNumber: 'UNASSIGN-U1' });

      await app.inject({
        method: 'POST',
        url: `/api/v1/trackers/${trackerId}/assign`,
        headers: authHeader(token),
        payload: { unit_id: unit.id },
      });

      // Unassign
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/trackers/${trackerId}/unassign`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body['message']).toBe('Tracker unassigned successfully');

      // Verify tracker detail shows no assignment
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/trackers/${trackerId}`,
        headers: authHeader(token),
      });
      const detailData = (detailRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      expect(detailData['assigned_unit']).toBeNull();
    });

    it('rejects unassign on a tracker that is not assigned', async () => {
      const trackerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/trackers',
        headers: authHeader(token),
        payload: trackerPayload('NOTASSIGNED'),
      });
      const trackerData = (trackerRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const trackerId = trackerData['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/trackers/${trackerId}/unassign`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = response.json() as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('BAD_REQUEST');
    });
  });
});
