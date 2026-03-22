'use client';

import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  color?: 'default' | 'green' | 'red' | 'yellow' | 'blue';
}

const colorMap = {
  default: 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
  green: 'bg-emerald-500/15 text-emerald-500',
  red: 'bg-red-500/15 text-red-500',
  yellow: 'bg-amber-500/15 text-amber-500',
  blue: 'bg-blue-500/15 text-blue-500',
} as const;

const trendColorMap = {
  up: 'text-[var(--color-success)]',
  down: 'text-[var(--color-error)]',
  neutral: 'text-[var(--color-text-tertiary)]',
} as const;

export default function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  color = 'default',
}: MetricCardProps) {
  const trendDirection =
    trend === undefined || trend === 0
      ? 'neutral'
      : trend > 0
        ? 'up'
        : 'down';

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {value}
          </p>
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  'inline-flex items-center text-sm font-medium',
                  trendColorMap[trendDirection],
                )}
              >
                {trendDirection === 'up' && (
                  <svg
                    className="mr-0.5 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7 17l5-5 5 5"
                    />
                  </svg>
                )}
                {trendDirection === 'down' && (
                  <svg
                    className="mr-0.5 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 7l-5 5-5-5"
                    />
                  </svg>
                )}
                {trend > 0 ? '+' : ''}
                {trend}%
              </span>
              {trendLabel && (
                <span className="text-xs text-[var(--color-text-tertiary)]">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-lg',
            colorMap[color],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
