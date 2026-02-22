'use client';

import { cn } from '@/lib/utils';
import type { UnitStatus, TrackerStatus, GatewayStatus, AlertSeverity } from '@rv-trax/shared';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgePropsWithVariant {
  status: string;
  variant: BadgeVariant;
}

interface StatusBadgePropsAutoColor {
  status: UnitStatus | TrackerStatus | GatewayStatus | AlertSeverity;
  variant?: never;
}

type StatusBadgeProps = StatusBadgePropsWithVariant | StatusBadgePropsAutoColor;

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300',
};

const autoVariantMap: Record<string, BadgeVariant> = {
  // TrackerStatus
  assigned: 'success',
  unassigned: 'default',
  low_battery: 'warning',
  offline: 'error',
  retired: 'default',
  // GatewayStatus
  online: 'success',
  // AlertSeverity
  info: 'info',
  warning: 'warning',
  critical: 'error',
  // UnitStatus
  new_arrival: 'info',
  pdi_pending: 'warning',
  pdi_in_progress: 'warning',
  lot_ready: 'info',
  available: 'success',
  hold: 'warning',
  shown: 'info',
  deposit: 'info',
  sold: 'success',
  pending_delivery: 'info',
  delivered: 'default',
  in_service: 'warning',
  wholesale: 'error',
  archived: 'default',
};

function formatLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function StatusBadge(props: StatusBadgeProps) {
  const resolved: BadgeVariant =
    props.variant ?? autoVariantMap[props.status] ?? 'default';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[resolved]
      )}
    >
      {formatLabel(props.status)}
    </span>
  );
}
