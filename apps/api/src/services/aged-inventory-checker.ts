// ---------------------------------------------------------------------------
// RV Trax API — Scheduled job: aged inventory checker
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { alertRules, units } from '@rv-trax/db';
import { eq, and, lte, or, isNull } from 'drizzle-orm';
import type Redis from 'ioredis';
import { evaluateAlertRules, type AlertTrigger } from './alert-engine.js';

/** Run once per day (24 hours in milliseconds). */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Statuses considered "on the lot" for aged inventory purposes. */
const LOT_STATUSES = ['available', 'lot_ready'];

// ── Logger interface (subset of Fastify logger) ----------------------------

interface Logger {
  info: (obj: Record<string, unknown> | string, msg?: string) => void;
  error: (obj: Record<string, unknown> | Error, msg?: string) => void;
}

// ── Public entry point -----------------------------------------------------

/**
 * Start the aged inventory checker. Runs once immediately, then every 24 hours.
 * Returns a cleanup function that stops the interval.
 */
export function startAgedInventoryChecker(
  db: Database,
  redis: Redis,
  logger?: Logger,
): { stop: () => void } {
  const log = logger ?? {
    info: (obj: Record<string, unknown> | string, msg?: string) => {
      console.log('[aged-inventory-checker]', msg ?? obj);
    },
    error: (obj: Record<string, unknown> | Error, msg?: string) => {
      console.error('[aged-inventory-checker]', msg ?? obj);
    },
  };

  // Run once on startup (delayed by 30s to let server fully boot)
  const initialTimeout = setTimeout(() => {
    void runCheck(db, redis, log);
  }, 30_000);

  // Then run on interval
  const interval = setInterval(() => {
    void runCheck(db, redis, log);
  }, CHECK_INTERVAL_MS);

  log.info('Aged inventory checker started (interval: 24h)');

  return {
    stop: () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      log.info('Aged inventory checker stopped');
    },
  };
}

// ── Core check logic -------------------------------------------------------

async function runCheck(
  db: Database,
  redis: Redis,
  log: Logger,
): Promise<void> {
  log.info('Running aged inventory check...');

  try {
    // Find all dealerships that have at least one active aged_inventory rule
    const activeRules = await db
      .select({
        dealershipId: alertRules.dealershipId,
        parameters: alertRules.parameters,
      })
      .from(alertRules)
      .where(
        and(
          eq(alertRules.ruleType, 'aged_inventory'),
          eq(alertRules.isActive, true),
        ),
      );

    if (activeRules.length === 0) {
      log.info('No active aged_inventory rules found; skipping.');
      return;
    }

    // Group rules by dealership and find the minimum threshold per dealership
    // (so we query units that exceed ANY rule's threshold)
    const dealershipThresholds = new Map<string, number>();
    for (const rule of activeRules) {
      const params = (rule.parameters ?? {}) as Record<string, unknown>;
      const threshold = (params['days_threshold'] as number) ?? 90;
      const existing = dealershipThresholds.get(rule.dealershipId);
      if (existing === undefined || threshold < existing) {
        dealershipThresholds.set(rule.dealershipId, threshold);
      }
    }

    let totalAlerts = 0;

    for (const [dealershipId, minThreshold] of dealershipThresholds) {
      const cutoffDate = new Date(
        Date.now() - minThreshold * 24 * 60 * 60 * 1000,
      );

      // Query units that arrived before the cutoff and are in a lot status
      const agedUnits = await db
        .select({
          id: units.id,
          arrivedAt: units.arrivedAt,
        })
        .from(units)
        .where(
          and(
            eq(units.dealershipId, dealershipId),
            lte(units.arrivedAt, cutoffDate),
            or(
              ...LOT_STATUSES.map((s) => eq(units.status, s)),
            ),
            isNull(units.archivedAt),
          ),
        );

      for (const unit of agedUnits) {
        const arrivedAt = unit.arrivedAt
          ? new Date(unit.arrivedAt)
          : new Date();
        const daysOnLot = Math.floor(
          (Date.now() - arrivedAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        const trigger: AlertTrigger = {
          type: 'aged_inventory',
          dealershipId,
          unitId: unit.id,
          daysOnLot,
        };

        const created = await evaluateAlertRules(trigger, db, redis);
        totalAlerts += created.length;
      }
    }

    log.info(
      { dealerships: dealershipThresholds.size, alertsCreated: totalAlerts },
      'Aged inventory check complete',
    );
  } catch (err) {
    log.error(
      err instanceof Error ? err : { error: String(err) },
      'Aged inventory check failed',
    );
  }
}
