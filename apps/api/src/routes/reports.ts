// ---------------------------------------------------------------------------
// RV Trax API — Report management routes (CRUD + generation)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { scheduledReports, type Database } from '@rv-trax/db';
import {
  createScheduledReportSchema,
  AuditAction,
  ReportType,
  ReportFormat,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { logAction } from '../services/audit.js';
import {
  getInventoryAnalytics,
  getLotUtilization,
  getMovementAnalytics,
  getStagingEffectiveness,
} from '../services/analytics.js';
import { z } from 'zod';

// ── Local schemas ----------------------------------------------------------

const updateReportSchema = z.object({
  schedule: z.enum(['daily', 'weekly', 'monthly'] as const).optional(),
  recipients: z.array(z.string().email()).min(1).optional(),
  is_active: z.boolean().optional(),
  format: z.enum(['csv', 'pdf', 'json'] as const).optional(),
});

const reportTypeValues = Object.values(ReportType) as [string, ...string[]];

const generateQuerySchema = z.object({
  format: z.enum(['csv', 'pdf', 'json'] as const).default('json'),
  from: z.string().optional(),
  to: z.string().optional(),
  lot_id: z.string().uuid().optional(),
});

// ── Helpers ----------------------------------------------------------------

function computeNextRunAt(schedule: string): Date {
  const now = new Date();

  switch (schedule) {
    case 'daily': {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(6, 0, 0, 0);
      return next;
    }
    case 'weekly': {
      const next = new Date(now);
      // Next Monday
      const dayOfWeek = next.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      next.setDate(next.getDate() + daysUntilMonday);
      next.setHours(6, 0, 0, 0);
      return next;
    }
    case 'monthly': {
      const next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(6, 0, 0, 0);
      return next;
    }
    default: {
      const fallback = new Date(now);
      fallback.setDate(fallback.getDate() + 1);
      fallback.setHours(6, 0, 0, 0);
      return fallback;
    }
  }
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyticsToCSV(data: any, reportType: string): string {
  const lines: string[] = [];

  switch (reportType) {
    case ReportType.INVENTORY_SUMMARY: {
      lines.push('metric,value');
      lines.push(`total_units,${data.total_units ?? 0}`);
      lines.push(`average_age_days,${data.average_age_days ?? 0}`);
      lines.push(`stock_turn_rate,${data.stock_turn_rate ?? 0}`);
      lines.push('');
      lines.push('type,count');
      const byType = (data.by_type ?? {}) as Record<string, number>;
      for (const [key, val] of Object.entries(byType)) {
        lines.push(`${escapeCsv(key)},${val}`);
      }
      lines.push('');
      lines.push('status,count');
      const byStatus = (data.by_status ?? {}) as Record<string, number>;
      for (const [key, val] of Object.entries(byStatus)) {
        lines.push(`${escapeCsv(key)},${val}`);
      }
      lines.push('');
      lines.push('aging_bucket,count');
      const buckets = (data.aging_buckets ?? {}) as Record<string, number>;
      for (const [key, val] of Object.entries(buckets)) {
        lines.push(`${key},${val}`);
      }
      break;
    }
    case ReportType.LOT_UTILIZATION: {
      lines.push('lot_id,lot_name,total_spots,occupied_spots,utilization_pct');
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        lines.push(
          [
            item.lot_id ?? '',
            escapeCsv(item.lot_name ?? ''),
            item.total_spots ?? 0,
            item.occupied_spots ?? 0,
            item.utilization_pct ?? 0,
          ].join(','),
        );
      }
      break;
    }
    case ReportType.MOVEMENT_REPORT: {
      lines.push('unit_id,stock_number,move_count');
      const movedUnits = (data.most_moved_units ?? []) as Array<{
        unit_id: string;
        stock_number: string;
        move_count: number;
      }>;
      for (const u of movedUnits) {
        lines.push(`${u.unit_id},${escapeCsv(u.stock_number)},${u.move_count}`);
      }
      lines.push('');
      lines.push('date,move_count');
      const byDay = (data.moves_by_day ?? []) as Array<{
        date: string;
        count: number;
      }>;
      for (const d of byDay) {
        lines.push(`${d.date},${d.count}`);
      }
      break;
    }
    case ReportType.STAGING_COMPLIANCE: {
      lines.push('date,score_pct,total_tracked,in_correct_zone');
      const trend = (data.compliance_trend ?? []) as Array<{
        date: string;
        score_pct: number;
        total_tracked: number;
        in_correct_zone: number;
      }>;
      for (const row of trend) {
        lines.push(
          `${row.date},${row.score_pct},${row.total_tracked},${row.in_correct_zone}`,
        );
      }
      break;
    }
    case ReportType.AGING_REPORT: {
      lines.push('aging_bucket,count');
      const aging = (data.aging_buckets ?? {}) as Record<string, number>;
      for (const [key, val] of Object.entries(aging)) {
        lines.push(`${key},${val}`);
      }
      lines.push('');
      lines.push(`average_age_days,${data.average_age_days ?? 0}`);
      break;
    }
    default:
      lines.push('No CSV format defined for this report type');
  }

  return lines.join('\n');
}

async function generateReportData(
  db: Database,
  dealershipId: string,
  reportType: string,
  from?: string,
  to?: string,
  lotId?: string,
): Promise<unknown> {
  switch (reportType) {
    case ReportType.INVENTORY_SUMMARY:
      return getInventoryAnalytics(db, dealershipId, from, to);
    case ReportType.AGING_REPORT:
      return getInventoryAnalytics(db, dealershipId, from, to);
    case ReportType.MOVEMENT_REPORT:
      return getMovementAnalytics(db, dealershipId, from, to);
    case ReportType.STAGING_COMPLIANCE:
      return getStagingEffectiveness(db, dealershipId, from, to);
    case ReportType.LOT_UTILIZATION:
      return getLotUtilization(db, dealershipId, lotId);
    default:
      throw badRequest(`Unknown report type: ${reportType}`);
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function reportRoutes(
  app: FastifyInstance,
): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — create scheduled report --------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createScheduledReportSchema.parse(request.body);

    const nextRunAt = computeNextRunAt(body.schedule);

    const [report] = await app.db
      .insert(scheduledReports)
      .values({
        dealershipId: request.dealershipId,
        reportType: body.report_type,
        format: body.format,
        schedule: body.schedule,
        recipients: body.recipients.join(','),
        isActive: true,
        nextRunAt,
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'scheduled_report',
      entityId: report!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      data: {
        ...report,
        recipients: report!.recipients.split(','),
      },
    });
  });

  // ── GET / — list scheduled reports ----------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select()
      .from(scheduledReports)
      .where(eq(scheduledReports.dealershipId, request.dealershipId))
      .orderBy(scheduledReports.createdAt);

    const data = rows.map((r) => ({
      ...r,
      recipients: r.recipients.split(','),
    }));

    return reply.status(200).send({ data });
  });

  // ── GET /:id — get report detail ------------------------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [report] = await app.db
      .select()
      .from(scheduledReports)
      .where(
        and(
          eq(scheduledReports.id, id),
          eq(scheduledReports.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!report) {
      throw notFound('Scheduled report not found');
    }

    return reply.status(200).send({
      data: {
        ...report,
        recipients: report.recipients.split(','),
      },
    });
  });

  // ── PATCH /:id — update report --------------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateReportSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(scheduledReports)
      .where(
        and(
          eq(scheduledReports.id, id),
          eq(scheduledReports.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Scheduled report not found');
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.schedule !== undefined) {
      updates['schedule'] = body.schedule;
      updates['nextRunAt'] = computeNextRunAt(body.schedule);
    }
    if (body.recipients !== undefined) {
      updates['recipients'] = body.recipients.join(',');
    }
    if (body.is_active !== undefined) {
      updates['isActive'] = body.is_active;
    }
    if (body.format !== undefined) {
      updates['format'] = body.format;
    }

    const [updated] = await app.db
      .update(scheduledReports)
      .set(updates)
      .where(eq(scheduledReports.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'scheduled_report',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({
      data: {
        ...updated,
        recipients: updated!.recipients.split(','),
      },
    });
  });

  // ── DELETE /:id — delete scheduled report ---------------------------------

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: scheduledReports.id })
      .from(scheduledReports)
      .where(
        and(
          eq(scheduledReports.id, id),
          eq(scheduledReports.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Scheduled report not found');
    }

    await app.db
      .delete(scheduledReports)
      .where(eq(scheduledReports.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.DELETE,
      entityType: 'scheduled_report',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply
      .status(200)
      .send({ message: 'Scheduled report deleted successfully' });
  });

  // ── POST /:id/run — manually trigger a report generation -----------------

  app.post(
    '/:id/run',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const [report] = await app.db
        .select()
        .from(scheduledReports)
        .where(
          and(
            eq(scheduledReports.id, id),
            eq(scheduledReports.dealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!report) {
        throw notFound('Scheduled report not found');
      }

      // Generate the report data
      const reportData = await generateReportData(
        app.db,
        request.dealershipId,
        report.reportType,
      );

      // Update lastRunAt and nextRunAt
      const nextRunAt = computeNextRunAt(report.schedule);
      await app.db
        .update(scheduledReports)
        .set({
          lastRunAt: new Date(),
          nextRunAt,
          updatedAt: new Date(),
        })
        .where(eq(scheduledReports.id, id));

      // Return based on format
      if (report.format === ReportFormat.PDF) {
        throw badRequest('PDF format is not yet supported. Please use CSV or JSON format.');
      }

      if (report.format === ReportFormat.CSV) {
        const csv = analyticsToCSV(reportData, report.reportType);
        return reply
          .status(200)
          .header('Content-Type', 'text/csv')
          .header(
            'Content-Disposition',
            `attachment; filename="${report.reportType}-${new Date().toISOString().slice(0, 10)}.csv"`,
          )
          .send(csv);
      }

      // JSON format
      return reply.status(200).send({ data: reportData });
    },
  );

  // ── GET /generate/:type — generate a one-off report ----------------------

  app.get(
    '/generate/:type',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { type } = request.params as { type: string };
      const query = generateQuerySchema.parse(request.query);

      // Validate report type
      if (!reportTypeValues.includes(type)) {
        throw badRequest(
          `Invalid report type: ${type}. Valid types: ${reportTypeValues.join(', ')}`,
        );
      }

      const reportData = await generateReportData(
        app.db,
        request.dealershipId,
        type,
        query.from,
        query.to,
        query.lot_id,
      );

      // Return based on requested format
      if (query.format === 'pdf') {
        throw badRequest('PDF format is not yet supported. Please use CSV or JSON format.');
      }

      if (query.format === 'csv') {
        const csv = analyticsToCSV(reportData, type);
        return reply
          .status(200)
          .header('Content-Type', 'text/csv')
          .header(
            'Content-Disposition',
            `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
          )
          .send(csv);
      }

      // JSON format
      return reply.status(200).send({ data: reportData });
    },
  );
}
