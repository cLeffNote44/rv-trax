// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Gateway routes (/api/v1/gateways)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

const validGateway = {
  gateway_eui: 'AA555A0000000001',
  name: 'Front Lot Gateway',
  backhaul_type: 'ethernet',
  latitude: 30.0,
  longitude: -97.0,
};

describe('Gateway Routes', () => {
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

  /** Helper: creates a gateway via the API and returns the response data */
  async function createGateway(overrides: Partial<typeof validGateway> = {}): Promise<Record<string, unknown>> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/gateways',
      headers: authHeader(token),
      payload: { ...validGateway, ...overrides },
    });
    const body = res.json() as Record<string, unknown>;
    return body['data'] as Record<string, unknown>;
  }

  // ── POST /api/v1/gateways ─────────────────────────────────────────────────

  describe('POST /api/v1/gateways', () => {
    it('creates a gateway and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/gateways',
        headers: authHeader(token),
        payload: validGateway,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['gateway_eui']).toBe(validGateway.gateway_eui);
      expect(data['name']).toBe(validGateway.name);
      expect(data['dealership_id']).toBe(dealershipId);
    });

    it('rejects with 400 when gateway_eui is missing', async () => {
      const { gateway_eui, ...noEui } = validGateway;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/gateways',
        headers: authHeader(token),
        payload: noEui,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ── GET /api/v1/gateways ──────────────────────────────────────────────────

  describe('GET /api/v1/gateways', () => {
    it('lists gateways and returns 200', async () => {
      await createGateway({ gateway_eui: 'AA555A0000000002', name: 'GW 1' });
      await createGateway({ gateway_eui: 'AA555A0000000003', name: 'GW 2' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/gateways',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(2);
    });
  });

  // ── GET /api/v1/gateways/:id ──────────────────────────────────────────────

  describe('GET /api/v1/gateways/:id', () => {
    it('returns gateway detail', async () => {
      const gw = await createGateway();
      const gwId = gw['id'] as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/gateways/${gwId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(gwId);
      expect(data['gateway_eui']).toBe(validGateway.gateway_eui);
    });
  });

  // ── PATCH /api/v1/gateways/:id ────────────────────────────────────────────

  describe('PATCH /api/v1/gateways/:id', () => {
    it('updates a gateway and returns 200', async () => {
      const gw = await createGateway();
      const gwId = gw['id'] as string;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/gateways/${gwId}`,
        headers: authHeader(token),
        payload: { name: 'Renamed Gateway' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Renamed Gateway');
    });
  });

  // ── DELETE /api/v1/gateways/:id ───────────────────────────────────────────

  describe('DELETE /api/v1/gateways/:id', () => {
    it('removes a gateway and returns 200', async () => {
      const gw = await createGateway();
      const gwId = gw['id'] as string;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/gateways/${gwId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/v1/gateways/${gwId}`,
        headers: authHeader(token),
      });

      expect(getRes.statusCode).toBe(404);
    });
  });
});
