'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Package, Clock, TrendingUp, MapPin, BarChart3 } from 'lucide-react';
import type { InventoryAnalytics, LotUtilization, MovementAnalytics } from '@rv-trax/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatStatus } from '@/lib/utils';
import { getInventoryAnalytics, getLotUtilization, getMovementAnalytics } from '@/lib/api';

const CHART_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];

const STATUS_COLOR_MAP: Record<string, string> = {
  new_arrival: '#3b82f6',
  pdi_pending: '#f59e0b',
  pdi_in_progress: '#f97316',
  lot_ready: '#14b8a6',
  available: '#10b981',
  hold: '#8b5cf6',
  shown: '#6366f1',
  deposit: '#ec4899',
  sold: '#059669',
  pending_delivery: '#06b6d4',
  delivered: '#6b7280',
  in_service: '#ea580c',
  wholesale: '#e11d48',
  archived: '#9ca3af',
};

interface AnalyticsData {
  inventory: InventoryAnalytics;
  lots: LotUtilization[];
  movement: MovementAnalytics;
}

function SkeletonChart() {
  return <Skeleton className="h-[320px] rounded-xl" />;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [inventory, lots, movement] = await Promise.all([
          getInventoryAnalytics(),
          getLotUtilization(),
          getMovementAnalytics({ days: 30 }),
        ]);
        if (!cancelled) {
          setData({ inventory, lots, movement });
        }
      } catch {
        // Keep loading state for skeletons
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const avgLotUtilization = data?.lots.length
    ? Math.round(data.lots.reduce((sum, l) => sum + l.utilization_pct, 0) / data.lots.length)
    : 0;

  const statusChartData = data
    ? Object.entries(data.inventory.by_status).map(([key, value]) => ({
        name: formatStatus(key),
        value,
        fill: STATUS_COLOR_MAP[key] ?? '#6b7280',
      }))
    : [];

  const typeChartData = data
    ? Object.entries(data.inventory.by_type).map(([key, value], i) => ({
        name: formatStatus(key),
        value,
        fill: CHART_COLORS[i % CHART_COLORS.length] ?? '#6b7280',
      }))
    : [];

  const agingData = data
    ? [
        { bucket: '0-30', count: data.inventory.aging_buckets['0_30'] },
        { bucket: '31-60', count: data.inventory.aging_buckets['31_60'] },
        { bucket: '61-90', count: data.inventory.aging_buckets['61_90'] },
        { bucket: '91-120', count: data.inventory.aging_buckets['91_120'] },
        { bucket: '120+', count: data.inventory.aging_buckets['120_plus'] },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="Inventory insights, lot utilization, and movement trends"
      />

      {/* Row 1 - Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="card" />)
        ) : data ? (
          <>
            <SummaryCard
              title="Total Units"
              value={data.inventory.total_units}
              icon={<Package className="h-5 w-5 text-blue-600" />}
            />
            <SummaryCard
              title="Average Age"
              value={`${data.inventory.average_age_days}d`}
              icon={<Clock className="h-5 w-5 text-amber-600" />}
            />
            <SummaryCard
              title="Stock Turn Rate"
              value={data.inventory.stock_turn_rate.toFixed(1)}
              icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            />
            <SummaryCard
              title="Lot Utilization"
              value={`${avgLotUtilization}%`}
              icon={<MapPin className="h-5 w-5 text-purple-600" />}
            />
          </>
        ) : null}
      </div>

      {/* Row 2 - Status & Type Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : data ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Inventory by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={statusChartData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {statusChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {typeChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Row 3 - Aging & Movement Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : data ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Aging Buckets</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={agingData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Movement Trends (30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={data.movement.moves_by_day}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                    />
                    <YAxis />
                    <Tooltip labelFormatter={(v: string) => new Date(v).toLocaleDateString()} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Row 4 - Tables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {loading ? (
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        ) : data ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Most Moved Units</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                        Stock #
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                        Moves
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movement.most_moved_units.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-6 py-8 text-center text-[var(--color-text-tertiary)]"
                        >
                          No movement data available
                        </td>
                      </tr>
                    ) : (
                      data.movement.most_moved_units.map((unit) => (
                        <tr
                          key={unit.unit_id}
                          className="border-b border-[var(--color-border)] last:border-0"
                        >
                          <td className="px-6 py-3 font-medium text-[var(--color-text-primary)]">
                            {unit.stock_number}
                          </td>
                          <td className="px-6 py-3 text-right text-[var(--color-text-secondary)]">
                            {unit.move_count}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Idle Units</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                        Stock #
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                        Days Idle
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movement.idle_units.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-6 py-8 text-center text-[var(--color-text-tertiary)]"
                        >
                          No idle units
                        </td>
                      </tr>
                    ) : (
                      data.movement.idle_units.map((unit) => (
                        <tr
                          key={unit.unit_id}
                          className="border-b border-[var(--color-border)] last:border-0"
                        >
                          <td className="px-6 py-3 font-medium text-[var(--color-text-primary)]">
                            {unit.stock_number}
                          </td>
                          <td
                            className={cn(
                              'px-6 py-3 text-right font-medium',
                              unit.days_idle > 90
                                ? 'text-red-600'
                                : 'text-[var(--color-text-secondary)]',
                            )}
                          >
                            {unit.days_idle}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Card Sub-component
// ---------------------------------------------------------------------------

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)]">
          {icon}
        </div>
        <div>
          <p className="text-sm text-[var(--color-text-secondary)]">{title}</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
