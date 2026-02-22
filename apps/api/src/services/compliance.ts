// ---------------------------------------------------------------------------
// RV Trax API — Compliance scoring service
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { units, stagingPlans, complianceSnapshots } from '@rv-trax/db';
import { eq, and } from 'drizzle-orm';
import { evaluateRules } from './staging.js';
import type { StagingRule } from './staging.js';

// ── Types ------------------------------------------------------------------

interface OutOfPlaceUnit {
  unitId: string;
  stockNumber: string;
  expectedRow: string;
  actualRow: string | null;
}

export interface ComplianceResult {
  totalTracked: number;
  inCorrectZone: number;
  scorePct: number;
  outOfPlace: OutOfPlaceUnit[];
}

// ── Compute compliance score -----------------------------------------------

export async function computeComplianceScore(
  db: Database,
  lotId: string,
  dealershipId: string,
): Promise<ComplianceResult> {
  // Find the active staging plan for this lot
  const [activePlan] = await db
    .select({
      id: stagingPlans.id,
      rules: stagingPlans.rules,
    })
    .from(stagingPlans)
    .where(
      and(
        eq(stagingPlans.lotId, lotId),
        eq(stagingPlans.dealershipId, dealershipId),
        eq(stagingPlans.isActive, true),
      ),
    )
    .limit(1);

  // If no active plan, return perfect score with 0 tracked
  if (!activePlan) {
    return {
      totalTracked: 0,
      inCorrectZone: 0,
      scorePct: 100,
      outOfPlace: [],
    };
  }

  const rules = (activePlan.rules ?? []) as StagingRule[];

  // Fetch all units in this lot for this dealership
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

  // Evaluate rules to find expected target rows for each unit
  const assignments = evaluateRules(rules, unitRows);

  // Count how many units have a rule assignment (tracked)
  let totalTracked = 0;
  let inCorrectZone = 0;
  const outOfPlace: OutOfPlaceUnit[] = [];

  for (const unit of unitRows) {
    const assignment = assignments.get(unit.id);
    if (!assignment) continue; // No rule applies to this unit

    totalTracked++;

    // Check if the unit's current row is in the expected target rows
    const isInCorrectRow =
      unit.currentRow !== null && assignment.targetRows.includes(unit.currentRow);

    if (isInCorrectRow) {
      inCorrectZone++;
    } else {
      // Pick the first target row as the expected row for reporting
      const firstTargetRow = assignment.targetRows[0];
      outOfPlace.push({
        unitId: unit.id,
        stockNumber: unit.stockNumber,
        expectedRow: firstTargetRow ?? 'unknown',
        actualRow: unit.currentRow,
      });
    }
  }

  const scorePct = totalTracked > 0
    ? Math.round((inCorrectZone / totalTracked) * 10000) / 100
    : 100;

  return {
    totalTracked,
    inCorrectZone,
    scorePct,
    outOfPlace,
  };
}

// ── Snapshot compliance to DB ----------------------------------------------

export async function snapshotCompliance(
  db: Database,
  lotId: string,
  dealershipId: string,
): Promise<void> {
  const score = await computeComplianceScore(db, lotId, dealershipId);

  await db.insert(complianceSnapshots).values({
    lotId,
    dealershipId,
    totalTracked: score.totalTracked,
    inCorrectZone: score.inCorrectZone,
    scorePct: score.scorePct.toString(),
  });
}
