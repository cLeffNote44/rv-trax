// ---------------------------------------------------------------------------
// RV Trax API — Pricing Suggestions Service
//
// Computes automated pricing suggestions based on aging, market comparison,
// seasonal factors, and unit status context.
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { units } from '@rv-trax/db';
import { eq, and, sql, isNotNull } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PricingSuggestion {
  unit_id: string;
  stock_number: string;
  current_msrp: number | null;
  suggested_price: number;
  discount_pct: number;
  reasoning: string[];
  confidence: 'high' | 'medium' | 'low';
  market_avg: number | null;
  days_on_lot: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Statuses where price reductions are inappropriate. */
const SKIP_STATUSES = new Set(['hold', 'deposit', 'sold', 'delivered', 'archived']);

/** Minimum days on lot before a unit is considered "aging". */
const AGING_THRESHOLD_DAYS = 60;

/** Aging discount: -2% per 30 days after the first 30 days, max -15%. */
const AGING_GRACE_PERIOD_DAYS = 30;
const AGING_DISCOUNT_PER_30_DAYS = 0.02;
const AGING_DISCOUNT_MAX = 0.15;

/** Minimum comparable units needed for a "high confidence" market comparison. */
const HIGH_CONFIDENCE_COMPARABLES = 5;

/** Seasonal adjustment months (1-indexed). */
const PEAK_MONTHS = new Set([4, 5, 6, 7, 8]); // Apr-Aug
const OFF_MONTHS = new Set([11, 12, 1, 2]); // Nov-Feb
const PEAK_ADJUSTMENT = 0.03; // +3%
const OFF_ADJUSTMENT = -0.03; // -3%

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeDaysOnLot(arrivedAt: Date | null): number {
  if (!arrivedAt) return 0;
  const now = new Date();
  const diffMs = now.getTime() - arrivedAt.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getSeasonalFactor(): { adjustment: number; label: string | null } {
  const month = new Date().getMonth() + 1; // 1-indexed
  if (PEAK_MONTHS.has(month)) {
    return { adjustment: PEAK_ADJUSTMENT, label: `Peak season (month ${month}) +3%` };
  }
  if (OFF_MONTHS.has(month)) {
    return { adjustment: OFF_ADJUSTMENT, label: `Off season (month ${month}) -3%` };
  }
  return { adjustment: 0, label: null };
}

function computeAgingDiscount(daysOnLot: number): { discount: number; label: string | null } {
  if (daysOnLot <= AGING_GRACE_PERIOD_DAYS) {
    return { discount: 0, label: null };
  }

  const periodsOverGrace = Math.floor((daysOnLot - AGING_GRACE_PERIOD_DAYS) / 30);
  const rawDiscount = periodsOverGrace * AGING_DISCOUNT_PER_30_DAYS;
  const discount = Math.min(rawDiscount, AGING_DISCOUNT_MAX);

  if (discount === 0) return { discount: 0, label: null };

  return {
    discount,
    label: `${daysOnLot} days on lot (-${(discount * 100).toFixed(0)}%)`,
  };
}

// ---------------------------------------------------------------------------
// Market comparison query
// ---------------------------------------------------------------------------

interface MarketData {
  /** Average MSRP of comparables. */
  avg_msrp: number;
  /** Number of comparable units found. */
  comparable_count: number;
}

async function getMarketComparison(
  db: Database,
  dealershipId: string,
  make: string | null,
  model: string | null,
  year: number | null,
): Promise<MarketData | null> {
  if (!make || !model || !year) return null;

  const rows = await db
    .select({
      avgMsrp: sql<string>`AVG(${units.msrp}::numeric)`,
      cnt: sql<number>`COUNT(*)::int`,
    })
    .from(units)
    .where(
      and(
        eq(units.dealershipId, dealershipId),
        eq(units.make, make),
        eq(units.model, model),
        eq(units.year, year),
        isNotNull(units.msrp),
        sql`${units.status} NOT IN ('sold', 'delivered', 'archived')`,
      ),
    );

  const row = rows[0];
  if (!row || row.cnt === 0 || !row.avgMsrp) return null;

  return {
    avg_msrp: Math.round(parseFloat(row.avgMsrp)),
    comparable_count: row.cnt,
  };
}

// ---------------------------------------------------------------------------
// Compute suggestion for a single unit
// ---------------------------------------------------------------------------

interface UnitRow {
  id: string;
  stockNumber: string;
  msrp: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  status: string;
  arrivedAt: Date | null;
}

async function computeForUnit(
  db: Database,
  dealershipId: string,
  unit: UnitRow,
): Promise<PricingSuggestion | null> {
  // Skip units in protected statuses
  if (SKIP_STATUSES.has(unit.status)) return null;

  const msrp = unit.msrp ? parseFloat(unit.msrp) : null;
  const daysOnLot = computeDaysOnLot(unit.arrivedAt);
  const reasoning: string[] = [];

  // --- Base price ---
  let basePrice = msrp;

  // --- Market comparison ---
  const market = await getMarketComparison(db, dealershipId, unit.make, unit.model, unit.year);

  let marketAvg: number | null = null;
  let marketAdjustment = 0;

  if (market && market.comparable_count >= HIGH_CONFIDENCE_COMPARABLES && msrp) {
    marketAvg = market.avg_msrp;
    const diff = msrp - marketAvg;
    const diffPct = diff / msrp;

    if (Math.abs(diffPct) > 0.02) {
      // Unit priced above market → suggest lowering; below market → suggest raising
      if (diffPct > 0) {
        marketAdjustment = -Math.min(diffPct * 0.5, 0.05); // discount up to 5%
        reasoning.push(
          `Above market avg for ${unit.year} ${unit.make} ${unit.model} (${formatCurrency(marketAvg)}) ${(marketAdjustment * 100).toFixed(1)}%`,
        );
      } else {
        marketAdjustment = Math.min(Math.abs(diffPct) * 0.5, 0.03); // premium up to 3%
        reasoning.push(
          `Below market avg for ${unit.year} ${unit.make} ${unit.model} (${formatCurrency(marketAvg)}) +${(marketAdjustment * 100).toFixed(1)}%`,
        );
      }
    }
  } else if (market) {
    marketAvg = market.avg_msrp;
  }

  // If no MSRP, use market avg as base
  if (!basePrice && marketAvg) {
    basePrice = marketAvg;
    reasoning.push(`No MSRP — using market avg ${formatCurrency(marketAvg)} as base`);
  }

  // If still no base price, we can't compute a suggestion
  if (!basePrice) return null;

  // --- Aging discount ---
  const aging = computeAgingDiscount(daysOnLot);
  if (aging.label) reasoning.push(aging.label);

  // --- Seasonal adjustment ---
  const season = getSeasonalFactor();
  if (season.label) reasoning.push(season.label);

  // --- Calculate final price ---
  const totalAdjustment = -aging.discount + marketAdjustment + season.adjustment;
  const suggestedPrice = Math.round(basePrice * (1 + totalAdjustment));
  const discountPct =
    msrp && msrp > 0 ? Math.round(((msrp - suggestedPrice) / msrp) * 10000) / 100 : 0;

  // --- Confidence ---
  let confidence: 'high' | 'medium' | 'low';
  if (msrp && market && market.comparable_count >= HIGH_CONFIDENCE_COMPARABLES) {
    confidence = 'high';
  } else if (msrp) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  if (reasoning.length === 0) {
    reasoning.push('No adjustments needed — priced appropriately');
  }

  return {
    unit_id: unit.id,
    stock_number: unit.stockNumber,
    current_msrp: msrp,
    suggested_price: Math.max(suggestedPrice, 0),
    discount_pct: Math.max(discountPct, 0),
    reasoning,
    confidence,
    market_avg: marketAvg,
    days_on_lot: daysOnLot,
  };
}

// ---------------------------------------------------------------------------
// Format helper
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute pricing suggestions for one or all aging units in a dealership.
 *
 * @param db - Drizzle database instance
 * @param dealershipId - Tenant dealership ID
 * @param unitId - Optional single unit ID. If omitted, returns suggestions for
 *                 all aging units (>60 days on lot).
 */
export async function computePricingSuggestions(
  db: Database,
  dealershipId: string,
  unitId?: string,
): Promise<PricingSuggestion[]> {
  // Build query conditions
  const conditions = [
    eq(units.dealershipId, dealershipId),
    sql`${units.status} NOT IN ('sold', 'delivered', 'archived', 'hold', 'deposit')`,
  ];

  if (unitId) {
    conditions.push(eq(units.id, unitId));
  } else {
    // Only fetch units older than the aging threshold
    conditions.push(
      sql`${units.arrivedAt} <= NOW() - INTERVAL '${sql.raw(String(AGING_THRESHOLD_DAYS))} days'`,
    );
  }

  const rows = await db
    .select({
      id: units.id,
      stockNumber: units.stockNumber,
      msrp: units.msrp,
      make: units.make,
      model: units.model,
      year: units.year,
      status: units.status,
      arrivedAt: units.arrivedAt,
    })
    .from(units)
    .where(and(...conditions));

  const suggestions: PricingSuggestion[] = [];

  for (const row of rows) {
    const suggestion = await computeForUnit(db, dealershipId, row);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  // Sort by discount percentage descending (biggest opportunities first)
  suggestions.sort((a, b) => b.discount_pct - a.discount_pct);

  return suggestions;
}
