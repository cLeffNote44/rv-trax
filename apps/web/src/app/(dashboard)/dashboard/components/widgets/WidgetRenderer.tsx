'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  CheckCircle2,
  DollarSign,
  Wrench,
  Clock,
  MapPin,
  Plus,
  Search,
  ArrowRight,
  Bell,
} from 'lucide-react';
import { UnitStatus, AlertStatus, AlertSeverity } from '@rv-trax/shared';
import TrackerHealth from '../TrackerHealth';
import ActivityFeed from '../ActivityFeed';

// ---------------------------------------------------------------------------
// Widget: Inventory Summary
// ---------------------------------------------------------------------------

function InventorySummaryWidget() {
  const [data, setData] = useState<{
    total: number;
    available: number;
    sold: number;
    inService: number;
    avgDays: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('@/lib/api').then(({ getUnits }) => {
      getUnits({})
        .then((res) => {
          if (cancelled) return;
          const units = res.data;
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          let total = 0,
            available = 0,
            sold = 0,
            inService = 0,
            totalDays = 0,
            count = 0;

          for (const u of units) {
            total++;
            if (u.status === UnitStatus.AVAILABLE || u.status === UnitStatus.LOT_READY) available++;
            if (
              (u.status === UnitStatus.SOLD || u.status === UnitStatus.DELIVERED) &&
              new Date(u.updated_at) >= monthStart
            )
              sold++;
            if (u.status === UnitStatus.IN_SERVICE) inService++;
            if (u.status !== UnitStatus.SOLD && u.status !== UnitStatus.ARCHIVED) {
              totalDays += Math.floor(
                (now.getTime() - new Date(u.created_at).getTime()) / 86400000,
              );
              count++;
            }
          }
          setData({
            total,
            available,
            sold,
            inService,
            avgDays: count > 0 ? Math.round(totalDays / count) : 0,
          });
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <SkeletonWidget />;

  const metrics = [
    {
      label: 'Total',
      value: data.total,
      icon: Package,
      color: 'text-[var(--color-text-secondary)]',
    },
    { label: 'Available', value: data.available, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Sold (Mo)', value: data.sold, icon: DollarSign, color: 'text-red-500' },
    { label: 'In Service', value: data.inService, icon: Wrench, color: 'text-amber-500' },
    { label: 'Avg Days', value: data.avgDays, icon: Clock, color: 'text-blue-500' },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="text-center">
          <m.icon className={`mx-auto h-5 w-5 ${m.color}`} />
          <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{m.value}</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)]">{m.label}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: Alerts
// ---------------------------------------------------------------------------

function AlertFeedWidget() {
  const [summary, setSummary] = useState<{
    total: number;
    critical: number;
    warning: number;
    info: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('@/lib/api').then(({ getAlerts }) => {
      getAlerts({})
        .then((res) => {
          if (cancelled) return;
          const s = { total: 0, critical: 0, warning: 0, info: 0 };
          for (const a of res.data) {
            if (a.status === AlertStatus.NEW_ALERT) {
              s.total++;
              if (a.severity === AlertSeverity.CRITICAL) s.critical++;
              else if (a.severity === AlertSeverity.WARNING) s.warning++;
              else s.info++;
            }
          }
          setSummary(s);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) return <SkeletonWidget />;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-5 w-5 text-[var(--color-text-secondary)]" />
        <span className="text-2xl font-bold text-[var(--color-text-primary)]">{summary.total}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">unacknowledged</span>
      </div>
      <div className="space-y-2">
        {[
          { label: 'Critical', count: summary.critical, color: 'bg-red-500' },
          { label: 'Warning', count: summary.warning, color: 'bg-amber-500' },
          { label: 'Info', count: summary.info, color: 'bg-blue-500' },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${r.color}`} />
              <span className="text-sm text-[var(--color-text-secondary)]">{r.label}</span>
            </div>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {r.count}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/alerts"
        className="mt-3 block text-xs font-medium text-[var(--color-brand-500)] hover:text-[var(--color-brand-400)]"
      >
        View All Alerts →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: Aging Overview
// ---------------------------------------------------------------------------

function AgingChartWidget() {
  const [buckets, setBuckets] = useState<{ label: string; count: number; color: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    import('@/lib/api').then(({ getUnits }) => {
      getUnits({})
        .then((res) => {
          if (cancelled) return;
          const now = Date.now();
          const b = [0, 0, 0, 0, 0];
          for (const u of res.data) {
            if (u.status === UnitStatus.SOLD || u.status === UnitStatus.ARCHIVED) continue;
            const days = Math.floor((now - new Date(u.created_at).getTime()) / 86400000);
            if (days <= 30) b[0]++;
            else if (days <= 60) b[1]++;
            else if (days <= 90) b[2]++;
            else if (days <= 120) b[3]++;
            else b[4]++;
          }
          setBuckets([
            { label: '0-30d', count: b[0], color: 'bg-emerald-500' },
            { label: '31-60d', count: b[1], color: 'bg-blue-500' },
            { label: '61-90d', count: b[2], color: 'bg-amber-500' },
            { label: '91-120d', count: b[3], color: 'bg-orange-500' },
            { label: '120+d', count: b[4], color: 'bg-red-500' },
          ]);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (buckets.length === 0) return <SkeletonWidget />;

  const max = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height: 100 }}>
        {buckets.map((b) => (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
              {b.count}
            </span>
            <div
              className={`w-full rounded-t ${b.color}`}
              style={{ height: `${(b.count / max) * 80}px`, minHeight: 4 }}
            />
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{b.label}</span>
          </div>
        ))}
      </div>
      <Link
        href="/analytics/aging"
        className="mt-2 block text-xs font-medium text-[var(--color-brand-500)]"
      >
        View Details →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: Status Breakdown
// ---------------------------------------------------------------------------

function StatusBreakdownWidget() {
  const [statuses, setStatuses] = useState<{ status: string; count: number }[]>([]);

  useEffect(() => {
    let cancelled = false;
    import('@/lib/api').then(({ getUnits }) => {
      getUnits({})
        .then((res) => {
          if (cancelled) return;
          const map = new Map<string, number>();
          for (const u of res.data) {
            map.set(u.status, (map.get(u.status) ?? 0) + 1);
          }
          const sorted = Array.from(map.entries())
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count);
          setStatuses(sorted);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (statuses.length === 0) return <SkeletonWidget />;

  const total = statuses.reduce((s, x) => s + x.count, 0);

  return (
    <div className="space-y-2">
      {statuses.slice(0, 6).map((s) => (
        <div key={s.status} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-[var(--color-text-secondary)]">
                {s.status.replace(/_/g, ' ')}
              </span>
              <span className="font-semibold text-[var(--color-text-primary)]">{s.count}</span>
            </div>
            <div className="mt-0.5 h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)]">
              <div
                className="h-1.5 rounded-full bg-[var(--color-brand-500)]"
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: Lot Map
// ---------------------------------------------------------------------------

function LotMapWidget() {
  return (
    <div className="flex flex-col items-center justify-center py-4">
      <MapPin className="h-10 w-10 text-[var(--color-text-tertiary)]" />
      <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">Interactive lot map</p>
      <Link
        href="/map"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand-500)] hover:text-[var(--color-brand-400)]"
      >
        View Lot Map <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Widget: Quick Actions
// ---------------------------------------------------------------------------

function QuickActionsWidget() {
  const actions = [
    { label: 'Add Unit', href: '/inventory', icon: Plus },
    { label: 'Search', href: '/inventory', icon: Search },
    { label: 'Start Audit', href: '/audits', icon: Clock },
    { label: 'Service Bays', href: '/service/bays', icon: Wrench },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-center transition-colors hover:border-[var(--color-brand-500)] hover:bg-[var(--color-bg-tertiary)]"
        >
          <a.icon className="h-5 w-5 text-[var(--color-brand-500)]" />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonWidget() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-16 w-16 animate-pulse rounded-lg bg-[var(--color-bg-tertiary)]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export default function WidgetRenderer({ widgetId }: { widgetId: string }) {
  switch (widgetId) {
    case 'inventory_summary':
      return <InventorySummaryWidget />;
    case 'tracker_health':
      return <TrackerHealth />;
    case 'alert_feed':
      return <AlertFeedWidget />;
    case 'aging_chart':
      return <AgingChartWidget />;
    case 'lot_utilization':
      return <LotMapWidget />;
    case 'recent_activity':
      return <ActivityFeed />;
    case 'unit_status_breakdown':
      return <StatusBreakdownWidget />;
    case 'quick_actions':
      return <QuickActionsWidget />;
    default:
      return (
        <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-tertiary)]">
          Unknown widget: {widgetId}
        </div>
      );
  }
}
