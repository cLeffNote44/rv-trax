// ---------------------------------------------------------------------------
// RV Trax API — Public API routes (API-key authenticated, read-only)
// Prefix: /api/public/v1
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ilike, isNull, desc } from 'drizzle-orm';
import { apiKeys, units, trackers, geoFences, lots } from '@rv-trax/db';
import { unauthorized, AppError } from '../utils/errors.js';
import crypto from 'node:crypto';

// ── API key auth middleware --------------------------------------------------

async function authenticateApiKey(
  this: FastifyInstance,
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer rvtrax_')) {
    throw unauthorized('Missing or invalid API key');
  }

  const rawKey = authHeader.slice(7); // Remove "Bearer " prefix
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const app = this;

  const [key] = await app.db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (!key) {
    throw unauthorized('Invalid API key');
  }

  if (!key.isActive) {
    throw unauthorized('API key is inactive');
  }

  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    throw unauthorized('API key has expired');
  }

  // Set dealershipId from the key
  request.dealershipId = key.dealershipId;

  // Update lastUsedAt (fire-and-forget)
  app.db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id))
    .then(() => {/* no-op */})
    .catch(() => {/* best effort */});

  // Rate limit via Redis
  const rateLimitKey = `api_rate:${key.id}`;
  const currentCount = await app.redis.incr(rateLimitKey);

  if (currentCount === 1) {
    // Set expiry on first request in the window
    await app.redis.expire(rateLimitKey, 60);
  }

  if (currentCount > key.rateLimitPerMin) {
    throw new AppError('Rate limit exceeded', 429, 'RATE_LIMITED');
  }
}

// ── Route registration -------------------------------------------------------

export default async function publicApiRoutes(app: FastifyInstance): Promise<void> {
  // All routes authenticated via API key
  app.addHook('preHandler', authenticateApiKey.bind(app));

  // ── GET /units — list units for dealership --------------------------------

  app.get('/units', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(query['limit'] ?? '50', 10) || 50, 100);
    const offset = parseInt(query['offset'] ?? '0', 10) || 0;

    const conditions = [
      eq(units.dealershipId, request.dealershipId),
      isNull(units.archivedAt),
    ];

    if (query['status']) {
      conditions.push(eq(units.status, query['status']));
    }

    if (query['unit_type']) {
      conditions.push(eq(units.unitType, query['unit_type']));
    }

    if (query['make']) {
      conditions.push(ilike(units.make, query['make']));
    }

    const rows = await app.db
      .select({
        id: units.id,
        stock_number: units.stockNumber,
        vin: units.vin,
        year: units.year,
        make: units.make,
        model: units.model,
        unit_type: units.unitType,
        msrp: units.msrp,
        status: units.status,
        lot_id: units.lotId,
        current_zone: units.currentZone,
        current_row: units.currentRow,
        created_at: units.createdAt,
        updated_at: units.updatedAt,
      })
      .from(units)
      .where(and(...conditions))
      .orderBy(desc(units.createdAt))
      .limit(limit)
      .offset(offset);

    return reply.status(200).send({ data: rows });
  });

  // ── GET /units/:id — single unit detail -----------------------------------

  app.get('/units/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [unit] = await app.db
      .select({
        id: units.id,
        stock_number: units.stockNumber,
        vin: units.vin,
        year: units.year,
        make: units.make,
        model: units.model,
        unit_type: units.unitType,
        msrp: units.msrp,
        status: units.status,
        lot_id: units.lotId,
        current_zone: units.currentZone,
        current_row: units.currentRow,
        created_at: units.createdAt,
        updated_at: units.updatedAt,
      })
      .from(units)
      .where(
        and(
          eq(units.id, id),
          eq(units.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!unit) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Unit not found' },
      });
    }

    return reply.status(200).send({ data: unit });
  });

  // ── GET /trackers — list trackers -----------------------------------------

  app.get('/trackers', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(query['limit'] ?? '50', 10) || 50, 100);
    const offset = parseInt(query['offset'] ?? '0', 10) || 0;

    const rows = await app.db
      .select({
        id: trackers.id,
        device_eui: trackers.deviceEui,
        label: trackers.label,
        status: trackers.status,
        battery_pct: trackers.batteryPct,
        last_latitude: trackers.lastLatitude,
        last_longitude: trackers.lastLongitude,
        last_seen_at: trackers.lastSeenAt,
        created_at: trackers.createdAt,
      })
      .from(trackers)
      .where(eq(trackers.dealershipId, request.dealershipId))
      .orderBy(desc(trackers.createdAt))
      .limit(limit)
      .offset(offset);

    return reply.status(200).send({ data: rows });
  });

  // ── GET /locations/latest — latest positions for all units ----------------

  app.get('/locations/latest', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select({
        unit_id: units.id,
        stock_number: units.stockNumber,
        make: units.make,
        model: units.model,
        status: units.status,
        lot_id: units.lotId,
        current_zone: units.currentZone,
        current_row: units.currentRow,
        current_spot: units.currentSpot,
        updated_at: units.updatedAt,
      })
      .from(units)
      .where(
        and(
          eq(units.dealershipId, request.dealershipId),
          isNull(units.archivedAt),
        ),
      )
      .orderBy(units.stockNumber);

    return reply.status(200).send({ data: rows });
  });

  // ── GET /geofences — list geo-fences --------------------------------------

  app.get('/geofences', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select({
        id: geoFences.id,
        lot_id: geoFences.lotId,
        name: geoFences.name,
        fence_type: geoFences.fenceType,
        boundary: geoFences.boundary,
        is_active: geoFences.isActive,
        created_at: geoFences.createdAt,
      })
      .from(geoFences)
      .where(
        and(
          eq(geoFences.dealershipId, request.dealershipId),
          isNull(geoFences.deletedAt),
        ),
      )
      .orderBy(geoFences.createdAt);

    return reply.status(200).send({ data: rows });
  });

  // ── GET /lots — list lots --------------------------------------------------

  app.get('/lots', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select({
        id: lots.id,
        name: lots.name,
        address: lots.address,
        total_spots: lots.totalSpots,
        created_at: lots.createdAt,
      })
      .from(lots)
      .where(eq(lots.dealershipId, request.dealershipId))
      .orderBy(lots.name);

    return reply.status(200).send({ data: rows });
  });
}
