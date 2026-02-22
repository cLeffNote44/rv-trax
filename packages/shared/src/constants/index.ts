// ---------------------------------------------------------------------------
// RV Trax — Application-wide constants
// ---------------------------------------------------------------------------

import type { SubscriptionTier } from '../enums/index.js';

// ── Pagination ──────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

// ── JWT ─────────────────────────────────────────────────────────────────────

export const JWT_ACCESS_EXPIRY = '15m';
export const JWT_REFRESH_EXPIRY = '7d';

// ── Tracker thresholds ──────────────────────────────────────────────────────

/** Mark a tracker as offline after 4 hours of silence. */
export const TRACKER_OFFLINE_THRESHOLD_MS = 4 * 60 * 60 * 1000;

/** Default battery percentage to trigger a low-battery alert. */
export const DEFAULT_BATTERY_ALERT_PCT = 20;

// ── Gateway thresholds ──────────────────────────────────────────────────────

/** Mark a gateway as offline after 5 minutes of silence. */
export const GATEWAY_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

// ── Broadcast intervals ─────────────────────────────────────────────────────

/** Seconds between tracker broadcasts when the unit is parked. */
export const BROADCAST_INTERVAL_PARKED_S = 60;

/** Seconds between tracker broadcasts when the unit is moving. */
export const BROADCAST_INTERVAL_MOVING_S = 10;

// ── Subscription tier limits ────────────────────────────────────────────────

export const MAX_UNITS_PER_TIER: Record<SubscriptionTier, number> = {
  starter: 100,
  professional: 300,
  enterprise: Infinity,
};
