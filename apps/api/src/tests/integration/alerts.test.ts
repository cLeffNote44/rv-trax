// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Alert routes (/api/v1/alerts)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';
import { alerts, alertRules } from '@rv-trax/db';

describe('Alert Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let dealershipId: string;
  let userId: string;

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
    userId = user.id;
    token = generateToken(app, { id: user.id, dealershipId, role: user.role });
  });

  /** Helper: inserts an alert rule and returns its id */
  async function createAlertRule(): Promise<string> {
    const [rule] = await app.db
      .insert(alertRules)
      .values({
        dealershipId,
        ruleType: 'geofence_breach',
        severity: 'warning',
      })
      .returning();
    return rule!.id;
  }

  /** Helper: inserts an alert directly into the DB */
  async function createAlert(overrides: Partial<typeof alerts.$inferInsert> = {}): Promise<string> {
    const ruleId = await createAlertRule();
    const [alert] = await app.db
      .insert(alerts)
      .values({
        dealershipId,
        ruleId,
        alertType: 'geofence_breach',
        severity: 'warning',
        title: 'Test Alert',
        status: 'new_alert',
        ...overrides,
      })
      .returning();
    return alert!.id;
  }

  // ── GET /api/v1/alerts ─────────────────────────────────────────────────────

  describe('GET /api/v1/alerts', () => {
    it('lists alerts for the dealership', async () => {
      await createAlert({ title: 'Alert 1' });
      await createAlert({ title: 'Alert 2', severity: 'critical' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(2);
      expect(body).toHaveProperty('pagination');
    });

    it('filters by status', async () => {
      await createAlert({ title: 'New Alert', status: 'new_alert' });
      await createAlert({ title: 'Acked Alert', status: 'acknowledged' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts?status=new_alert',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Array<Record<string, unknown>>;
      expect(data.length).toBe(1);
      expect(data[0]!['status']).toBe('new_alert');
    });

    it('filters by severity', async () => {
      await createAlert({ title: 'Warning', severity: 'warning' });
      await createAlert({ title: 'Critical', severity: 'critical' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts?severity=critical',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Array<Record<string, unknown>>;
      expect(data.length).toBe(1);
      expect(data[0]!['severity']).toBe('critical');
    });

    it('returns empty for a different dealership (multi-tenancy)', async () => {
      await createAlert({ title: 'Tenant Alert' });

      const otherDealership = await createTestDealership(app);
      const otherUser = await createTestUser(app, otherDealership.id, 'owner');
      const otherToken = generateToken(app, {
        id: otherUser.id,
        dealershipId: otherDealership.id,
        role: otherUser.role,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts',
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(0);
    });

    it('rejects without auth with 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/alerts/unread-count ────────────────────────────────────────

  describe('GET /api/v1/alerts/unread-count', () => {
    it('returns counts by severity for new alerts', async () => {
      await createAlert({ severity: 'warning' });
      await createAlert({ severity: 'warning' });
      await createAlert({ severity: 'critical' });
      await createAlert({ severity: 'info' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/alerts/unread-count',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(Number(data['total'])).toBe(4);
      expect(Number(data['warning'])).toBe(2);
      expect(Number(data['critical'])).toBe(1);
      expect(Number(data['info'])).toBe(1);
    });
  });

  // ── GET /api/v1/alerts/:id ─────────────────────────────────────────────────

  describe('GET /api/v1/alerts/:id', () => {
    it('returns alert detail', async () => {
      const alertId = await createAlert({ title: 'Detail Alert', message: 'Some details' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/alerts/${alertId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(alertId);
      expect(data['title']).toBe('Detail Alert');
      expect(data['message']).toBe('Some details');
      expect(data['status']).toBe('new_alert');
      // Related entities should be null since we didn't attach any
      expect(data['unit']).toBeNull();
      expect(data['tracker']).toBeNull();
    });

    it('returns 404 for non-existent alert', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/alerts/${fakeId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/alerts/:id/acknowledge ────────────────────────────────────

  describe('POST /api/v1/alerts/:id/acknowledge', () => {
    it('acknowledges a new alert', async () => {
      const alertId = await createAlert();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/acknowledge`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['status']).toBe('acknowledged');
      expect(data['acknowledged_by']).toBe(userId);
      expect(data['acknowledged_at']).not.toBeNull();
    });

    it('rejects acknowledging an already acknowledged alert with 400', async () => {
      const alertId = await createAlert();

      // Acknowledge once
      await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/acknowledge`,
        headers: authHeader(token),
      });

      // Try again
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/acknowledge`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(400);
      const body = response.json() as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('BAD_REQUEST');
    });

    it('returns 404 for non-existent alert', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${fakeId}/acknowledge`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/alerts/:id/dismiss ────────────────────────────────────────

  describe('POST /api/v1/alerts/:id/dismiss', () => {
    it('dismisses an alert', async () => {
      const alertId = await createAlert();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/dismiss`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['status']).toBe('dismissed');
    });

    it('returns 404 for non-existent alert', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${fakeId}/dismiss`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/alerts/:id/snooze ─────────────────────────────────────────

  describe('POST /api/v1/alerts/:id/snooze', () => {
    it('snoozes an alert for 1 hour', async () => {
      const alertId = await createAlert();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/snooze`,
        headers: authHeader(token),
        payload: { duration: '1h' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['status']).toBe('snoozed');
      expect(data['snoozed_until']).not.toBeNull();
    });

    it('snoozes an alert for 24 hours', async () => {
      const alertId = await createAlert();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/snooze`,
        headers: authHeader(token),
        payload: { duration: '24h' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['status']).toBe('snoozed');
    });

    it('rejects invalid snooze duration', async () => {
      const alertId = await createAlert();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${alertId}/snooze`,
        headers: authHeader(token),
        payload: { duration: '999h' },
      });

      // Zod validation should reject this
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
    });

    it('returns 404 for non-existent alert', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${fakeId}/snooze`,
        headers: authHeader(token),
        payload: { duration: '1h' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/alerts/bulk-acknowledge ───────────────────────────────────

  describe('POST /api/v1/alerts/bulk-acknowledge', () => {
    it('acknowledges multiple alerts at once', async () => {
      const id1 = await createAlert({ title: 'Bulk 1' });
      const id2 = await createAlert({ title: 'Bulk 2' });
      const id3 = await createAlert({ title: 'Bulk 3' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/alerts/bulk-acknowledge',
        headers: authHeader(token),
        payload: { alert_ids: [id1, id2, id3] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['requested']).toBe(3);
      expect(data['acknowledged']).toBe(3);
    });

    it('skips already acknowledged alerts in bulk', async () => {
      const id1 = await createAlert({ title: 'Already Acked' });
      const id2 = await createAlert({ title: 'Fresh' });

      // Acknowledge the first one
      await app.inject({
        method: 'POST',
        url: `/api/v1/alerts/${id1}/acknowledge`,
        headers: authHeader(token),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/alerts/bulk-acknowledge',
        headers: authHeader(token),
        payload: { alert_ids: [id1, id2] },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['requested']).toBe(2);
      expect(data['acknowledged']).toBe(1); // Only the fresh one
    });
  });
});
