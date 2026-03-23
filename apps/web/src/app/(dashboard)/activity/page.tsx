'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Filter,
  User,
  TrendingUp,
  Clock,
  Zap,
  Package,
  Radio,
  Wrench,
  Car,
  ClipboardCheck,
  Camera,
  ArrowRight,
} from 'lucide-react';
import { getStaffActivity, getStaffActivityStats, getUsers } from '@/lib/api';
import type { StaffActivityEntry } from '@/lib/api';
import type { User as UserType } from '@rv-trax/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

// ---------------------------------------------------------------------------
// Action display config
// ---------------------------------------------------------------------------

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  moved_unit: { label: 'Moved Unit', icon: Package, color: 'text-blue-500' },
  changed_status: { label: 'Changed Status', icon: ArrowRight, color: 'text-purple-500' },
  started_service: { label: 'Started Service', icon: Wrench, color: 'text-amber-500' },
  completed_service: { label: 'Completed Service', icon: Wrench, color: 'text-green-500' },
  assigned_tracker: { label: 'Assigned Tracker', icon: Radio, color: 'text-cyan-500' },
  unassigned_tracker: { label: 'Unassigned Tracker', icon: Radio, color: 'text-gray-500' },
  started_test_drive: { label: 'Started Test Drive', icon: Car, color: 'text-blue-500' },
  completed_test_drive: { label: 'Completed Test Drive', icon: Car, color: 'text-green-500' },
  started_audit: { label: 'Started Audit', icon: ClipboardCheck, color: 'text-amber-500' },
  completed_audit: { label: 'Completed Audit', icon: ClipboardCheck, color: 'text-green-500' },
  verified_unit: { label: 'Verified Unit', icon: ClipboardCheck, color: 'text-green-500' },
  checked_in_bay: { label: 'Checked In Bay', icon: Wrench, color: 'text-blue-500' },
  checked_out_bay: { label: 'Checked Out Bay', icon: Wrench, color: 'text-green-500' },
  advanced_stage: { label: 'Advanced Stage', icon: ArrowRight, color: 'text-purple-500' },
  created_work_order: { label: 'Created Work Order', icon: Wrench, color: 'text-blue-500' },
  uploaded_photo: { label: 'Uploaded Photo', icon: Camera, color: 'text-pink-500' },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? { label: action, icon: Activity, color: 'text-gray-500' };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--color-border)] px-4 py-3">
      <Skeleton variant="circle" className="h-9 w-9" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StaffActivityPage() {
  const [activities, setActivities] = useState<StaffActivityEntry[]>([]);
  const [stats, setStats] = useState<{
    per_user: { user_id: string; action_count: number }[];
    by_action: { action: string; action_count: number }[];
    actions_today: number;
    days: number;
  } | null>(null);
  const [users, setUsersList] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>('');

  const userMap = new Map(users.map((u) => [u.id, u]));

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [actRes, statsRes, usersRes] = await Promise.all([
        getStaffActivity({
          limit: 100,
          action: filterAction || undefined,
          user_id: filterUser || undefined,
        }),
        getStaffActivityStats(7),
        getUsers(),
      ]);
      setActivities(actRes.data);
      setStats(statsRes.data);
      setUsersList(usersRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterUser]);

  useEffect(() => {
    load();
  }, [load]);

  const uniqueActions = Array.from(new Set(activities.map((a) => a.action))).sort();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <PageHeader
        icon={Activity}
        title="Staff Activity"
        description="Track who did what across your dealership"
        actions={
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.actions_today}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">Actions Today</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <User className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.per_user.length}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">Active Staff (7d)</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.by_action.length}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">Action Types (7d)</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {stats.per_user.length > 0
                    ? Math.round(
                        stats.by_action.reduce((s, a) => s + a.action_count, 0) /
                          stats.per_user.length,
                      )
                    : 0}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Avg Actions / Staff (7d)
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Error */}
      {error && <AlertBanner variant="error" message={error} onRetry={load} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-[var(--color-text-tertiary)]" />
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
        >
          <option value="">All Staff</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
        >
          <option value="">All Actions</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>
              {getActionConfig(a).label}
            </option>
          ))}
        </select>
      </div>

      {/* Activity Feed */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-sm">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Activity Feed
          </h2>
        </div>
        {loading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity recorded yet"
            description="Staff actions will appear here as they happen"
          />
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {activities.map((entry) => {
              const config = getActionConfig(entry.action);
              const Icon = config.icon;
              const user = entry.user_id ? userMap.get(entry.user_id) : null;
              const meta = entry.metadata as Record<string, string> | null;

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[var(--color-bg-secondary)]"
                >
                  {/* Icon */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]`}
                  >
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--color-text-primary)]">
                      <span className="font-medium">{user?.name ?? 'System'}</span>{' '}
                      <span className="text-[var(--color-text-secondary)]">
                        {config.label.toLowerCase()}
                      </span>
                      {entry.entity_label && (
                        <span className="font-medium"> {entry.entity_label}</span>
                      )}
                    </p>
                    {meta && (meta.from_status || meta.to_status) && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                        {meta.from_status} → {meta.to_status}
                      </p>
                    )}
                    {meta && meta.from_zone && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                        Zone: {meta.from_zone} → {meta.to_zone}
                      </p>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="shrink-0 text-xs text-[var(--color-text-tertiary)]">
                    {timeAgo(entry.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Performers */}
      {stats && stats.per_user.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top Staff */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
              Most Active Staff (7d)
            </h3>
            <div className="space-y-3">
              {stats.per_user.slice(0, 5).map((item, idx) => {
                const u = userMap.get(item.user_id);
                const maxCount = stats.per_user[0]?.action_count ?? 1;
                return (
                  <div key={item.user_id} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs font-bold text-[var(--color-text-tertiary)]">
                      {idx + 1}
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-brand-500)] text-[10px] font-bold text-white">
                      {u?.name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) ?? '??'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {u?.name ?? item.user_id.slice(0, 8)}
                        </span>
                        <span className="ml-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                          {item.action_count}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)]">
                        <div
                          className="h-1.5 rounded-full bg-[var(--color-brand-500)]"
                          style={{
                            width: `${(item.action_count / maxCount) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions Breakdown */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-[var(--color-text-primary)]">
              Action Breakdown (7d)
            </h3>
            <div className="space-y-3">
              {stats.by_action.slice(0, 8).map((item) => {
                const cfg = getActionConfig(item.action);
                const Ic = cfg.icon;
                const maxCount = stats.by_action[0]?.action_count ?? 1;
                return (
                  <div key={item.action} className="flex items-center gap-3">
                    <Ic className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm text-[var(--color-text-primary)]">
                          {cfg.label}
                        </span>
                        <span className="ml-2 text-xs font-semibold text-[var(--color-text-secondary)]">
                          {item.action_count}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)]">
                        <div
                          className="h-1.5 rounded-full bg-[var(--color-brand-500)]"
                          style={{
                            width: `${(item.action_count / maxCount) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
