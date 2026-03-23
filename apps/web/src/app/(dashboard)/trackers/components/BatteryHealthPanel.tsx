'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Battery,
  BatteryLow,
  BatteryWarning,
  TrendingDown,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { getBatteryHealth, type BatteryPrediction } from '@/lib/api';

const TREND_CONFIG = {
  stable: { icon: Minus, color: '#10b981', label: 'Stable' },
  declining: { icon: TrendingDown, color: '#f59e0b', label: 'Declining' },
  critical: { icon: AlertTriangle, color: '#ef4444', label: 'Critical' },
} as const;

export function BatteryHealthPanel() {
  const [data, setData] = useState<BatteryPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BatteryPrediction | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getBatteryHealth();
        if (!cancelled) setData(result);
      } catch {
        // silently fail — this is a supplementary panel
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const critical = data.filter((d) => d.trend === 'critical').length;
    const declining = data.filter((d) => d.trend === 'declining').length;
    const avgPct = Math.round(data.reduce((s, d) => s + d.current_pct, 0) / data.length);
    const needsReplace = data.filter(
      (d) => d.estimated_days_remaining !== null && d.estimated_days_remaining < 30,
    ).length;
    return { critical, declining, avgPct, needsReplace };
  }, [data]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
        <div className="h-5 w-40 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-[var(--color-bg-tertiary)]" />
          ))}
        </div>
        <div className="h-48 rounded-lg bg-[var(--color-bg-tertiary)]" />
      </div>
    );
  }

  if (data.length === 0) return null;

  return (
    <div className="space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
          <Battery className="h-5 w-5 text-[var(--color-brand-600)]" />
          Battery Health Predictions
        </h3>
        <span className="text-sm text-[var(--color-text-tertiary)]">{data.length} trackers</span>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-[var(--color-bg-secondary)] p-3">
            <div className="text-xs text-[var(--color-text-tertiary)]">Avg Battery</div>
            <div className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">
              {stats.avgPct}%
            </div>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <div className="text-xs text-red-600">Critical</div>
            <div className="mt-1 text-xl font-bold text-red-700">{stats.critical}</div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3">
            <div className="text-xs text-amber-600">Declining</div>
            <div className="mt-1 text-xl font-bold text-amber-700">{stats.declining}</div>
          </div>
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="text-xs text-blue-600">Replace &lt;30d</div>
            <div className="mt-1 text-xl font-bold text-blue-700">{stats.needsReplace}</div>
          </div>
        </div>
      )}

      {/* Tracker list */}
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {data
          .sort((a, b) => a.current_pct - b.current_pct)
          .map((tracker) => {
            const trend = TREND_CONFIG[tracker.trend];
            const TrendIcon = trend.icon;
            const isSelected = selected?.tracker_id === tracker.tracker_id;

            return (
              <button
                key={tracker.tracker_id}
                onClick={() => setSelected(isSelected ? null : tracker)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-[var(--color-brand-500)] bg-blue-50'
                    : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                {tracker.current_pct < 15 ? (
                  <BatteryWarning className="h-5 w-5 shrink-0 text-red-500" />
                ) : tracker.current_pct < 30 ? (
                  <BatteryLow className="h-5 w-5 shrink-0 text-amber-500" />
                ) : (
                  <Battery className="h-5 w-5 shrink-0 text-green-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                    {tracker.label ?? tracker.device_eui}
                  </div>
                  <div className="text-xs text-[var(--color-text-tertiary)]">
                    {tracker.estimated_days_remaining !== null
                      ? `~${tracker.estimated_days_remaining} days remaining`
                      : 'Estimating...'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendIcon className="h-3.5 w-3.5" style={{ color: trend.color }} />
                  <span className="text-sm font-semibold" style={{ color: trend.color }}>
                    {tracker.current_pct}%
                  </span>
                </div>
              </button>
            );
          })}
      </div>

      {/* Battery trend chart for selected tracker */}
      {selected && selected.readings_30d.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          <div className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">
            30-Day Battery Trend — {selected.label ?? selected.device_eui}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={selected.readings_30d}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)} // MM-DD
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, 'Battery']}
                labelFormatter={(label: string) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke={TREND_CONFIG[selected.trend].color}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
