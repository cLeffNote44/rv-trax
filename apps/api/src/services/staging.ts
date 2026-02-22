// ---------------------------------------------------------------------------
// RV Trax API — Staging rule evaluation engine
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { units, lotSpots, stagingAssignments } from '@rv-trax/db';
import { eq, and } from 'drizzle-orm';

// ── Types ------------------------------------------------------------------

export interface StagingRule {
  rule_type: string;
  target_rows: string[];
  target_spots?: string[];
  conditions: {
    unit_types?: string[];
    makes?: string[];
    min_price?: number;
    max_price?: number;
    statuses?: string[];
    min_year?: number;
    max_year?: number;
    unit_ids?: string[];
  };
  priority: number;
}

interface UnitRow {
  id: string;
  stockNumber: string;
  make: string | null;
  model: string | null;
  year: number | null;
  unitType: string | null;
  msrp: string | null;
  status: string;
  currentRow: string | null;
  currentSpot: number | null;
}

interface SpotRow {
  id: string;
  rowLabel: string;
  spotNumber: number;
  centerLat: string | null;
  centerLng: string | null;
}

export interface MoveItem {
  unitId: string;
  stockNumber: string;
  make: string;
  model: string;
  year: number;
  currentRow: string | null;
  currentSpot: number | null;
  currentLat: number | null;
  currentLng: number | null;
  targetRow: string;
  targetSpot: number;
  targetLat: number;
  targetLng: number;
  distanceM: number;
  priority: number;
}

// ── Haversine distance (meters) --------------------------------------------

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Rule matching ----------------------------------------------------------

function doesRuleMatch(rule: StagingRule, unit: UnitRow): boolean {
  const { conditions } = rule;

  switch (rule.rule_type) {
    case 'by_type': {
      if (!conditions.unit_types || conditions.unit_types.length === 0) return false;
      return unit.unitType !== null && conditions.unit_types.includes(unit.unitType);
    }

    case 'by_make': {
      if (!conditions.makes || conditions.makes.length === 0) return false;
      if (unit.make === null) return false;
      const unitMakeLower = unit.make.toLowerCase();
      return conditions.makes.some((m) => m.toLowerCase() === unitMakeLower);
    }

    case 'by_price_range': {
      if (unit.msrp === null) return false;
      const price = parseFloat(unit.msrp);
      if (isNaN(price)) return false;
      if (conditions.min_price !== undefined && price < conditions.min_price) return false;
      if (conditions.max_price !== undefined && price > conditions.max_price) return false;
      return true;
    }

    case 'by_status': {
      if (!conditions.statuses || conditions.statuses.length === 0) return false;
      return conditions.statuses.includes(unit.status);
    }

    case 'by_year': {
      if (unit.year === null) return false;
      if (conditions.min_year !== undefined && unit.year < conditions.min_year) return false;
      if (conditions.max_year !== undefined && unit.year > conditions.max_year) return false;
      return true;
    }

    case 'manual': {
      if (!conditions.unit_ids || conditions.unit_ids.length === 0) return false;
      return conditions.unit_ids.includes(unit.id);
    }

    default:
      return false;
  }
}

// ── Evaluate all rules for all units ---------------------------------------

export function evaluateRules(
  rules: StagingRule[],
  unitRows: UnitRow[],
): Map<string, { targetRows: string[]; priority: number }> {
  const result = new Map<string, { targetRows: string[]; priority: number }>();

  // Sort rules by priority ascending (lower number = higher priority)
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  for (const unit of unitRows) {
    for (const rule of sorted) {
      if (doesRuleMatch(rule, unit)) {
        // First matching rule wins (highest priority)
        if (!result.has(unit.id)) {
          result.set(unit.id, {
            targetRows: rule.target_rows,
            priority: rule.priority,
          });
        }
        break;
      }
    }
  }

  return result;
}

// ── Assign units to available spots ----------------------------------------

export function assignUnitsToSpots(
  unitAssignments: Map<string, { targetRows: string[]; priority: number }>,
  spots: SpotRow[],
): Map<string, SpotRow> {
  const result = new Map<string, SpotRow>();
  const usedSpotIds = new Set<string>();

  // Sort spots by row label then spot number for deterministic assignment
  const sortedSpots = [...spots].sort((a, b) => {
    const rowCmp = a.rowLabel.localeCompare(b.rowLabel);
    if (rowCmp !== 0) return rowCmp;
    return a.spotNumber - b.spotNumber;
  });

  // Sort unit entries by priority ascending (lower = higher priority)
  const entries = [...unitAssignments.entries()].sort(
    (a, b) => a[1].priority - b[1].priority,
  );

  for (const [unitId, assignment] of entries) {
    const targetRowSet = new Set(assignment.targetRows);

    // Find first available spot in the target rows
    const availableSpot = sortedSpots.find(
      (s) => targetRowSet.has(s.rowLabel) && !usedSpotIds.has(s.id),
    );

    if (availableSpot) {
      result.set(unitId, availableSpot);
      usedSpotIds.add(availableSpot.id);
    }
  }

  return result;
}

// ── Find the spot a unit is currently closest to ---------------------------

function findCurrentSpot(
  unit: UnitRow,
  spots: SpotRow[],
): SpotRow | null {
  // If unit has a currentRow and currentSpot, find the matching spot
  if (unit.currentRow !== null && unit.currentSpot !== null) {
    const match = spots.find(
      (s) => s.rowLabel === unit.currentRow && s.spotNumber === unit.currentSpot,
    );
    if (match) return match;
  }

  return null;
}

// ── Compute full move list -------------------------------------------------

export async function computeMoveList(
  db: Database,
  planId: string,
  lotId: string,
  dealershipId: string,
  rules: StagingRule[],
): Promise<MoveItem[]> {
  // Fetch all units in the lot belonging to this dealership
  const unitRows = await db
    .select({
      id: units.id,
      stockNumber: units.stockNumber,
      make: units.make,
      model: units.model,
      year: units.year,
      unitType: units.unitType,
      msrp: units.msrp,
      status: units.status,
      currentRow: units.currentRow,
      currentSpot: units.currentSpot,
    })
    .from(units)
    .where(
      and(
        eq(units.dealershipId, dealershipId),
        eq(units.lotId, lotId),
      ),
    );

  // Fetch all active spots for this lot
  const spotRows = await db
    .select({
      id: lotSpots.id,
      rowLabel: lotSpots.rowLabel,
      spotNumber: lotSpots.spotNumber,
      centerLat: lotSpots.centerLat,
      centerLng: lotSpots.centerLng,
    })
    .from(lotSpots)
    .where(
      and(
        eq(lotSpots.lotId, lotId),
        eq(lotSpots.isActive, true),
      ),
    );

  // Evaluate rules to determine target rows for each unit
  const unitAssignments = evaluateRules(rules, unitRows);

  // Assign units to specific spots
  const spotAssignments = assignUnitsToSpots(unitAssignments, spotRows);

  // Check for existing assignment records so we do not duplicate
  const existingAssignments = await db
    .select({
      unitId: stagingAssignments.unitId,
      status: stagingAssignments.status,
    })
    .from(stagingAssignments)
    .where(eq(stagingAssignments.planId, planId));

  const completedOrSkipped = new Set(
    existingAssignments
      .filter((a) => a.status === 'completed' || a.status === 'skipped')
      .map((a) => a.unitId),
  );

  // Build move list
  const moveList: MoveItem[] = [];

  for (const [unitId, targetSpot] of spotAssignments.entries()) {
    // Skip units that have already been completed or skipped
    if (completedOrSkipped.has(unitId)) continue;

    const unit = unitRows.find((u) => u.id === unitId);
    if (!unit) continue;

    const ruleAssignment = unitAssignments.get(unitId);
    if (!ruleAssignment) continue;

    const targetLat = targetSpot.centerLat !== null ? parseFloat(targetSpot.centerLat) : 0;
    const targetLng = targetSpot.centerLng !== null ? parseFloat(targetSpot.centerLng) : 0;

    // Determine current location from the unit's current spot
    let currentLat: number | null = null;
    let currentLng: number | null = null;

    const currentSpotRecord = findCurrentSpot(unit, spotRows);
    if (currentSpotRecord) {
      currentLat = currentSpotRecord.centerLat !== null
        ? parseFloat(currentSpotRecord.centerLat)
        : null;
      currentLng = currentSpotRecord.centerLng !== null
        ? parseFloat(currentSpotRecord.centerLng)
        : null;
    }

    // Skip if unit is already in the target spot
    if (
      unit.currentRow === targetSpot.rowLabel &&
      unit.currentSpot === targetSpot.spotNumber
    ) {
      continue;
    }

    // Compute distance
    let distanceM = 0;
    if (
      currentLat !== null &&
      currentLng !== null &&
      targetLat !== 0 &&
      targetLng !== 0
    ) {
      distanceM = haversineDistance(currentLat, currentLng, targetLat, targetLng);
    }

    moveList.push({
      unitId,
      stockNumber: unit.stockNumber,
      make: unit.make ?? '',
      model: unit.model ?? '',
      year: unit.year ?? 0,
      currentRow: unit.currentRow,
      currentSpot: unit.currentSpot,
      currentLat,
      currentLng,
      targetRow: targetSpot.rowLabel,
      targetSpot: targetSpot.spotNumber,
      targetLat,
      targetLng,
      distanceM: Math.round(distanceM * 100) / 100,
      priority: ruleAssignment.priority,
    });
  }

  // Sort: highest priority first (lower number), then shortest distance
  moveList.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.distanceM - b.distanceM;
  });

  return moveList;
}
