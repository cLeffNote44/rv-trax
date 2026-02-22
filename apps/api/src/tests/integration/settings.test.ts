// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Settings routes (/api/v1/settings/*)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Settings Routes', () => {
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

  // ── GET /api/v1/settings ─────────────────────────────────────────────────

  describe('GET /api/v1/settings', () => {
    it('returns dealership settings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(dealershipId);
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('address');
      expect(data).toHaveProperty('city');
      expect(data).toHaveProperty('state');
      expect(data).toHaveProperty('zip');
      expect(data).toHaveProperty('timezone');
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── PATCH /api/v1/settings ───────────────────────────────────────────────

  describe('PATCH /api/v1/settings', () => {
    it('updates dealership settings (name, timezone)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        headers: authHeader(token),
        payload: {
          name: 'Updated Dealership Name',
          timezone: 'America/Chicago',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Updated Dealership Name');
      expect(data['timezone']).toBe('America/Chicago');
    });

    it('updates address fields', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        headers: authHeader(token),
        payload: {
          address: '456 New Ave',
          city: 'Austin',
          state: 'TX',
          zip: '78702',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['address']).toBe('456 New Ave');
      expect(data['city']).toBe('Austin');
    });

    it('rejects update from non-owner/manager role', async () => {
      const viewer = await createTestUser(app, dealershipId, 'viewer');
      const viewerToken = generateToken(app, {
        id: viewer.id,
        dealershipId,
        role: 'viewer',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        headers: authHeader(viewerToken),
        payload: { name: 'Unauthorized Change' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings',
        payload: { name: 'No Auth' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── GET /api/v1/settings/feature-flags ───────────────────────────────────

  describe('GET /api/v1/settings/feature-flags', () => {
    it('returns empty list initially', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/feature-flags',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data).toHaveLength(0);
    });

    it('lists feature flags after setting some', async () => {
      // Set a feature flag first
      await app.inject({
        method: 'POST',
        url: '/api/v1/settings/feature-flags',
        headers: authHeader(token),
        payload: { feature: 'staging', enabled: true },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/settings/feature-flags',
        headers: authHeader(token),
        payload: { feature: 'analytics', enabled: false },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/feature-flags',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Array<Record<string, unknown>>;
      expect(data).toHaveLength(2);

      // Verify structure
      const staging = data.find((f) => f['feature'] === 'staging');
      expect(staging).toBeDefined();
      expect(staging!['enabled']).toBe(true);
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/feature-flags',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  // ── POST /api/v1/settings/feature-flags ──────────────────────────────────

  describe('POST /api/v1/settings/feature-flags', () => {
    it('sets a new feature flag', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/feature-flags',
        headers: authHeader(token),
        payload: { feature: 'geofencing', enabled: true },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['feature']).toBe('geofencing');
      expect(data['enabled']).toBe(true);
    });

    it('updates an existing feature flag', async () => {
      // Create
      await app.inject({
        method: 'POST',
        url: '/api/v1/settings/feature-flags',
        headers: authHeader(token),
        payload: { feature: 'staging', enabled: true },
      });

      // Update
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/feature-flags',
        headers: authHeader(token),
        payload: { feature: 'staging', enabled: false },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['feature']).toBe('staging');
      expect(data['enabled']).toBe(false);
    });

    it('rejects from non-owner role', async () => {
      const manager = await createTestUser(app, dealershipId, 'manager');
      const managerToken = generateToken(app, {
        id: manager.id,
        dealershipId,
        role: 'manager',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/feature-flags',
        headers: authHeader(managerToken),
        payload: { feature: 'staging', enabled: true },
      });

      // Feature flags require owner role
      expect(response.statusCode).toBe(403);
    });

    it('requires auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/settings/feature-flags',
        payload: { feature: 'staging', enabled: true },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
