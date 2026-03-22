// ---------------------------------------------------------------------------
// RV Trax API — Lot routes (GET/POST/PATCH /api/v1/lots)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { lots, lotSpots } from '@rv-trax/db';
import { createLotSchema } from '@rv-trax/shared';
import { AuditAction } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, validationError, badRequest } from '../utils/errors.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { logAction } from '../services/audit.js';
import { z } from 'zod';

// ── Lot-specific schemas ----------------------------------------------------

const updateLotSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  boundary: z.array(z.tuple([z.number(), z.number()])).min(3).optional(),
});

const spotDefinitionSchema = z.object({
  row_label: z.string().min(1),
  spot_number: z.number().int().positive(),
  center_lat: z.number().min(-90).max(90),
  center_lng: z.number().min(-180).max(180),
  spot_type: z.enum(['standard', 'wide', 'pull_through', 'display']).default('standard'),
  width_ft: z.number().positive().optional(),
  depth_ft: z.number().positive().optional(),
});

const gridSchema = z.array(spotDefinitionSchema).min(1);

export default async function lotRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — create lot ----------------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createLotSchema.parse(request.body);

    const [lot] = await app.db
      .insert(lots)
      .values({
        dealershipId: request.dealershipId,
        name: body.name,
        address: body.address ?? null,
        boundary: JSON.stringify(body.boundary),
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'lot',
      entityId: lot!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: lot });
  });

  // ── GET / — list lots for dealership ---------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select()
      .from(lots)
      .where(eq(lots.dealershipId, request.dealershipId))
      .orderBy(lots.name);

    return reply.status(200).send({ data: rows });
  });

  // ── PATCH /:id — update lot ------------------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateLotSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(lots)
      .where(
        and(
          eq(lots.id, id),
          eq(lots.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Lot not found');
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates['name'] = body.name;
    if (body.address !== undefined) updates['address'] = body.address;
    if (body.boundary !== undefined) {
      updates['boundary'] = JSON.stringify(body.boundary);
    }

    const [updated] = await app.db
      .update(lots)
      .set(updates)
      .where(eq(lots.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'lot',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ data: updated });
  });

  // ── POST /:id/grid — define lot grid (upsert spots) -----------------------

  app.post('/:id/grid', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const spots = gridSchema.parse(request.body);

    // Verify lot exists and belongs to dealership
    const [lot] = await app.db
      .select({ id: lots.id })
      .from(lots)
      .where(
        and(
          eq(lots.id, id),
          eq(lots.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!lot) {
      throw notFound('Lot not found');
    }

    // Upsert spots: delete existing and re-insert for simplicity
    await app.db.delete(lotSpots).where(eq(lotSpots.lotId, id));

    const spotValues = spots.map((s) => ({
      lotId: id,
      rowLabel: s.row_label,
      spotNumber: s.spot_number,
      spotType: s.spot_type,
      centerLat: s.center_lat.toString(),
      centerLng: s.center_lng.toString(),
      widthFt: s.width_ft?.toString() ?? null,
      depthFt: s.depth_ft?.toString() ?? null,
    }));

    await app.db.insert(lotSpots).values(spotValues);

    // Update total spots count on the lot
    await app.db
      .update(lots)
      .set({ totalSpots: spots.length, updatedAt: new Date() })
      .where(eq(lots.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'lot',
      entityId: id,
      changes: { grid_spots: spots.length },
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      message: `${spots.length} spots defined successfully`,
      spot_count: spots.length,
    });
  });

  // ── GET /:id/grid — get all spots for a lot --------------------------------

  app.get('/:id/grid', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    // Verify lot exists and belongs to dealership
    const [lot] = await app.db
      .select({ id: lots.id })
      .from(lots)
      .where(
        and(
          eq(lots.id, id),
          eq(lots.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!lot) {
      throw notFound('Lot not found');
    }

    const spots = await app.db
      .select()
      .from(lotSpots)
      .where(eq(lotSpots.lotId, id))
      .orderBy(lotSpots.rowLabel, lotSpots.spotNumber);

    return reply.status(200).send({ data: spots });
  });

  // ── POST /:id/map — upload lot map image (placeholder) ---------------------

  app.post('/:id/map', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    // Verify lot exists and belongs to dealership
    const [lot] = await app.db
      .select({ id: lots.id })
      .from(lots)
      .where(
        and(
          eq(lots.id, id),
          eq(lots.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!lot) {
      throw notFound('Lot not found');
    }

    const file = await request.file();
    if (!file) {
      throw validationError('Map image file is required');
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw badRequest('Map image must be PNG, JPEG, or WebP');
    }

    const buffer = await file.toBuffer();

    // Enforce 10MB file size limit
    if (buffer.length > 10 * 1024 * 1024) {
      throw badRequest('Map image must be smaller than 10MB');
    }

    // Validate file extension against allowlist
    const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
    const rawExt = (file.filename.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z]/g, '');
    const ext = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : 'png';
    const filename = `lot-${id}-map-${Date.now()}.${ext}`;

    // Write file to local uploads directory (swap with S3 in production)
    const uploadsDir = join(process.cwd(), 'uploads', 'lots');
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(join(uploadsDir, filename), buffer);

    const mapUrl = `/uploads/lots/${filename}`;

    // Save URL to lot record
    await app.db
      .update(lots)
      .set({ mapImageUrl: mapUrl, updatedAt: new Date() })
      .where(eq(lots.id, id));

    app.log.info({ lotId: id, filename }, 'Lot map uploaded');

    return reply.status(201).send({
      data: {
        url: mapUrl,
        filename,
      },
    });
  });
}
