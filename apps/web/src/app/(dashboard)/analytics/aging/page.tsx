'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';
import { ArrowLeft, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import type { InventoryAnalytics } from '@rv-trax/shared';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { formatStatus } from '@/lib/utils';
import { getAgingReport, type AgingDetail } from '@/lib/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET_COLORS: Record<string, string> = {
  '0-30': '#10b981',
  '31-60': '#3b82f6',
  '61-90': '#f59e0b',
  '91-120': '#f97316',
  '120+': '#ef4444',
};

type FilterTab = 'all' | '0-30' | '31-60' | '61-90' | '90+';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '0-30', label: '0-30 Days' },
  { key: '31-60', label: '31-60 Days' },
  { key: '61-90', label: '61-90 Days' },
  { key: '90+', label: '90+ Days' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDaysColor(days: number): string {
  if (days <= 30) return '#10b981';
  if (days <= 60) return '#3b82f6';
  if (days <= 90) return '#f59e0b';
  return '#ef4444';
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function matchesFilter(detail: AgingDetail, filter: FilterTab): boolean {
  if (filter === 'all') return true;
  const d = detail.days_on_lot;
  switch (filter) {
    case '0-30':
      return d <= 30;
    case '31-60':
      return d >= 31 && d <= 60;
    case '61-90':
      return d >= 61 && d <= 90;
    case '90+':
      return d > 90;
    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="h-[120px] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]" />
  );
}

function SkeletonChart() {
  return (
    <div className="h-[320px] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]" />
  );
}

function SkeletonTable() {
  return (
    <div className="h-[480px] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]" />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgingPage() {
  const [summary, setSummary] = useState<InventoryAnalytics | null>(null);
  const [details, setDetails] = useState<AgingDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await getAgingReport({ sort: 'days_on_lot', order: 'desc' });
      setSummary(report.summary);
      setDetails(report.details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load aging report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Derived data
  const totalUnits = summary?.total_units ?? 0;
  const buckets = summary?.aging_buckets;
  const ninetyPlus = buckets ? buckets['91_120'] + buckets['120_plus'] : 0;

  const summaryCards = buckets
    ? [
        {
          label: '0-30 Days',
          count: buckets['0_30'],
          color: BUCKET_COLORS['0-30'],
          bgClass: 'bg-emerald-50',
          textClass: 'text-emerald-700',
        },
        {
          label: '31-60 Days',
          count: buckets['31_60'],
          color: BUCKET_COLORS['31-60'],
          bgClass: 'bg-blue-50',
          textClass: 'text-blue-700',
        },
        {
          label: '61-90 Days',
          count: buckets['61_90'],
          color: BUCKET_COLORS['61-90'],
          bgClass: 'bg-amber-50',
          textClass: 'text-amber-700',
        },
        {
          label: '90+ Days',
          count: ninetyPlus,
          color: BUCKET_COLORS['120+'],
          bgClass: 'bg-red-50',
          textClass: 'text-red-700',
        },
      ]
    : [];

  const chartData = buckets
    ? [
        { bucket: '0-30', count: buckets['0_30'], fill: BUCKET_COLORS['0-30'] },
        { bucket: '31-60', count: buckets['31_60'], fill: BUCKET_COLORS['31-60'] },
        { bucket: '61-90', count: buckets['61_90'], fill: BUCKET_COLORS['61-90'] },
        { bucket: '91-120', count: buckets['91_120'], fill: BUCKET_COLORS['91-120'] },
        { bucket: '120+', count: buckets['120_plus'], fill: BUCKET_COLORS['120+'] },
      ]
    : [];

  const filteredDetails = details.filter((d) => matchesFilter(d, activeFilter));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Back link */}
      <Link
        href="/analytics"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Analytics
      </Link>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)]">
            <Clock className="h-5 w-5 text-[var(--color-brand-600)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Inventory Aging</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Track how long units have been on the lot
            </p>
          </div>
        </div>
        {!loading && summary && (
          <span className="inline-flex items-center rounded-full bg-[var(--color-bg-secondary)] px-3 py-1 text-sm font-medium text-[var(--color-text-primary)]">
            {totalUnits} total units
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load aging data</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : summaryCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="py-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                      {card.label}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${card.bgClass} ${card.textClass}`}
                    >
                      {totalUnits > 0 ? `${Math.round((card.count / totalUnits) * 100)}%` : '0%'}
                    </span>
                  </div>
                  <p className="mt-2 text-3xl font-bold" style={{ color: card.color }}>
                    {card.count}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Bar chart */}
      {loading ? (
        <SkeletonChart />
      ) : chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aging Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="bucket" width={60} tick={{ fontSize: 13 }} />
                <Tooltip
                  formatter={(value: number) => [`${value} units`, 'Count']}
                  contentStyle={{
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-primary)',
                  }}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={32}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      {/* Details table */}
      {loading ? (
        <SkeletonTable />
      ) : details.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Aging Details</CardTitle>
              {/* Filter tabs */}
              <div className="flex gap-1 rounded-lg bg-[var(--color-bg-secondary)] p-1">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeFilter === tab.key
                        ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    <th className="whitespace-nowrap px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Stock #
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Year
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Make
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Model
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Type
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                      MSRP
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                      Days on Lot
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                      Lot
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetails.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-12 text-center text-[var(--color-text-tertiary)]"
                      >
                        No units match the selected filter
                      </td>
                    </tr>
                  ) : (
                    filteredDetails.map((unit) => (
                      <tr
                        key={unit.unit_id}
                        className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-bg-secondary)]"
                      >
                        <td className="whitespace-nowrap px-6 py-3 font-medium text-[var(--color-text-primary)]">
                          {unit.stock_number}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-[var(--color-text-secondary)]">
                          {unit.year}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-[var(--color-text-secondary)]">
                          {unit.make}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-[var(--color-text-secondary)]">
                          {unit.model}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-[var(--color-text-secondary)]">
                          {formatStatus(unit.unit_type)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-right text-[var(--color-text-secondary)]">
                          {formatCurrency(unit.msrp)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-right">
                          <span
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                            style={{ backgroundColor: getDaysColor(unit.days_on_lot) }}
                          >
                            {unit.days_on_lot}d
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3">
                          <span className="inline-flex items-center rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                            {formatStatus(unit.status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-[var(--color-text-secondary)]">
                          {unit.lot_name ?? '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredDetails.length > 0 && (
              <div className="border-t border-[var(--color-border)] px-6 py-3 text-xs text-[var(--color-text-tertiary)]">
                Showing {filteredDetails.length} of {details.length} units
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
