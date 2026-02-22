'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { Tracker } from '@rv-trax/shared';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface BatteryDashboardProps {
  trackers: Tracker[];
  threshold?: number;
}

function getBatteryColor(pct: number): string {
  if (pct < 10) return '#ef4444'; // red-500
  if (pct < 20) return '#f97316'; // orange-500
  if (pct <= 50) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
}

export function BatteryDashboard({
  trackers,
  threshold = 20,
}: BatteryDashboardProps) {
  const [showChart, setShowChart] = useState(true);

  const chartData = useMemo(() => {
    return trackers
      .filter((t) => t.battery_pct !== null)
      .map((t) => ({
        name: t.label || t.device_eui.slice(-6),
        battery: t.battery_pct ?? 0,
        device_eui: t.device_eui,
      }))
      .sort((a, b) => a.battery - b.battery);
  }, [trackers]);

  const belowThreshold = chartData.filter((d) => d.battery < threshold).length;
  const belowCritical = chartData.filter((d) => d.battery < 10).length;

  if (chartData.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Battery Overview
          </h3>
          <Badge variant="warning" className="text-amber-600">
            {belowThreshold} below {threshold}%
          </Badge>
          {belowCritical > 0 && (
            <Badge variant="error">
              {belowCritical} below 10%
            </Badge>
          )}
        </div>
        <button
          onClick={() => setShowChart((v) => !v)}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {showChart ? 'Hide' : 'Show'} Chart
        </button>
      </div>

      {showChart && (
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 24)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 20, bottom: 0, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Battery']}
              labelFormatter={(label) => `Tracker: ${label}`}
            />
            <ReferenceLine
              x={threshold}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: `${threshold}%`, position: 'top', fill: '#ef4444', fontSize: 11 }}
            />
            <Bar dataKey="battery" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={getBatteryColor(entry.battery)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
