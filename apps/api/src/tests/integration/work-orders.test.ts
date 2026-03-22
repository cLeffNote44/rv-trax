// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Work Order routes (/api/v1/work-orders/*)
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

describe('Work Order Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let dealershipId: string;
  let unitId: string;
  let userId: string;

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
    userId = u.id;
    token = generateToken(app, { id: u.id, dealershipId, role: 'owner' });
    const unit = await createTestUnit(app, dealershipId);
    unitId = unit.id;
  });

  // ── POST /api/v1/work-orders ─────────────────────────────────────────────

  describe('POST /api/v1/work-orders', () => {
    it('creates a work order with pending status', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: {
          unit_id: unitId,
          order_type: 'pdi',
          priority: 'normal',
          notes: 'Test WO',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['unit_id']).toBe(unitId);
      expect(data['order_type']).toBe('pdi');
      expect(data['priority']).toBe('normal');
      expect(data['status']).toBe('pending');
      expect(data['notes']).toBe('Test WO');
    });

    it('creates a work order with assigned status when assigned_to is provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: {
          unit_id: unitId,
          order_type: 'pdi',
          priority: 'urgent',
          assigned_to: userId,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['status']).toBe('assigned');
      expect(data['assigned_to']).toBe(userId);
    });

    it('rejects creation with non-existent unit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: {
          unit_id: '00000000-0000-0000-0000-000000000000',
          order_type: 'pdi',
          priority: 'normal',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('rejects creation without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        payload: {
          unit_id: unitId,
          order_type: 'pdi',
          priority: 'normal',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/work-orders ──────────────────────────────────────────────

  describe('GET /api/v1/work-orders', () => {
    it('lists work orders for the dealership', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: { unit_id: unitId, order_type: 'pdi', priority: 'normal' },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: { unit_id: unitId, order_type: 'detail', priority: 'low' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(2);
    });

    it('returns paginated response with total', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: { unit_id: unitId, order_type: 'pdi', priority: 'normal' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
    });
  });

  // ── GET /api/v1/work-orders/:id ──────────────────────────────────────────

  describe('GET /api/v1/work-orders/:id', () => {
    it('returns work order detail with unit info', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: { unit_id: unitId, order_type: 'pdi', priority: 'normal' },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const woId = created['id'] as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/work-orders/${woId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(woId);
      expect(data).toHaveProperty('unit');
      const unit = data['unit'] as Record<string, unknown>;
      expect(unit).toHaveProperty('make');
    });

    it('returns 404 for non-existent work order', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/work-orders/00000000-0000-0000-0000-000000000000',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── PATCH /api/v1/work-orders/:id ────────────────────────────────────────

  describe('PATCH /api/v1/work-orders/:id', () => {
    it('updates work order notes and priority', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: { unit_id: unitId, order_type: 'pdi', priority: 'normal' },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const woId = created['id'] as string;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/work-orders/${woId}`,
        headers: authHeader(token),
        payload: { notes: 'Updated notes', priority: 'urgent' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['notes']).toBe('Updated notes');
      expect(data['priority']).toBe('urgent');
    });

    it('returns 404 for non-existent work order', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/work-orders/00000000-0000-0000-0000-000000000000',
        headers: authHeader(token),
        payload: { notes: 'Ghost' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/work-orders/:id/status ──────────────────────────────────

  describe('POST /api/v1/work-orders/:id/status', () => {
    it('transitions pending -> assigned -> in_progress -> complete', async () => {
      // Create with assigned_to so it starts as assigned
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: {
          unit_id: unitId,
          order_type: 'pdi',
          priority: 'normal',
          assigned_to: userId,
        },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const woId = created['id'] as string;
      expect(created['status']).toBe('assigned');

      // assigned -> in_progress
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/work-orders/${woId}/status`,
        headers: authHeader(token),
        payload: { status: 'in_progress' },
      });
      expect(res1.statusCode).toBe(200);
      const data1 = (res1.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      expect(data1['status']).toBe('in_progress');

      // in_progress -> complete
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/work-orders/${woId}/status`,
        headers: authHeader(token),
        payload: { status: 'complete' },
      });
      expect(res2.statusCode).toBe(200);
      const data2 = (res2.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      expect(data2['status']).toBe('complete');
      expect(data2['completed_at']).toBeTruthy();
    });

    it('transitions pending -> cancelled', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: { unit_id: unitId, order_type: 'pdi', priority: 'normal' },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const woId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/work-orders/${woId}/status`,
        headers: authHeader(token),
        payload: { status: 'cancelled' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['status']).toBe('cancelled');
    });

    it('rejects invalid status transition (pending -> complete)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: { unit_id: unitId, order_type: 'pdi', priority: 'normal' },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const woId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/work-orders/${woId}/status`,
        headers: authHeader(token),
        payload: { status: 'complete' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects invalid status transition (pending -> in_progress)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: { unit_id: unitId, order_type: 'pdi', priority: 'normal' },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const woId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/work-orders/${woId}/status`,
        headers: authHeader(token),
        payload: { status: 'in_progress' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects transition from complete (terminal state)', async () => {
      // Start as assigned
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: {
          unit_id: unitId,
          order_type: 'pdi',
          priority: 'normal',
          assigned_to: userId,
        },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const woId = created['id'] as string;

      // assigned -> in_progress -> complete
      await app.inject({
        method: 'POST',
        url: `/api/v1/work-orders/${woId}/status`,
        headers: authHeader(token),
        payload: { status: 'in_progress' },
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/work-orders/${woId}/status`,
        headers: authHeader(token),
        payload: { status: 'complete' },
      });

      // Try: complete -> pending (invalid)
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/work-orders/${woId}/status`,
        headers: authHeader(token),
        payload: { status: 'pending' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('rejects assigning without assigned_to on WO', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/work-orders',
        headers: authHeader(token),
        payload: { unit_id: unitId, order_type: 'pdi', priority: 'normal' },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const woId = created['id'] as string;

      // pending -> assigned (no assigned_to on the WO)
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/work-orders/${woId}/status`,
        headers: authHeader(token),
        payload: { status: 'assigned' },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
