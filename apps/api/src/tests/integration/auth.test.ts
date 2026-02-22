// ---------------------------------------------------------------------------
// RV Trax API — Integration tests: Auth routes (/api/v1/auth/*)
// ---------------------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getTestApp, closeTestApp } from '../helpers/setup.js';
import { generateToken, authHeader } from '../helpers/auth.js';
import { createTestDealership, createTestUser } from '../helpers/factories.js';
import { cleanDatabase } from '../helpers/cleanup.js';

describe('Auth Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase(app);
  });

  // ── POST /api/v1/auth/register ─────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and dealership, returns access_token and user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'newowner@example.com',
          password: 'TestPassword1!',
          name: 'Jane Doe',
          dealership_name: 'Doe RV Sales',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('token_type', 'Bearer');
      expect(body).toHaveProperty('expires_in', 900);
      expect(body).toHaveProperty('user');

      const user = body['user'] as Record<string, unknown>;
      expect(user['email']).toBe('newowner@example.com');
      expect(user['name']).toBe('Jane Doe');
      expect(user['role']).toBe('owner');
      expect(user).toHaveProperty('dealership_id');
      expect(typeof user['id']).toBe('string');
    });

    it('rejects duplicate email with 409', async () => {
      // Register the first user
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@example.com',
          password: 'TestPassword1!',
          name: 'First User',
          dealership_name: 'First Dealership',
        },
      });

      // Attempt to register again with the same email
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'duplicate@example.com',
          password: 'TestPassword1!',
          name: 'Second User',
          dealership_name: 'Second Dealership',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json() as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('CONFLICT');
    });

    it('rejects invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'TestPassword1!',
          name: 'Bad Email',
          dealership_name: 'Some Dealership',
        },
      });

      // Zod validation errors are caught by the error handler
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
    });
  });

  // ── POST /api/v1/auth/login ────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    const testEmail = 'logintest@example.com';
    const testPassword = 'TestPassword1!';

    beforeEach(async () => {
      // Register a user to login with
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: testEmail,
          password: testPassword,
          name: 'Login Test User',
          dealership_name: 'Login Test Dealership',
        },
      });
    });

    it('logs in with valid credentials, returns access_token and user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testEmail,
          password: testPassword,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json() as Record<string, unknown>;
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('token_type', 'Bearer');
      expect(body).toHaveProperty('expires_in', 900);

      const user = body['user'] as Record<string, unknown>;
      expect(user['email']).toBe(testEmail);
      expect(user['name']).toBe('Login Test User');
      expect(user['role']).toBe('owner');
    });

    it('rejects wrong password with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: testEmail,
          password: 'WrongPassword1!',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('UNAUTHORIZED');
    });

    it('rejects non-existent email with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'nobody@example.com',
          password: 'TestPassword1!',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json() as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('UNAUTHORIZED');
    });
  });

  // ── POST /api/v1/auth/refresh ──────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it.skip('requires cookie manipulation which is not practical in inject-based tests', () => {
      // Refresh token flow relies on httpOnly cookies set by the server.
      // Testing this properly would require extracting the Set-Cookie header
      // and replaying it, which is fragile across bcrypt-hashed cookie values.
      // This flow should be tested via an e2e test runner (e.g., Playwright).
    });
  });

  // ── POST /api/v1/auth/logout ───────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('logs out successfully with a valid token', async () => {
      const dealership = await createTestDealership(app);
      const user = await createTestUser(app, dealership.id, 'owner');
      const token = generateToken(app, {
        id: user.id,
        dealershipId: dealership.id,
        role: user.role,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body['message']).toBe('Logged out successfully');
    });

    it('rejects logout without auth token with 401', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
