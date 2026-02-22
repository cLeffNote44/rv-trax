// ---------------------------------------------------------------------------
// RV Trax API — Scheduled job: tracker & gateway offline checker
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { alertRules, trackers, trackerAssignments, gateways } from '@rv-trax/db';
import { eq, and, lte, ne, isNull, gt } from 'drizzle-orm';
import type Redis from 'ioredis';
import { evaluateAlertRules, type AlertTrigger } from './alert-engine.js';
import { TrackerStatus } from '@rv-trax/shared';

/** Run every 15 minutes. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

// ── Logger interface -------------------------------------------------------

interface Logger {
  info: (obj: Record<string, unknown> | string, msg?: string) => void;
  error: (obj: Record<string, unknown> | Error, msg?: string) => void;
}

// ── Public entry point -----------------------------------------------------

/**
 * Start the tracker and gateway offline checker. Runs once immediately
 * (delayed 15s), then every 15 minutes.
 * Returns a cleanup function that stops the interval.
 */
export function startTrackerOfflineChecker(
  db: Database,
  redis: Redis,
  logger?: Logger,
): { stop: () => void } {
  const log = logger ?? {
    info: (obj: Record<string, unknown> | string, msg?: string) => {
      console.log('[tracker-offline-checker]', msg ?? obj);
    },
    error: (obj: Record<string, unknown> | Error, msg?: string) => {
      console.error('[tracker-offline-checker]', msg ?? obj);
    },
  };

  // Run once on startup (delayed by 15s to let server fully boot)
  const initialTimeout = setTimeout(() => {
    void runCheck(db, redis, log);
  }, 15_000);

  // Then run on interval
  const interval = setInterval(() => {
    void runCheck(db, redis, log);
  }, CHECK_INTERVAL_MS);

  log.info('Tracker offline checker started (interval: 15m)');

  return {
    stop: () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      log.info('Tracker offline checker stopped');
    },
  };
}

// ── Core check logic -------------------------------------------------------

async function runCheck(
  db: Database,
  redis: Redis,
  log: Logger,
): Promise<void> {
  log.info('Running tracker/gateway offline check...');

  try {
    await checkTrackersGoingOffline(db, redis, log);
    await checkTrackersComingBackOnline(db, log);
    await checkGatewaysGoingOffline(db, redis, log);
  } catch (err) {
    log.error(
      err instanceof Error ? err : { error: String(err) },
      'Tracker/gateway offline check failed',
    );
  }
}

// ── Tracker offline detection ----------------------------------------------

async function checkTrackersGoingOffline(
  db: Database,
  redis: Redis,
  log: Logger,
): Promise<void> {
  // Find all dealerships with active tracker_offline rules
  const rules = await db
    .select({
      dealershipId: alertRules.dealershipId,
      parameters: alertRules.parameters,
    })
    .from(alertRules)
    .where(
      and(
        eq(alertRules.ruleType, 'tracker_offline'),
        eq(alertRules.isActive, true),
      ),
    );

  if (rules.length === 0) return;

  // Group by dealership, find minimum threshold
  const dealershipThresholds = new Map<string, number>();
  for (const rule of rules) {
    const params = (rule.parameters ?? {}) as Record<string, unknown>;
    const hoursThreshold = (params['hours_threshold'] as number) ?? 4;
    const existing = dealershipThresholds.get(rule.dealershipId);
    if (existing === undefined || hoursThreshold < existing) {
      dealershipThresholds.set(rule.dealershipId, hoursThreshold);
    }
  }

  let alertsCreated = 0;
  let trackersMarkedOffline = 0;

  for (const [dealershipId, minHours] of dealershipThresholds) {
    const cutoff = new Date(Date.now() - minHours * 60 * 60 * 1000);

    // Find trackers that:
    //   - belong to this dealership
    //   - have last_seen_at older than threshold
    //   - are NOT retired
    //   - are NOT already offline
    const offlineTrackers = await db
      .select({
        id: trackers.id,
        lastSeenAt: trackers.lastSeenAt,
        status: trackers.status,
      })
      .from(trackers)
      .where(
        and(
          eq(trackers.dealershipId, dealershipId),
          lte(trackers.lastSeenAt, cutoff),
          ne(trackers.status, TrackerStatus.RETIRED),
          ne(trackers.status, TrackerStatus.OFFLINE),
        ),
      );

    for (const tracker of offlineTrackers) {
      // Update tracker status to offline
      await db
        .update(trackers)
        .set({ status: TrackerStatus.OFFLINE, updatedAt: new Date() })
        .where(eq(trackers.id, tracker.id));

      trackersMarkedOffline++;

      // Evaluate alert rules
      const trigger: AlertTrigger = {
        type: 'tracker_offline',
        dealershipId,
        trackerId: tracker.id,
        lastSeenAt: tracker.lastSeenAt?.toISOString() ?? new Date(0).toISOString(),
      };

      const created = await evaluateAlertRules(trigger, db, redis);
      alertsCreated += created.length;
    }
  }

  if (trackersMarkedOffline > 0 || alertsCreated > 0) {
    log.info(
      { trackersMarkedOffline, alertsCreated },
      'Tracker offline check: trackers going offline',
    );
  }
}

// ── Tracker recovery detection ---------------------------------------------

async function checkTrackersComingBackOnline(
  db: Database,
  log: Logger,
): Promise<void> {
  // Find all trackers with status 'offline' but last_seen_at is recent
  // Use a generous window: if last_seen_at is within the last hour, the
  // tracker has come back online.
  const recentThreshold = new Date(Date.now() - 60 * 60 * 1000);

  const recoveredTrackers = await db
    .select({
      id: trackers.id,
      lastSeenAt: trackers.lastSeenAt,
    })
    .from(trackers)
    .where(
      and(
        eq(trackers.status, TrackerStatus.OFFLINE),
        gt(trackers.lastSeenAt, recentThreshold),
      ),
    );

  let recoveredCount = 0;

  for (const tracker of recoveredTrackers) {
    // Determine the correct status: check if tracker has an active assignment
    const [activeAssignment] = await db
      .select({ id: trackerAssignments.id })
      .from(trackerAssignments)
      .where(
        and(
          eq(trackerAssignments.trackerId, tracker.id),
          isNull(trackerAssignments.unassignedAt),
        ),
      )
      .limit(1);

    const newStatus = activeAssignment
      ? TrackerStatus.ASSIGNED
      : TrackerStatus.UNASSIGNED;

    await db
      .update(trackers)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(trackers.id, tracker.id));

    recoveredCount++;
  }

  if (recoveredCount > 0) {
    log.info(
      { recoveredCount },
      'Tracker offline check: trackers recovered',
    );
  }
}

// ── Gateway offline detection ----------------------------------------------

async function checkGatewaysGoingOffline(
  db: Database,
  redis: Redis,
  log: Logger,
): Promise<void> {
  // Find all dealerships with active gateway_offline rules
  const rules = await db
    .select({
      dealershipId: alertRules.dealershipId,
      parameters: alertRules.parameters,
    })
    .from(alertRules)
    .where(
      and(
        eq(alertRules.ruleType, 'gateway_offline'),
        eq(alertRules.isActive, true),
      ),
    );

  if (rules.length === 0) return;

  // Group by dealership, find minimum threshold
  const dealershipThresholds = new Map<string, number>();
  for (const rule of rules) {
    const params = (rule.parameters ?? {}) as Record<string, unknown>;
    const minutesThreshold = (params['minutes_threshold'] as number) ?? 5;
    const existing = dealershipThresholds.get(rule.dealershipId);
    if (existing === undefined || minutesThreshold < existing) {
      dealershipThresholds.set(rule.dealershipId, minutesThreshold);
    }
  }

  let alertsCreated = 0;
  let gatewaysMarkedOffline = 0;

  for (const [dealershipId, minMinutes] of dealershipThresholds) {
    const cutoff = new Date(Date.now() - minMinutes * 60 * 1000);

    // Find gateways that are online but last_seen_at is too old
    const offlineGateways = await db
      .select({
        id: gateways.id,
        lastSeenAt: gateways.lastSeenAt,
      })
      .from(gateways)
      .where(
        and(
          eq(gateways.dealershipId, dealershipId),
          eq(gateways.status, 'online'),
          lte(gateways.lastSeenAt, cutoff),
        ),
      );

    for (const gw of offlineGateways) {
      // Mark gateway as offline
      await db
        .update(gateways)
        .set({ status: 'offline' })
        .where(eq(gateways.id, gw.id));

      gatewaysMarkedOffline++;

      // Evaluate alert rules
      const trigger: AlertTrigger = {
        type: 'gateway_offline',
        dealershipId,
        gatewayId: gw.id,
        lastSeenAt: gw.lastSeenAt?.toISOString() ?? new Date(0).toISOString(),
      };

      const created = await evaluateAlertRules(trigger, db, redis);
      alertsCreated += created.length;
    }
  }

  if (gatewaysMarkedOffline > 0 || alertsCreated > 0) {
    log.info(
      { gatewaysMarkedOffline, alertsCreated },
      'Gateway offline check complete',
    );
  }
}
