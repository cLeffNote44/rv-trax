import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { getStatusBgColor, formatStatus } from '@/lib/utils';
import type { UnitStatus } from '@rv-trax/shared';

// ---------------------------------------------------------------------------
// Variant map
// ---------------------------------------------------------------------------

const VARIANT_CLASSES = {
  default:
    'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
  success:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  warning:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  error:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  info:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
} as const;

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export interface BadgeProps {
  variant?: keyof typeof VARIANT_CLASSES;
  className?: string;
  children: ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge — auto-colors based on UnitStatus
// ---------------------------------------------------------------------------

export interface StatusBadgeProps {
  status: UnitStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        getStatusBgColor(status),
        className
      )}
    >
      {formatStatus(status)}
    </span>
  );
}
