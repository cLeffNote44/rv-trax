// ---------------------------------------------------------------------------
// RV Trax API — Unit routes (GET/POST/PATCH/DELETE /api/v1/units)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, asc, ilike, or, gt, isNull, count } from 'drizzle-orm';
import { units, trackerAssignments, trackers } from '@rv-trax/db';
import {
  createUnitSchema,
  updateUnitSchema,
  paginationSchema,
} from '@rv-trax/shared';
import { AuditAction } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, conflict, validationError, badRequest } from '../utils/errors.js';
import { canAddUnit, isRestricted, getBillingOverview } from '../services/billing.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';

export default async function unitRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — create unit ---------------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createUnitSchema.parse(request.body);

    // Enforce billing limits
    if (await isRestricted(app.db, app.redis, request.dealershipId)) {
      throw badRequest('Subscription is inactive. Please update your billing to continue.');
    }

    if (!(await canAddUnit(app.db, request.dealershipId))) {
      throw badRequest('Unit limit reached for your subscription tier. Please upgrade to add more units.');
    }

    // Check stock_number unique within dealership
    const existing = await app.db
      .select({ id: units.id })
      .from(units)
      .where(
        and(
          eq(units.dealershipId, request.dealershipId),
          eq(units.stockNumber, body.stock_number),
          isNull(units.archivedAt),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw conflict(`Stock number "${body.stock_number}" already exists in this dealership`);
    }

    const unit = await app.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(units)
        .values({
          dealershipId: request.dealershipId,
          stockNumber: body.stock_number,
          vin: body.vin ?? null,
          year: body.year,
          make: body.make,
          model: body.model,
          floorplan: body.floorplan ?? null,
          unitType: body.unit_type,
          lengthFt: body.length_ft?.toString() ?? null,
          msrp: body.msrp?.toString() ?? null,
          status: body.status,
        })
        .returning();

      await logAction(tx, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.CREATE,
        entityType: 'unit',
        entityId: u!.id,
        ipAddress: request.ip,
      });

      return u;
    });

    return reply.status(201).send({ data: unit });
  });

  // ── GET / — list units -----------------------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const { limit, cursor } = paginationSchema.parse(query);

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

    if (query['search']) {
      const term = `%${query['search']}%`;
      conditions.push(
        or(
          ilike(units.stockNumber, term),
          ilike(units.vin, term),
          ilike(units.make, term),
          ilike(units.model, term),
          ilike(units.floorplan, term),
        )!,
      );
    }

    if (cursor) {
      const decodedId = decodeCursor(cursor);
      conditions.push(gt(units.id, decodedId));
    }

    const where = and(...conditions);

    // Get total count
    const [countResult] = await app.db
      .select({ value: count() })
      .from(units)
      .where(where);

    const totalCount = countResult?.value ?? 0;

    // Determine sort
    const sortBy = query['sort_by'] ?? 'created_at';
    const sortDir = query['sort_dir'] === 'asc' ? asc : desc;

    const sortColumn = getSortColumn(sortBy);

    const rows = await app.db
      .select()
      .from(units)
      .where(where)
      .orderBy(sortDir(sortColumn))
      .limit(limit + 1);

    return reply.status(200).send(buildPaginatedResponse(rows, limit, totalCount));
  });

  // ── GET /:id — get single unit with tracker info ---------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [unit] = await app.db
      .select()
      .from(units)
      .where(
        and(
          eq(units.id, id),
          eq(units.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!unit) {
      throw notFound('Unit not found');
    }

    // Fetch active tracker assignment
    const activeAssignment = await app.db
      .select({
        assignment_id: trackerAssignments.id,
        tracker_id: trackerAssignments.trackerId,
        assigned_at: trackerAssignments.assignedAt,
        device_eui: trackers.deviceEui,
        label: trackers.label,
        battery_pct: trackers.batteryPct,
        tracker_status: trackers.status,
        last_seen_at: trackers.lastSeenAt,
      })
      .from(trackerAssignments)
      .innerJoin(trackers, eq(trackers.id, trackerAssignments.trackerId))
      .where(
        and(
          eq(trackerAssignments.unitId, id),
          isNull(trackerAssignments.unassignedAt),
        ),
      )
      .limit(1);

    return reply.status(200).send({
      data: {
        ...unit,
        tracker: activeAssignment[0] ?? null,
      },
    });
  });

  // ── PATCH /:id — update unit -----------------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateUnitSchema.parse(request.body);

    // Verify unit exists and belongs to dealership
    const [existing] = await app.db
      .select()
      .from(units)
      .where(
        and(
          eq(units.id, id),
          eq(units.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Unit not found');
    }

    // If stock_number is changing, check uniqueness
    if (body.stock_number && body.stock_number !== existing.stockNumber) {
      const dup = await app.db
        .select({ id: units.id })
        .from(units)
        .where(
          and(
            eq(units.dealershipId, request.dealershipId),
            eq(units.stockNumber, body.stock_number),
            isNull(units.archivedAt),
          ),
        )
        .limit(1);

      if (dup.length > 0) {
        throw conflict(`Stock number "${body.stock_number}" already exists`);
      }
    }

    // Build update object
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.stock_number !== undefined) updates['stockNumber'] = body.stock_number;
    if (body.vin !== undefined) updates['vin'] = body.vin;
    if (body.year !== undefined) updates['year'] = body.year;
    if (body.make !== undefined) updates['make'] = body.make;
    if (body.model !== undefined) updates['model'] = body.model;
    if (body.floorplan !== undefined) updates['floorplan'] = body.floorplan;
    if (body.unit_type !== undefined) updates['unitType'] = body.unit_type;
    if (body.length_ft !== undefined) updates['lengthFt'] = body.length_ft?.toString();
    if (body.msrp !== undefined) updates['msrp'] = body.msrp?.toString();
    if (body.status !== undefined) updates['status'] = body.status;

    const [updated] = await app.db
      .update(units)
      .set(updates)
      .where(eq(units.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'unit',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ data: updated });
  });

  // ── DELETE /:id — soft delete (archive) ------------------------------------

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: units.id })
      .from(units)
      .where(
        and(
          eq(units.id, id),
          eq(units.dealershipId, request.dealershipId),
          isNull(units.archivedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Unit not found');
    }

    await app.db
      .update(units)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(units.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.DELETE,
      entityType: 'unit',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ message: 'Unit archived successfully' });
  });

  // ── POST /import — CSV import ----------------------------------------------

  app.post('/import', async (request: FastifyRequest, reply: FastifyReply) => {
    const file = await request.file();

    if (!file) {
      throw validationError('CSV file is required');
    }

    const buffer = await file.toBuffer();
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw validationError('CSV must have a header row and at least one data row');
    }

    const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
    const results: { imported: number; errors: Array<{ row: number; message: string }> } = {
      imported: 0,
      errors: [],
    };

    const valuesToInsert: Array<typeof units.$inferInsert> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]!.split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? '';
      });

      try {
        const parsed = createUnitSchema.parse({
          stock_number: row['stock_number'],
          vin: row['vin'] || undefined,
          year: parseInt(row['year'] ?? '0', 10),
          make: row['make'],
          model: row['model'],
          floorplan: row['floorplan'] || undefined,
          unit_type: row['unit_type'],
          length_ft: row['length_ft'] ? parseFloat(row['length_ft']) : undefined,
          msrp: row['msrp'] ? parseFloat(row['msrp']) : undefined,
          status: row['status'] || undefined,
        });

        valuesToInsert.push({
          dealershipId: request.dealershipId,
          stockNumber: parsed.stock_number,
          vin: parsed.vin ?? null,
          year: parsed.year,
          make: parsed.make,
          model: parsed.model,
          floorplan: parsed.floorplan ?? null,
          unitType: parsed.unit_type,
          lengthFt: parsed.length_ft?.toString() ?? null,
          msrp: parsed.msrp?.toString() ?? null,
          status: parsed.status,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Validation failed';
        results.errors.push({ row: i + 1, message });
      }
    }

    // Bulk insert valid rows
    if (valuesToInsert.length > 0) {
      // Enforce billing limits before bulk insert
      if (await isRestricted(app.db, app.redis, request.dealershipId)) {
        throw badRequest('Subscription is inactive. Please update your billing to continue.');
      }

      const overview = await getBillingOverview(app.db, request.dealershipId);
      if (overview && (overview.unitCount + valuesToInsert.length) > overview.unitLimit) {
        throw badRequest(
          `Import would exceed unit limit (current: ${overview.unitCount}, importing: ${valuesToInsert.length}, limit: ${overview.unitLimit}). Please upgrade your plan.`,
        );
      }

      await app.db.insert(units).values(valuesToInsert);
      results.imported = valuesToInsert.length;
    }

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'unit',
      entityId: '00000000-0000-0000-0000-000000000000',
      changes: { imported: results.imported, errorCount: results.errors.length },
      ipAddress: request.ip,
    });

    return reply.status(200).send(results);
  });

  // ── GET /export — CSV export -----------------------------------------------

  app.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;

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
      .select()
      .from(units)
      .where(and(...conditions))
      .orderBy(asc(units.stockNumber));

    // Build CSV
    const csvHeaders = [
      'stock_number', 'vin', 'year', 'make', 'model', 'floorplan',
      'unit_type', 'length_ft', 'msrp', 'status',
    ];
    const csvLines = [csvHeaders.join(',')];

    for (const row of rows) {
      csvLines.push([
        escapeCsv(row.stockNumber),
        escapeCsv(row.vin ?? ''),
        String(row.year ?? ''),
        escapeCsv(row.make ?? ''),
        escapeCsv(row.model ?? ''),
        escapeCsv(row.floorplan ?? ''),
        row.unitType,
        row.lengthFt?.toString() ?? '',
        row.msrp?.toString() ?? '',
        row.status,
      ].join(','));
    }

    return reply
      .status(200)
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="units-export.csv"')
      .send(csvLines.join('\n'));
  });
}

// ── Helpers ------------------------------------------------------------------

function getSortColumn(sortBy: string) {
  switch (sortBy) {
    case 'stock_number': return units.stockNumber;
    case 'year': return units.year;
    case 'make': return units.make;
    case 'model': return units.model;
    case 'status': return units.status;
    case 'updated_at': return units.updatedAt;
    default: return units.createdAt;
  }
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
