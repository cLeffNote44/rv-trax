import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';
import type { UnitStatus } from '@rv-trax/shared';

/**
 * Merge Tailwind CSS classes with clsx, resolving conflicts via tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as US currency.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a date string as a readable date.
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';
  return format(d, 'MMM d, yyyy');
}

/**
 * Format a date string as a relative time (e.g., "5 min ago").
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Map a UnitStatus to a Tailwind text color class.
 */
export function getStatusColor(status: UnitStatus): string {
  const map: Record<UnitStatus, string> = {
    new_arrival: 'text-blue-600 dark:text-blue-400',
    pdi_pending: 'text-amber-600 dark:text-amber-400',
    pdi_in_progress: 'text-amber-600 dark:text-amber-400',
    lot_ready: 'text-teal-600 dark:text-teal-400',
    available: 'text-green-600 dark:text-green-400',
    hold: 'text-purple-600 dark:text-purple-400',
    shown: 'text-indigo-600 dark:text-indigo-400',
    deposit: 'text-pink-600 dark:text-pink-400',
    sold: 'text-emerald-600 dark:text-emerald-400',
    pending_delivery: 'text-cyan-600 dark:text-cyan-400',
    delivered: 'text-gray-500 dark:text-gray-400',
    in_service: 'text-orange-600 dark:text-orange-400',
    wholesale: 'text-rose-600 dark:text-rose-400',
    archived: 'text-gray-400 dark:text-gray-500',
  };
  return map[status] ?? 'text-gray-500';
}

/**
 * Map a UnitStatus to a Tailwind background color class for badges.
 */
export function getStatusBgColor(status: UnitStatus): string {
  const map: Record<UnitStatus, string> = {
    new_arrival: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    pdi_pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    pdi_in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    lot_ready: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    hold: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    shown: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    deposit: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    sold: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    pending_delivery: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    delivered: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300',
    in_service: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    wholesale: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

/**
 * Format a UnitStatus enum value as a human-readable label.
 */
export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
