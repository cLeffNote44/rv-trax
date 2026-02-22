// ---------------------------------------------------------------------------
// RV Trax API — Database & Redis plugin
// ---------------------------------------------------------------------------

import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createDb, type Database } from '@rv-trax/db';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    redis: Redis;
  }
}

async function dbPlugin(fastify: FastifyInstance): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

  // Create Drizzle DB instance
  const { db, client } = createDb(databaseUrl);

  // Create Redis instance
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redis.connect();

  fastify.decorate('db', db);
  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing database connection...');
    await client.end();
    fastify.log.info('Closing Redis connection...');
    await redis.quit();
  });

  fastify.log.info('Database and Redis connections established');
}

export default fp(dbPlugin, {
  name: 'db',
});
