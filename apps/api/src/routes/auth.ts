// ---------------------------------------------------------------------------
// RV Trax API — Auth routes (POST /api/v1/auth/*)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { dealerships, users, refreshTokens } from '@rv-trax/db';
import { loginSchema, registerSchema } from '@rv-trax/shared';
import { UserRole, AuditAction } from '@rv-trax/shared';
import { AppError, unauthorized, conflict, badRequest } from '../utils/errors.js';
import { logAction } from '../services/audit.js';
import crypto from 'node:crypto';

const SALT_ROUNDS = 12;
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /register --------------------------------------------------------

  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerSchema.parse(request.body);

    // Check if email already exists
    const existing = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw conflict('A user with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    // Create dealership
    const [dealership] = await app.db
      .insert(dealerships)
      .values({
        name: body.dealership_name,
        address: '',
        city: '',
        state: '',
        zip: '',
      })
      .returning();

    if (!dealership) {
      throw new AppError('Failed to create dealership', 500, 'INTERNAL_ERROR');
    }

    // Create owner user
    const [user] = await app.db
      .insert(users)
      .values({
        dealershipId: dealership.id,
        email: body.email.toLowerCase(),
        passwordHash,
        name: body.name,
        role: UserRole.OWNER,
      })
      .returning();

    if (!user) {
      throw new AppError('Failed to create user', 500, 'INTERNAL_ERROR');
    }

    // Issue tokens
    const accessToken = app.jwt.sign({
      sub: user.id,
      dealershipId: dealership.id,
      role: UserRole.OWNER,
    });

    const { cookie } = await createRefreshToken(app, user.id);

    // Audit
    await logAction(app.db, {
      dealershipId: dealership.id,
      userId: user.id,
      action: AuditAction.CREATE,
      entityType: 'dealership',
      entityId: dealership.id,
      ipAddress: request.ip,
    });

    reply.setCookie('refresh_token', cookie, refreshCookieOptions());
    reply.setCookie('rv-trax-token', accessToken, accessCookieOptions());

    return reply.status(201).send({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        dealership_id: dealership.id,
      },
    });
  });

  // ── POST /login ------------------------------------------------------------

  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '15 minutes',
          keyGenerator: (request: FastifyRequest) => {
            const body = request.body as { email?: string };
            return `${request.ip}:${body?.email ?? 'unknown'}`;
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = loginSchema.parse(request.body);

      // Find user by email
      const [user] = await app.db
        .select()
        .from(users)
        .where(eq(users.email, body.email.toLowerCase()))
        .limit(1);

      if (!user) {
        throw unauthorized('Invalid email or password');
      }

      if (!user.isActive) {
        throw unauthorized('Account is deactivated');
      }

      // Verify password
      const valid = await bcrypt.compare(body.password, user.passwordHash);
      if (!valid) {
        throw unauthorized('Invalid email or password');
      }

      // Update last login
      await app.db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));

      // Issue tokens
      const accessToken = app.jwt.sign({
        sub: user.id,
        dealershipId: user.dealershipId,
        role: user.role as UserRole,
      });

      const { cookie } = await createRefreshToken(app, user.id);

      // Audit
      await logAction(app.db, {
        dealershipId: user.dealershipId,
        userId: user.id,
        action: AuditAction.LOGIN,
        entityType: 'user',
        entityId: user.id,
        ipAddress: request.ip,
      });

      reply.setCookie('refresh_token', cookie, refreshCookieOptions());
      reply.setCookie('rv-trax-token', accessToken, accessCookieOptions());

      return reply.status(200).send({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 900,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          dealership_id: user.dealershipId,
        },
      });
    },
  );

  // ── POST /refresh ----------------------------------------------------------

  app.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawToken = (request.cookies as Record<string, string | undefined>)['refresh_token'];

    if (!rawToken) {
      throw unauthorized('No refresh token provided');
    }

    // Hash the incoming token and look up directly — O(1) instead of O(N) bcrypt
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const [matchedToken] = await app.db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
      .limit(1);

    if (!matchedToken) {
      throw unauthorized('Invalid refresh token');
    }

    if (new Date(matchedToken.expiresAt) < new Date()) {
      // Revoke expired token
      await app.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, matchedToken.id));
      throw unauthorized('Refresh token expired');
    }

    // Revoke old token (rotation)
    await app.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, matchedToken.id));

    // Fetch user
    const [user] = await app.db
      .select()
      .from(users)
      .where(eq(users.id, matchedToken.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw unauthorized('User not found or deactivated');
    }

    // Issue new tokens
    const accessToken = app.jwt.sign({
      sub: user.id,
      dealershipId: user.dealershipId,
      role: user.role as UserRole,
    });

    const { cookie } = await createRefreshToken(app, user.id);

    reply.setCookie('refresh_token', cookie, refreshCookieOptions());
    reply.setCookie('rv-trax-token', accessToken, accessCookieOptions());

    return reply.status(200).send({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900,
    });
  });

  // ── GET /me — return the current authenticated user -------------------------

  app.get(
    '/me',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user.sub;
      const dealershipId = request.user.dealershipId;

      const [user] = await app.db
        .select({
          id: users.id,
          dealershipId: users.dealershipId,
          email: users.email,
          name: users.name,
          role: users.role,
          avatarUrl: users.avatarUrl,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.dealershipId, dealershipId)))
        .limit(1);

      if (!user) {
        throw unauthorized('User not found');
      }

      return reply.status(200).send(user);
    },
  );

  // ── POST /logout -----------------------------------------------------------

  app.post(
    '/logout',
    {
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rawToken = (request.cookies as Record<string, string | undefined>)['refresh_token'];

      if (rawToken) {
        // Hash the incoming token and revoke by direct lookup
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        await app.db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(refreshTokens.userId, request.user.sub),
              eq(refreshTokens.tokenHash, tokenHash),
              isNull(refreshTokens.revokedAt),
            ),
          );
      }

      // Audit
      await logAction(app.db, {
        dealershipId: request.user.dealershipId,
        userId: request.user.sub,
        action: AuditAction.LOGOUT,
        entityType: 'user',
        entityId: request.user.sub,
        ipAddress: request.ip,
      });

      reply.clearCookie('refresh_token', refreshCookieOptions());
      reply.clearCookie('rv-trax-token', accessCookieOptions());

      return reply.status(200).send({ message: 'Logged out successfully' });
    },
  );

  // ── POST /forgot-password ---------------------------------------------------

  app.post(
    '/forgot-password',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '15 minutes',
          keyGenerator: (request: FastifyRequest) => request.ip,
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = z
        .object({
          email: z.string().email('Invalid email address'),
        })
        .parse(request.body);

      // Look up user — but always return 200 to avoid leaking email existence
      const [user] = await app.db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (user) {
        // Generate 32-byte token, store SHA-256 hash in Redis with 1h TTL
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        await app.redis.set(
          `password_reset:${tokenHash}`,
          JSON.stringify({ userId: user.id, email: user.email }),
          'EX',
          3600, // 1 hour
        );

        // Build reset URL and send email
        const webAppUrl = process.env['WEB_APP_URL'] ?? 'http://localhost:3001';
        const resetUrl = `${webAppUrl}/reset-password?token=${resetToken}`;

        const { sendEmail } = await import('../services/notifications/email.js');
        await sendEmail(
          user.email,
          'Reset your RV Trax password',
          `<!DOCTYPE html>
<html><body style="font-family:sans-serif;margin:0;padding:32px;background:#f3f4f6;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
  <h2 style="margin:0 0 16px;color:#111827;">Reset your password</h2>
  <p style="color:#4b5563;line-height:1.6;">Hi ${user.name},</p>
  <p style="color:#4b5563;line-height:1.6;">We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#1e3a5f;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a>
  </p>
  <p style="color:#9ca3af;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
</div>
</body></html>`,
        );
      }

      return reply.status(200).send({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    },
  );

  // ── POST /reset-password ---------------------------------------------------

  app.post('/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token, password } = z
      .object({
        token: z.string().min(1, 'Reset token is required'),
        password: z
          .string()
          .min(8, 'Password must be at least 8 characters')
          .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
          .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
          .regex(/[0-9]/, 'Password must contain at least one number'),
      })
      .parse(request.body);

    // Hash the incoming token and look up in Redis
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const stored = await app.redis.get(`password_reset:${tokenHash}`);

    if (!stored) {
      throw badRequest('Invalid or expired reset token');
    }

    // Delete token immediately (one-time use)
    await app.redis.del(`password_reset:${tokenHash}`);

    const { userId } = JSON.parse(stored) as { userId: string; email: string };

    // Hash new password and update user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await app.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Revoke all refresh tokens for this user (force re-login everywhere)
    await app.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));

    return reply.status(200).send({
      message: 'Password has been reset successfully.',
    });
  });
}

// ── Helpers ------------------------------------------------------------------

async function createRefreshToken(
  app: FastifyInstance,
  userId: string,
): Promise<{ refreshToken: string; cookie: string }> {
  const rawToken = crypto.randomBytes(48).toString('hex');
  // Use SHA-256 for token storage — enables O(1) lookup instead of O(N) bcrypt comparison
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await app.db.insert(refreshTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return { refreshToken: rawToken, cookie: rawToken };
}

function refreshCookieOptions() {
  return {
    path: '/api/v1/auth',
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax' as const,
    maxAge: REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  };
}

function accessCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax' as const,
    maxAge: 15 * 60, // 15 minutes — matches JWT expiry
  };
}
