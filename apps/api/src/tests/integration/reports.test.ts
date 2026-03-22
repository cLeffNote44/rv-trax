// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Report routes (/api/v1/reports/*)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Report Routes', () => {
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

  // ── POST /api/v1/reports ─────────────────────────────────────────────────

  describe('POST /api/v1/reports', () => {
    it('creates a scheduled report', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: authHeader(token),
        payload: {
          report_type: 'inventory_summary',
          format: 'csv',
          schedule: 'weekly',
          recipients: ['test@test.com'],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['report_type']).toBe('inventory_summary');
      expect(data['format']).toBe('csv');
      expect(data['schedule']).toBe('weekly');
      expect(data['is_active']).toBe(true);
      expect(data).toHaveProperty('next_run_at');

      // Recipients should be returned as an array
      const recipients = data['recipients'] as string[];
      expect(recipients).toContain('test@test.com');
    });

    it('rejects creation with invalid email recipient', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: authHeader(token),
        payload: {
          report_type: 'inventory_summary',
          format: 'csv',
          schedule: 'weekly',
          recipients: ['not-an-email'],
        },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    it('rejects creation without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        payload: {
          report_type: 'inventory_summary',
          format: 'csv',
          schedule: 'weekly',
          recipients: ['test@test.com'],
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/reports ──────────────────────────────────────────────────

  describe('GET /api/v1/reports', () => {
    it('lists scheduled reports for the dealership', async () => {
      // Create two reports
      await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: authHeader(token),
        payload: {
          report_type: 'inventory_summary',
          format: 'csv',
          schedule: 'weekly',
          recipients: ['a@test.com'],
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: authHeader(token),
        payload: {
          report_type: 'movement_report',
          format: 'json',
          schedule: 'daily',
          recipients: ['b@test.com'],
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data).toHaveLength(2);
    });

    it('returns empty list when no reports exist', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data).toHaveLength(0);
    });
  });

  // ── DELETE /api/v1/reports/:id ───────────────────────────────────────────

  describe('DELETE /api/v1/reports/:id', () => {
    it('deletes a scheduled report', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: authHeader(token),
        payload: {
          report_type: 'inventory_summary',
          format: 'csv',
          schedule: 'weekly',
          recipients: ['del@test.com'],
        },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const reportId = created['id'] as string;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/reports/${reportId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('message');

      // Verify it's gone
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/reports/${reportId}`,
        headers: authHeader(token),
      });
      expect(getRes.statusCode).toBe(404);
    });

    it('returns 404 when deleting non-existent report', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/reports/00000000-0000-0000-0000-000000000000',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── GET /api/v1/reports/generate/:type ───────────────────────────────────

  describe('GET /api/v1/reports/generate/:type', () => {
    it('generates a one-off inventory_summary report in JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/generate/inventory_summary',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });

    it('generates a one-off report in CSV format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/generate/inventory_summary?format=csv',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('rejects invalid report type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/generate/invalid_type',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(400);
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/generate/inventory_summary',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── POST /api/v1/reports/:id/run ─────────────────────────────────────────

  describe('POST /api/v1/reports/:id/run', () => {
    it('manually triggers a report generation', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/reports',
        headers: authHeader(token),
        payload: {
          report_type: 'inventory_summary',
          format: 'json',
          schedule: 'daily',
          recipients: ['run@test.com'],
        },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const reportId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/reports/${reportId}/run`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
    });
  });
});
