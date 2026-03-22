// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Recall routes (/api/v1/recalls/*)
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

describe('Recall Routes', () => {
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

  // ── POST /api/v1/recalls ─────────────────────────────────────────────────

  describe('POST /api/v1/recalls', () => {
    it('creates a recall successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(token),
        payload: {
          title: 'Test Recall',
          affected_makes: ['Jayco'],
          affected_year_start: 2024,
          affected_year_end: 2026,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['title']).toBe('Test Recall');
      expect(data['dealership_id']).toBe(dealershipId);
      expect(data['status']).toBe('open');
    });

    it('auto-counts matched units on creation', async () => {
      // Create a matching unit first
      await createTestUnit(app, dealershipId, {
        make: 'Jayco',
        year: 2025,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(token),
        payload: {
          title: 'Jayco Recall',
          affected_makes: ['Jayco'],
          affected_year_start: 2024,
          affected_year_end: 2026,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['matched_unit_count']).toBeGreaterThanOrEqual(1);
    });

    it('rejects creation without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        payload: {
          title: 'No Auth Recall',
          affected_makes: ['Jayco'],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('rejects creation with missing title', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(token),
        payload: {
          affected_makes: ['Jayco'],
        },
      });

      // Zod validation failure
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  // ── GET /api/v1/recalls ──────────────────────────────────────────────────

  describe('GET /api/v1/recalls', () => {
    it('lists recalls for the dealership', async () => {
      // Create two recalls
      await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(token),
        payload: { title: 'Recall A', affected_makes: ['Jayco'] },
      });
      await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(token),
        payload: { title: 'Recall B', affected_makes: ['Winnebago'] },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recalls',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as unknown[];
      expect(data.length).toBe(2);
    });

    it('returns paginated response', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(token),
        payload: { title: 'Recall X', affected_makes: ['Jayco'] },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recalls',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
    });
  });

  // ── GET /api/v1/recalls/:id ──────────────────────────────────────────────

  describe('GET /api/v1/recalls/:id', () => {
    it('returns recall detail with matched_units', async () => {
      await createTestUnit(app, dealershipId, { make: 'Jayco', year: 2025 });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(token),
        payload: {
          title: 'Detail Recall',
          affected_makes: ['Jayco'],
          affected_year_start: 2024,
          affected_year_end: 2026,
        },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const recallId = created['id'] as string;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/recalls/${recallId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(recallId);
      expect(data['title']).toBe('Detail Recall');
      expect(data).toHaveProperty('matched_units');
      const matchedUnits = data['matched_units'] as unknown[];
      expect(matchedUnits.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for non-existent recall', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/recalls/00000000-0000-0000-0000-000000000000',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ── POST /api/v1/recalls/:id/match ───────────────────────────────────────

  describe('POST /api/v1/recalls/:id/match', () => {
    it('runs matching algorithm and returns matched unit IDs', async () => {
      await createTestUnit(app, dealershipId, { make: 'Jayco', year: 2025 });
      await createTestUnit(app, dealershipId, { make: 'Winnebago', year: 2025 });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(token),
        payload: {
          title: 'Match Test Recall',
          affected_makes: ['Jayco'],
          affected_year_start: 2024,
          affected_year_end: 2026,
        },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const recallId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/recalls/${recallId}/match`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['matched_unit_count']).toBeGreaterThanOrEqual(1);
      expect(data).toHaveProperty('matched_unit_ids');
      const matchedIds = data['matched_unit_ids'] as string[];
      expect(matchedIds.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for non-existent recall', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/recalls/00000000-0000-0000-0000-000000000000/match',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 0 matched units when no inventory matches', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/recalls',
        headers: authHeader(token),
        payload: {
          title: 'No Match Recall',
          affected_makes: ['NonExistentBrand'],
          affected_year_start: 2024,
          affected_year_end: 2026,
        },
      });
      const created = (createRes.json() as Record<string, unknown>)['data'] as Record<string, unknown>;
      const recallId = created['id'] as string;

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/recalls/${recallId}/match`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['matched_unit_count']).toBe(0);
    });
  });
});
