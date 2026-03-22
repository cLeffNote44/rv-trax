'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  CheckCircle2,
  DollarSign,
  Wrench,
  Clock,
  Search,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import type { Unit, Alert } from '@rv-trax/shared';
import { UnitStatus, AlertStatus, AlertSeverity } from '@rv-trax/shared';
import MetricCard from './components/MetricCard';
import ActivityFeed from './components/ActivityFeed';
import TrackerHealth from './components/TrackerHealth';

interface DashboardMetrics {
  totalUnits: number;
  available: number;
  soldThisMonth: number;
  inService: number;
  avgDaysOnLot: number;
}

interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
}

function computeMetrics(units: Unit[]): DashboardMetrics {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalDays = 0;
  let countForAvg = 0;

  const metrics: DashboardMetrics = {
    totalUnits: units.length,
    available: 0,
    soldThisMonth: 0,
    inService: 0,
    avgDaysOnLot: 0,
  };

  for (const unit of units) {
    if (unit.status === UnitStatus.AVAILABLE || unit.status === UnitStatus.LOT_READY) {
      metrics.available++;
    }
    if (
      (unit.status === UnitStatus.SOLD ||
        unit.status === UnitStatus.PENDING_DELIVERY ||
        unit.status === UnitStatus.DELIVERED) &&
      new Date(unit.updated_at) >= monthStart
    ) {
      metrics.soldThisMonth++;
    }
    if (unit.status === UnitStatus.IN_SERVICE) {
      metrics.inService++;
    }

    const arrivedDate = new Date(unit.created_at);
    const daysOnLot = Math.floor(
      (now.getTime() - arrivedDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (
      unit.status !== UnitStatus.SOLD &&
      unit.status !== UnitStatus.DELIVERED &&
      unit.status !== UnitStatus.ARCHIVED
    ) {
      totalDays += daysOnLot;
      countForAvg++;
    }
  }

  metrics.avgDaysOnLot = countForAvg > 0 ? Math.round(totalDays / countForAvg) : 0;
  return metrics;
}

function computeAlertSummary(alerts: Alert[]): AlertSummary {
  const summary: AlertSummary = { total: 0, critical: 0, warning: 0, info: 0 };
  for (const alert of alerts) {
    if (alert.status === AlertStatus.NEW_ALERT) {
      summary.total++;
      if (alert.severity === AlertSeverity.CRITICAL) summary.critical++;
      else if (alert.severity === AlertSeverity.WARNING) summary.warning++;
      else summary.info++;
    }
  }
  return summary;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const api = await import('@/lib/api');
        const [unitsRes, alertsRes] = await Promise.all([
          api.getUnits({}),
          api.getAlerts({}),
        ]);

        if (!cancelled) {
          setMetrics(computeMetrics(unitsRes.data));
          setAlertSummary(computeAlertSummary(alertsRes.data));
        }
      } catch {
        // Keep loading state so skeletons remain
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/inventory?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Overview of your lot inventory and tracker health
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[120px] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            />
          ))
        ) : metrics ? (
          <>
            <MetricCard
              title="Total Units"
              value={metrics.totalUnits}
              icon={Package}
            />
            <MetricCard
              title="Available"
              value={metrics.available}
              icon={CheckCircle2}
              color="green"
            />
            <MetricCard
              title="Sold This Month"
              value={metrics.soldThisMonth}
              icon={DollarSign}
              color="red"
            />
            <MetricCard
              title="In Service"
              value={metrics.inService}
              icon={Wrench}
              color="yellow"
            />
            <MetricCard
              title="Avg Days on Lot"
              value={metrics.avgDaysOnLot}
              icon={Clock}
              color="blue"
            />
          </>
        ) : null}
      </div>

      {/* Second Row: Tracker Health + Quick Search + Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tracker Health */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
            Tracker Health
          </h2>
          <TrackerHealth />
        </div>

        {/* Quick Search */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
            Quick Search
          </h2>
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Stock #, VIN, make, model..."
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-2.5 pl-10 pr-4 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]/20"
              />
            </div>
            <button
              type="submit"
              className="mt-3 w-full rounded-lg bg-[var(--color-brand-600)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-700)]"
            >
              Search Inventory
            </button>
          </form>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Quick links
            </p>
            <Link
              href="/inventory?status=new_arrival"
              className="block text-sm text-[var(--color-brand-500)] hover:text-[var(--color-brand-400)]"
            >
              New Arrivals
            </Link>
            <Link
              href="/inventory?status=pdi_pending"
              className="block text-sm text-[var(--color-brand-500)] hover:text-[var(--color-brand-400)]"
            >
              PDI Pending
            </Link>
            <Link
              href="/inventory?status=hold"
              className="block text-sm text-[var(--color-brand-500)] hover:text-[var(--color-brand-400)]"
            >
              Units on Hold
            </Link>
          </div>
        </div>

        {/* Alerts Card */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Alerts</h2>
            <Link
              href="/alerts"
              className="text-sm font-medium text-[var(--color-brand-500)] hover:text-[var(--color-brand-400)]"
            >
              View All
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-10 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-10 rounded bg-[var(--color-bg-tertiary)]" />
              <div className="h-10 rounded bg-[var(--color-bg-tertiary)]" />
            </div>
          ) : alertSummary ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg bg-[var(--color-bg-secondary)] p-3">
                <AlertTriangle className="h-5 w-5 text-[var(--color-text-secondary)]" />
                <div>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {alertSummary.total}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Unacknowledged alerts
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-sm text-[var(--color-text-secondary)]">Critical</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {alertSummary.critical}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    <span className="text-sm text-[var(--color-text-secondary)]">Warning</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {alertSummary.warning}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="text-sm text-[var(--color-text-secondary)]">Info</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {alertSummary.info}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">Unable to load alerts</p>
          )}
        </div>
      </div>

      {/* Third Row: Activity Feed + Lot Map Thumbnail */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
            Recent Activity
          </h2>
          <ActivityFeed />
        </div>

        {/* Mini Lot Map */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
          <div className="p-5">
            <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
              Lot Map
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              See your units on the interactive lot map
            </p>
          </div>
          <div className="relative flex h-[260px] items-center justify-center bg-[var(--color-bg-tertiary)]">
            <div className="text-center">
              <MapPin className="mx-auto h-12 w-12 text-[var(--color-text-tertiary)]" />
              <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
                Interactive lot map preview
              </p>
            </div>
          </div>
          <div className="p-4">
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-500)] hover:text-[var(--color-brand-400)]"
            >
              View Lot Map
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
