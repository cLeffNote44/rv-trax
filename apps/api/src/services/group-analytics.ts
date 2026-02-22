// ---------------------------------------------------------------------------
// RV Trax API — Group-level analytics service
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { dealerships, units, lots, trackers, gateways } from '@rv-trax/db';
import { eq, count, and, inArray, sum, isNotNull } from 'drizzle-orm';

// ── Types ------------------------------------------------------------------

export interface GroupAnalytics {
  totalDealerships: number;
  totalUnits: number;
  totalLots: number;
  totalSpots: number;
  totalTrackers: number;
  totalGateways: number;
  unitsByDealership: Array<{
    dealershipId: string;
    dealershipName: string;
    unitCount: number;
  }>;
  unitsByStatus: Record<string, number>;
  averageLotUtilization: number;
}

// ── Service ----------------------------------------------------------------

export async function getGroupAnalytics(
  db: Database,
  groupId: string,
): Promise<GroupAnalytics> {
  // 1. Get all dealership IDs in the group
  const groupDealerships = await db
    .select({ id: dealerships.id, name: dealerships.name })
    .from(dealerships)
    .where(eq(dealerships.groupId, groupId));

  const dealershipIds = groupDealerships.map((d) => d.id);
  const totalDealerships = groupDealerships.length;

  // Early return if no dealerships in group
  if (dealershipIds.length === 0) {
    return {
      totalDealerships: 0,
      totalUnits: 0,
      totalLots: 0,
      totalSpots: 0,
      totalTrackers: 0,
      totalGateways: 0,
      unitsByDealership: [],
      unitsByStatus: {},
      averageLotUtilization: 0,
    };
  }

  // 2. Count units across all group dealerships
  const [unitCountResult] = await db
    .select({ value: count() })
    .from(units)
    .where(inArray(units.dealershipId, dealershipIds));

  const totalUnits = unitCountResult?.value ?? 0;

  // 3. Count lots and sum totalSpots
  const [lotResult] = await db
    .select({
      lotCount: count(),
      spotSum: sum(lots.totalSpots),
    })
    .from(lots)
    .where(inArray(lots.dealershipId, dealershipIds));

  const totalLots = lotResult?.lotCount ?? 0;
  const totalSpots = parseInt(String(lotResult?.spotSum ?? '0'), 10);

  // 4. Count trackers
  const [trackerResult] = await db
    .select({ value: count() })
    .from(trackers)
    .where(inArray(trackers.dealershipId, dealershipIds));

  const totalTrackers = trackerResult?.value ?? 0;

  // 5. Count gateways
  const [gatewayResult] = await db
    .select({ value: count() })
    .from(gateways)
    .where(inArray(gateways.dealershipId, dealershipIds));

  const totalGateways = gatewayResult?.value ?? 0;

  // 6. Units by dealership
  const unitsByDealershipRows = await db
    .select({
      dealershipId: units.dealershipId,
      unitCount: count(),
    })
    .from(units)
    .where(inArray(units.dealershipId, dealershipIds))
    .groupBy(units.dealershipId);

  const dealershipNameMap = new Map(
    groupDealerships.map((d) => [d.id, d.name]),
  );

  const unitsByDealership = unitsByDealershipRows.map((row) => ({
    dealershipId: row.dealershipId,
    dealershipName: dealershipNameMap.get(row.dealershipId) ?? 'Unknown',
    unitCount: row.unitCount,
  }));

  // 7. Units by status
  const unitsByStatusRows = await db
    .select({
      status: units.status,
      cnt: count(),
    })
    .from(units)
    .where(inArray(units.dealershipId, dealershipIds))
    .groupBy(units.status);

  const unitsByStatus: Record<string, number> = {};
  for (const row of unitsByStatusRows) {
    unitsByStatus[row.status] = row.cnt;
  }

  // 8. Average lot utilization (units with a lotId / total spots)
  let averageLotUtilization = 0;
  if (totalSpots > 0) {
    const [unitsWithLotResult] = await db
      .select({ value: count() })
      .from(units)
      .where(
        and(
          inArray(units.dealershipId, dealershipIds),
          isNotNull(units.lotId),
        ),
      );

    const unitsWithLot = unitsWithLotResult?.value ?? 0;
    averageLotUtilization =
      Math.round((unitsWithLot / totalSpots) * 10000) / 100;
  }

  return {
    totalDealerships,
    totalUnits,
    totalLots,
    totalSpots,
    totalTrackers,
    totalGateways,
    unitsByDealership,
    unitsByStatus,
    averageLotUtilization,
  };
}
