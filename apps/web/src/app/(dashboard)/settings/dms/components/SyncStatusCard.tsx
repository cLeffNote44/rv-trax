'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
} from 'lucide-react';
import { getDmsSyncHistory, triggerDmsSync, type DmsSyncLog } from '@/lib/api';

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return 'Running...';
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SyncStatusCard() {
  const [history, setHistory] = useState<DmsSyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const result = await getDmsSyncHistory();
      setHistory(result);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await triggerDmsSync();
      // Reload history after a brief delay for the sync to register
      setTimeout(loadHistory, 1500);
    } catch {
      // handled by global error
    } finally {
      setSyncing(false);
    }
  }

  const lastSync = history[0];
  const totalCreated = history.reduce((s, l) => s + l.units_created, 0);
  const totalUpdated = history.reduce((s, l) => s + l.units_updated, 0);
  const totalErrors = history.reduce((s, l) => s + l.errors, 0);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
        <div className="h-5 w-48 rounded bg-[var(--color-bg-tertiary)]" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-[var(--color-bg-tertiary)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
          <RefreshCw className="h-5 w-5 text-[var(--color-brand-600)]" />
          Sync Dashboard
        </h3>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-600)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-brand-700)] disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sync Now
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-[var(--color-bg-secondary)] p-3">
          <div className="text-xs text-[var(--color-text-tertiary)]">Last Sync</div>
          <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
            {lastSync ? formatRelativeTime(lastSync.started_at) : 'Never'}
          </div>
        </div>
        <div className="rounded-lg bg-green-50 p-3">
          <div className="text-xs text-green-600">Units Created</div>
          <div className="mt-1 text-xl font-bold text-green-700">{totalCreated}</div>
        </div>
        <div className="rounded-lg bg-blue-50 p-3">
          <div className="text-xs text-blue-600">Units Updated</div>
          <div className="mt-1 text-xl font-bold text-blue-700">{totalUpdated}</div>
        </div>
        <div className="rounded-lg bg-red-50 p-3">
          <div className="text-xs text-red-600">Errors</div>
          <div className="mt-1 text-xl font-bold text-red-700">{totalErrors}</div>
        </div>
      </div>

      {/* Sync history table */}
      {history.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--color-text-tertiary)]">
                  Direction
                </th>
                <th className="py-2 pr-4 text-left text-xs font-medium text-[var(--color-text-tertiary)]">
                  When
                </th>
                <th className="py-2 pr-4 text-right text-xs font-medium text-[var(--color-text-tertiary)]">
                  Created
                </th>
                <th className="py-2 pr-4 text-right text-xs font-medium text-[var(--color-text-tertiary)]">
                  Updated
                </th>
                <th className="py-2 pr-4 text-right text-xs font-medium text-[var(--color-text-tertiary)]">
                  Errors
                </th>
                <th className="py-2 text-right text-xs font-medium text-[var(--color-text-tertiary)]">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map((log) => (
                <tr key={log.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-primary)]">
                      {log.direction === 'pull' ? (
                        <ArrowDownToLine className="h-3.5 w-3.5 text-blue-500" />
                      ) : (
                        <ArrowUpFromLine className="h-3.5 w-3.5 text-green-500" />
                      )}
                      {log.direction === 'pull' ? 'Pull' : 'Push'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-[var(--color-text-secondary)]">
                    {formatRelativeTime(log.started_at)}
                  </td>
                  <td className="py-2.5 pr-4 text-right text-green-600">{log.units_created}</td>
                  <td className="py-2.5 pr-4 text-right text-blue-600">{log.units_updated}</td>
                  <td className="py-2.5 pr-4 text-right">
                    {log.errors > 0 ? (
                      <span className="flex items-center justify-end gap-1 text-red-600">
                        <AlertTriangle className="h-3 w-3" />
                        {log.errors}
                      </span>
                    ) : (
                      <CheckCircle className="ml-auto h-3.5 w-3.5 text-green-500" />
                    )}
                  </td>
                  <td className="py-2.5 text-right text-[var(--color-text-tertiary)]">
                    {formatDuration(log.started_at, log.completed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length === 0 && (
        <div className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">
          <Clock className="mx-auto mb-2 h-8 w-8" />
          No sync history yet. Configure your DMS integration above to get started.
        </div>
      )}
    </div>
  );
}
