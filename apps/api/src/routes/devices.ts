// ---------------------------------------------------------------------------
// RV Trax API — Device token routes (POST /api/v1/devices/register, DELETE)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { deviceTokens } from '@rv-trax/db';
import { registerDeviceTokenSchema } from '@rv-trax/shared';

export default async function deviceRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth
  app.addHook('preHandler', app.authenticate);

  // ── POST /register — register or refresh a device push token ────────────

  app.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerDeviceTokenSchema.parse(request.body);
    const userId = request.user.sub;

    // Deactivate any previous tokens for this user on this platform
    await app.db
      .update(deviceTokens)
      .set({ isActive: false })
      .where(
        and(
          eq(deviceTokens.userId, userId),
          eq(deviceTokens.platform, body.platform),
        ),
      );

    // Insert the new token
    const [row] = await app.db
      .insert(deviceTokens)
      .values({
        userId,
        token: body.token,
        platform: body.platform,
      })
      .returning({ id: deviceTokens.id });

    return reply.status(201).send({ data: { id: row!.id } });
  });

  // ── DELETE /unregister — deactivate device token on logout ──────────────

  app.delete('/unregister', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.sub;

    await app.db
      .update(deviceTokens)
      .set({ isActive: false })
      .where(eq(deviceTokens.userId, userId));

    return reply.status(204).send();
  });
}
