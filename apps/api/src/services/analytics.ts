// ---------------------------------------------------------------------------
// RV Trax API — Analytics service
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import {
  units,
  lots,
  movementEvents,
  complianceSnapshots,
  stagingPlans,
} from '@rv-trax/db';
import { eq, and, count, sql, gte, lte, desc, isNotNull } from 'drizzle-orm';
import type {
  InventoryAnalytics,
  LotUtilization,
  MovementAnalytics,
} from '@rv-trax/shared';

// ── Helpers ----------------------------------------------------------------

const ACTIVE_FILTER = sql`${units.status} NOT IN ('sold', 'delivered', 'archived')`;

function toDateOrUndefined(val: string | undefined): Date | undefined {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
}

// ── 1. Inventory Analytics -------------------------------------------------

export async function getInventoryAnalytics(
  db: Database,
  dealershipId: string,
  from?: string,
  to?: string,
): Promise<InventoryAnalytics> {
  const fromDate = toDateOrUndefined(from);
  const toDate = toDateOrUndefined(to);

  // --- by_type ---
  const typeGroups = await db
    .select({ unitType: units.unitType, cnt: count() })
    .from(units)
    .where(and(eq(units.dealershipId, dealershipId), ACTIVE_FILTER))
    .groupBy(units.unitType);

  const by_type: Record<string, number> = {};
  for (const row of typeGroups) {
    if (row.unitType) by_type[row.unitType] = row.cnt;
  }

  // --- by_status ---
  const statusGroups = await db
    .select({ status: units.status, cnt: count() })
    .from(units)
    .where(eq(units.dealershipId, dealershipId))
    .groupBy(units.status);

  const by_status: Record<string, number> = {};
  for (const row of statusGroups) {
    if (row.status) by_status[row.status] = row.cnt;
  }

  // --- by_make ---
  const makeGroups = await db
    .select({ make: units.make, cnt: count() })
    .from(units)
    .where(and(eq(units.dealershipId, dealershipId), ACTIVE_FILTER))
    .groupBy(units.make);

  const by_make: Record<string, number> = {};
  for (const row of makeGroups) {
    if (row.make) by_make[row.make] = row.cnt;
  }

  // --- aging_buckets ---
  const agingRows = await db
    .select({
      bucket: sql<string>`
        CASE
          WHEN EXTRACT(EPOCH FROM now() - ${units.arrivedAt}) / 86400 <= 30 THEN '0_30'
          WHEN EXTRACT(EPOCH FROM now() - ${units.arrivedAt}) / 86400 <= 60 THEN '31_60'
          WHEN EXTRACT(EPOCH FROM now() - ${units.arrivedAt}) / 86400 <= 90 THEN '61_90'
          WHEN EXTRACT(EPOCH FROM now() - ${units.arrivedAt}) / 86400 <= 120 THEN '91_120'
          ELSE '120_plus'
        END
      `.as('bucket'),
      cnt: count(),
    })
    .from(units)
    .where(and(eq(units.dealershipId, dealershipId), ACTIVE_FILTER))
    .groupBy(sql`bucket`);

  const aging_buckets = {
    '0_30': 0,
    '31_60': 0,
    '61_90': 0,
    '91_120': 0,
    '120_plus': 0,
  } as InventoryAnalytics['aging_buckets'];

  for (const row of agingRows) {
    const key = row.bucket as keyof typeof aging_buckets | undefined;
    if (key && key in aging_buckets) {
      aging_buckets[key] = row.cnt;
    }
  }

  // --- total_units ---
  const [totalRow] = await db
    .select({ cnt: count() })
    .from(units)
    .where(and(eq(units.dealershipId, dealershipId), ACTIVE_FILTER));

  const total_units = totalRow?.cnt ?? 0;

  // --- average_age_days ---
  const [avgRow] = await db
    .select({
      avgDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM now() - ${units.arrivedAt}) / 86400), 0)`.as('avg_days'),
    })
    .from(units)
    .where(and(eq(units.dealershipId, dealershipId), ACTIVE_FILTER));

  const average_age_days = Math.round((avgRow?.avgDays ?? 0) * 10) / 10;

  // --- stock_turn_rate ---
  let soldCount = 0;
  if (fromDate && toDate) {
    const [soldRow] = await db
      .select({ cnt: count() })
      .from(units)
      .where(
        and(
          eq(units.dealershipId, dealershipId),
          isNotNull(units.soldAt),
          gte(units.soldAt, fromDate),
          lte(units.soldAt, toDate),
        ),
      );
    soldCount = soldRow?.cnt ?? 0;
  } else {
    const [soldRow] = await db
      .select({ cnt: count() })
      .from(units)
      .where(
        and(
          eq(units.dealershipId, dealershipId),
          isNotNull(units.soldAt),
        ),
      );
    soldCount = soldRow?.cnt ?? 0;
  }

  const stock_turn_rate =
    total_units > 0 ? Math.round((soldCount / total_units) * 100) / 100 : 0;

  return {
    by_type,
    by_status,
    by_make,
    aging_buckets,
    total_units,
    average_age_days,
    stock_turn_rate,
  };
}

// ── 2. Lot Utilization ----------------------------------------------------

export async function getLotUtilization(
  db: Database,
  dealershipId: string,
  lotId?: string,
): Promise<LotUtilization[]> {
  // Fetch lots
  const lotConditions = [eq(lots.dealershipId, dealershipId)];
  if (lotId) {
    lotConditions.push(eq(lots.id, lotId));
  }

  const lotRows = await db
    .select({
      id: lots.id,
      name: lots.name,
      totalSpots: lots.totalSpots,
    })
    .from(lots)
    .where(and(...lotConditions));

  const results: LotUtilization[] = [];

  for (const lot of lotRows) {
    // Count occupied units (not sold/archived) in this lot
    const [occupiedRow] = await db
      .select({ cnt: count() })
      .from(units)
      .where(
        and(
          eq(units.dealershipId, dealershipId),
          eq(units.lotId, lot.id),
          ACTIVE_FILTER,
        ),
      );

    const occupied = occupiedRow?.cnt ?? 0;
    const total = lot.totalSpots ?? 0;
    const utilization_pct =
      total > 0 ? Math.round((occupied / total) * 10000) / 100 : 0;

    // Zone breakdown
    const zoneRows = await db
      .select({
        zone: units.currentZone,
        cnt: count(),
      })
      .from(units)
      .where(
        and(
          eq(units.dealershipId, dealershipId),
          eq(units.lotId, lot.id),
          ACTIVE_FILTER,
        ),
      )
      .groupBy(units.currentZone);

    const by_zone: LotUtilization['by_zone'] = [];
    for (const zr of zoneRows) {
      const zoneName = zr.zone ?? 'unassigned';
      by_zone.push({
        zone: zoneName,
        total: zr.cnt,
        occupied: zr.cnt,
        pct: total > 0 ? Math.round((zr.cnt / total) * 10000) / 100 : 0,
      });
    }

    results.push({
      lot_id: lot.id,
      lot_name: lot.name,
      total_spots: total,
      occupied_spots: occupied,
      utilization_pct,
      by_zone,
    });
  }

  return results;
}

// ── 3. Movement Analytics --------------------------------------------------

export async function getMovementAnalytics(
  db: Database,
  dealershipId: string,
  from?: string,
  to?: string,
): Promise<MovementAnalytics> {
  const fromDate = toDateOrUndefined(from);
  const toDate = toDateOrUndefined(to);

  // Build date conditions for movementEvents
  const dateConditions = [eq(movementEvents.dealershipId, dealershipId)];
  if (fromDate) {
    dateConditions.push(gte(movementEvents.occurredAt, fromDate));
  }
  if (toDate) {
    dateConditions.push(lte(movementEvents.occurredAt, toDate));
  }

  // --- most_moved_units (top 10) ---
  const movedRows = await db
    .select({
      unitId: movementEvents.unitId,
      moveCount: count(),
    })
    .from(movementEvents)
    .where(and(...dateConditions))
    .groupBy(movementEvents.unitId)
    .orderBy(desc(count()))
    .limit(10);

  const most_moved_units: MovementAnalytics['most_moved_units'] = [];
  for (const row of movedRows) {
    if (!row.unitId) continue;
    const [unitRow] = await db
      .select({ stockNumber: units.stockNumber })
      .from(units)
      .where(eq(units.id, row.unitId))
      .limit(1);
    most_moved_units.push({
      unit_id: row.unitId,
      stock_number: unitRow?.stockNumber ?? 'unknown',
      move_count: row.moveCount,
    });
  }

  // --- moves_by_day ---
  const dayRows = await db
    .select({
      date: sql<string>`TO_CHAR(${movementEvents.occurredAt}, 'YYYY-MM-DD')`.as('move_date'),
      cnt: count(),
    })
    .from(movementEvents)
    .where(and(...dateConditions))
    .groupBy(sql`move_date`)
    .orderBy(sql`move_date`);

  const moves_by_day: MovementAnalytics['moves_by_day'] = dayRows.map((r) => ({
    date: r.date ?? '',
    count: r.cnt,
  }));

  // --- idle_units (no movement in 60+ days) ---
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const idleRows = await db
    .select({
      unitId: units.id,
      stockNumber: units.stockNumber,
      lastMoved: sql<string | null>`MAX(${movementEvents.occurredAt})`.as('last_moved'),
    })
    .from(units)
    .leftJoin(movementEvents, eq(movementEvents.unitId, units.id))
    .where(and(eq(units.dealershipId, dealershipId), ACTIVE_FILTER))
    .groupBy(units.id, units.stockNumber)
    .having(
      sql`MAX(${movementEvents.occurredAt}) IS NULL OR MAX(${movementEvents.occurredAt}) < ${sixtyDaysAgo}`,
    );

  const idle_units: MovementAnalytics['idle_units'] = idleRows.map((r) => {
    let daysIdle = 60;
    if (r.lastMoved) {
      const lastDate = new Date(r.lastMoved);
      daysIdle = Math.round(
        (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
    return {
      unit_id: r.unitId,
      stock_number: r.stockNumber,
      days_idle: daysIdle,
    };
  });

  // --- average_moves_before_sale ---
  const [avgMovesRow] = await db
    .select({
      avgMoves: sql<number>`COALESCE(AVG(move_counts.cnt), 0)`.as('avg_moves'),
    })
    .from(
      sql`(
        SELECT ${movementEvents.unitId}, COUNT(*)::int as cnt
        FROM ${movementEvents}
        INNER JOIN ${units} ON ${units.id} = ${movementEvents.unitId}
        WHERE ${units.dealershipId} = ${dealershipId}
          AND ${units.soldAt} IS NOT NULL
        GROUP BY ${movementEvents.unitId}
      ) AS move_counts`,
    );

  const average_moves_before_sale =
    Math.round((avgMovesRow?.avgMoves ?? 0) * 10) / 10;

  return {
    most_moved_units,
    moves_by_day,
    idle_units,
    average_moves_before_sale,
  };
}

// ── 4. Staging Effectiveness -----------------------------------------------

export interface StagingEffectiveness {
  compliance_trend: Array<{
    date: string;
    score_pct: number;
    total_tracked: number;
    in_correct_zone: number;
  }>;
  plan_summaries: Array<{
    plan_id: string;
    plan_name: string;
    is_active: boolean;
    units_sold_while_active: number;
  }>;
}

export async function getStagingEffectiveness(
  db: Database,
  dealershipId: string,
  from?: string,
  to?: string,
): Promise<StagingEffectiveness> {
  const fromDate = toDateOrUndefined(from);
  const toDate = toDateOrUndefined(to);

  // --- compliance_trend ---
  const complianceConditions = [
    eq(complianceSnapshots.dealershipId, dealershipId),
  ];
  if (fromDate) {
    complianceConditions.push(gte(complianceSnapshots.snapshotAt, fromDate));
  }
  if (toDate) {
    complianceConditions.push(lte(complianceSnapshots.snapshotAt, toDate));
  }

  const complianceRows = await db
    .select({
      date: sql<string>`TO_CHAR(${complianceSnapshots.snapshotAt}, 'YYYY-MM-DD')`.as('snapshot_date'),
      scorePct: sql<number>`AVG(${complianceSnapshots.scorePct}::numeric)`.as('avg_score'),
      totalTracked: sql<number>`SUM(${complianceSnapshots.totalTracked})`.as('total_tracked'),
      inCorrectZone: sql<number>`SUM(${complianceSnapshots.inCorrectZone})`.as('in_correct'),
    })
    .from(complianceSnapshots)
    .where(and(...complianceConditions))
    .groupBy(sql`snapshot_date`)
    .orderBy(sql`snapshot_date`);

  const compliance_trend: StagingEffectiveness['compliance_trend'] =
    complianceRows.map((r) => ({
      date: r.date ?? '',
      score_pct: Math.round((r.scorePct ?? 0) * 100) / 100,
      total_tracked: r.totalTracked ?? 0,
      in_correct_zone: r.inCorrectZone ?? 0,
    }));

  // --- plan_summaries ---
  const planRows = await db
    .select({
      id: stagingPlans.id,
      name: stagingPlans.name,
      isActive: stagingPlans.isActive,
      activatedAt: stagingPlans.activatedAt,
      lotId: stagingPlans.lotId,
    })
    .from(stagingPlans)
    .where(eq(stagingPlans.dealershipId, dealershipId));

  const plan_summaries: StagingEffectiveness['plan_summaries'] = [];

  for (const plan of planRows) {
    // Count units sold while plan was active (units in the plan's lot that were
    // sold after the plan was activated)
    let soldCount = 0;
    if (plan.activatedAt && plan.lotId) {
      const soldConditions = [
        eq(units.dealershipId, dealershipId),
        eq(units.lotId, plan.lotId),
        isNotNull(units.soldAt),
        gte(units.soldAt, plan.activatedAt),
      ];
      if (fromDate) {
        soldConditions.push(gte(units.soldAt, fromDate));
      }
      if (toDate) {
        soldConditions.push(lte(units.soldAt, toDate));
      }

      const [soldRow] = await db
        .select({ cnt: count() })
        .from(units)
        .where(and(...soldConditions));

      soldCount = soldRow?.cnt ?? 0;
    }

    plan_summaries.push({
      plan_id: plan.id,
      plan_name: plan.name,
      is_active: plan.isActive,
      units_sold_while_active: soldCount,
    });
  }

  return {
    compliance_trend,
    plan_summaries,
  };
}
