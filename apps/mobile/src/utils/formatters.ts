// ---------------------------------------------------------------------------
// RV Trax Mobile — Formatter Utilities
// ---------------------------------------------------------------------------

/**
 * Format the number of days a unit has been on the lot.
 * @param arrivedAt - ISO-8601 timestamp of when the unit arrived.
 * @returns Human-readable string like "45 days".
 */
export function formatDaysOnLot(arrivedAt: string): string {
  const arrived = new Date(arrivedAt);
  const now = new Date();
  const diffMs = now.getTime() - arrived.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/**
 * Format a timestamp as a relative time string.
 * @param timestamp - ISO-8601 timestamp.
 * @returns E.g., "5 min ago", "2 hours ago", "3 days ago".
 */
export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
}

/**
 * Format a number as US currency.
 * @param amount - Dollar amount (e.g., 45999).
 * @returns Formatted string like "$45,999".
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a VIN to show only the last 8 characters with a leading ellipsis.
 * @param vin - Full 17-character VIN.
 * @returns E.g., "...ABC1234".
 */
export function formatVin(vin: string): string {
  if (vin.length <= 8) return vin.toUpperCase();
  return `...${vin.slice(-8).toUpperCase()}`;
}

/**
 * Format battery percentage with a colour indicator.
 * @param pct - Battery percentage (0-100).
 * @returns Object with display text and hex colour.
 */
export function formatBatteryPct(pct: number): { text: string; color: string } {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  let color: string;

  if (clamped > 50) {
    color = '#22C55E'; // green
  } else if (clamped >= 20) {
    color = '#EAB308'; // yellow
  } else {
    color = '#EF4444'; // red
  }

  return { text: `${clamped}%`, color };
}

/**
 * Normalise a stock number to uppercase.
 * @param sn - Raw stock number string.
 * @returns Uppercase stock number.
 */
export function formatStockNumber(sn: string): string {
  return sn.toUpperCase();
}
