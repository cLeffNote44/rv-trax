'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Link2,
  Unlink,
  LogIn,
  LogOut,
  UserPlus,
  ArrowRightLeft,
  Activity,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import type { AuditLogEntry, AuditAction } from '@rv-trax/shared';

const actionIconMap: Record<string, typeof Activity> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  assign: Link2,
  unassign: Unlink,
  login: LogIn,
  logout: LogOut,
  invite: UserPlus,
  status_change: ArrowRightLeft,
};

const actionColorMap: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-600',
  update: 'bg-blue-100 text-blue-600',
  delete: 'bg-red-100 text-red-600',
  assign: 'bg-purple-100 text-purple-600',
  unassign: 'bg-slate-100 text-slate-600',
  login: 'bg-sky-100 text-sky-600',
  logout: 'bg-slate-100 text-slate-500',
  invite: 'bg-indigo-100 text-indigo-600',
  status_change: 'bg-amber-100 text-amber-600',
};

function formatActionDescription(entry: AuditLogEntry): string {
  const entity = entry.entity_type.replace(/_/g, ' ');
  switch (entry.action) {
    case 'create':
      return `Created ${entity}`;
    case 'update':
      return `Updated ${entity}`;
    case 'delete':
      return `Deleted ${entity}`;
    case 'assign':
      return `Assigned ${entity}`;
    case 'unassign':
      return `Unassigned ${entity}`;
    case 'login':
      return 'User logged in';
    case 'logout':
      return 'User logged out';
    case 'invite':
      return 'Invited new user';
    case 'status_change':
      return `Changed ${entity} status`;
    default:
      return `${entry.action} on ${entity}`;
  }
}

export default function ActivityFeed() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchActivity() {
      try {
        const { getAuditLog } = await import('@/lib/api');
        const response = await getAuditLog({ limit: 20 });
        if (!cancelled) {
          setEntries(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load activity');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchActivity();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/3 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-500">
        {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-slate-500">
        No recent activity
      </div>
    );
  }

  return (
    <div className="max-h-[400px] space-y-1 overflow-y-auto pr-1">
      {entries.map((entry) => {
        const IconComponent = actionIconMap[entry.action] ?? Activity;
        const colorClass =
          actionColorMap[entry.action] ?? 'bg-slate-100 text-slate-600';

        return (
          <div
            key={entry.id}
            className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClass}`}
            >
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-700">
                {formatActionDescription(entry)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatRelativeTime(entry.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
