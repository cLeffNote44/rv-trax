'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface TrackerSummary {
  assigned: number;
  unassigned: number;
  low_battery: number;
  offline: number;
}

const TRACKER_COLORS: Record<string, string> = {
  Assigned: '#10b981',
  Unassigned: '#94a3b8',
  'Low Battery': '#f59e0b',
  Offline: '#ef4444',
};

const LEGEND_ITEMS = [
  { key: 'Assigned', color: '#10b981' },
  { key: 'Unassigned', color: '#94a3b8' },
  { key: 'Low Battery', color: '#f59e0b' },
  { key: 'Offline', color: '#ef4444' },
] as const;

export default function TrackerHealth() {
  const [summary, setSummary] = useState<TrackerSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchTrackerSummary() {
      try {
        const { getTrackers } = await import('@/lib/api');
        const response = await getTrackers({});
        const trackers = response.data;
        const counts: TrackerSummary = {
          assigned: 0,
          unassigned: 0,
          low_battery: 0,
          offline: 0,
        };
        for (const t of trackers) {
          switch (t.status) {
            case 'assigned':
              counts.assigned++;
              break;
            case 'unassigned':
              counts.unassigned++;
              break;
            case 'low_battery':
              counts.low_battery++;
              break;
            case 'offline':
              counts.offline++;
              break;
          }
        }
        if (!cancelled) {
          setSummary(counts);
        }
      } catch {
        // Fallback to empty state
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTrackerSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <div className="h-32 w-32 animate-pulse rounded-full bg-[var(--color-bg-tertiary)]" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Unable to load tracker data
      </div>
    );
  }

  const total =
    summary.assigned +
    summary.unassigned +
    summary.low_battery +
    summary.offline;

  const chartData = [
    { name: 'Assigned', value: summary.assigned },
    { name: 'Unassigned', value: summary.unassigned },
    { name: 'Low Battery', value: summary.low_battery },
    { name: 'Offline', value: summary.offline },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-[var(--color-text-secondary)]">
        No trackers registered
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={TRACKER_COLORS[entry.name] ?? '#94a3b8'}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                fontSize: '13px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[var(--color-text-primary)]">{total}</span>
          <span className="text-xs text-[var(--color-text-secondary)]">Total</span>
        </div>
      </div>
      <div className="space-y-3">
        {LEGEND_ITEMS.map(({ key, color }) => {
          const val =
            key === 'Assigned'
              ? summary.assigned
              : key === 'Unassigned'
                ? summary.unassigned
                : key === 'Low Battery'
                  ? summary.low_battery
                  : summary.offline;
          return (
            <div key={key} className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-[var(--color-text-secondary)]">{key}</span>
              <span className="ml-auto text-sm font-semibold text-[var(--color-text-primary)]">
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
