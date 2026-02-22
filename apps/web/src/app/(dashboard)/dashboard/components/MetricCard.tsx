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
  default: 'bg-slate-100 text-slate-600',
  green: 'bg-emerald-100 text-emerald-600',
  red: 'bg-red-100 text-red-600',
  yellow: 'bg-amber-100 text-amber-600',
  blue: 'bg-blue-100 text-blue-600',
} as const;

const trendColorMap = {
  up: 'text-emerald-600',
  down: 'text-red-600',
  neutral: 'text-slate-500',
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
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
                <span className="text-xs text-slate-400">{trendLabel}</span>
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
