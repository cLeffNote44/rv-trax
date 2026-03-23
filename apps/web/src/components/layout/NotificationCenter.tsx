'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, AlertTriangle, Info, AlertCircle, Check } from 'lucide-react';
import { getAlerts, acknowledgeAlert } from '@/lib/api';
import type { Alert } from '@rv-trax/shared';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical':
      return <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 flex-shrink-0 text-blue-500" />;
  }
}

function severityDotColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    default:
      return 'bg-blue-500';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAlerts({ limit: 10, status: 'new_alert' });
      const items = res.data ?? [];
      setAlerts(items);
      setUnreadCount(items.length);
    } catch {
      // Silently fail — bell just shows 0
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await Promise.all(alerts.map((a) => acknowledgeAlert(a.id)));
      setAlerts([]);
      setUnreadCount(0);
    } catch {
      // Silently fail
    } finally {
      setMarkingAll(false);
    }
  };

  // Toggle panel and refresh data on open
  const handleToggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) fetchAlerts();
  };

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${unreadCount} unread notifications`}
        className="relative rounded-lg p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Notifications
            </h3>
            {alerts.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-50 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Check className="h-3 w-3" />
                {markingAll ? 'Marking...' : 'Mark all as read'}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {loading && alerts.length === 0 ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-4 w-4 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Bell className="mb-2 h-8 w-8 text-[var(--color-text-tertiary)]" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  No new notifications
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                  You&apos;re all caught up
                </p>
              </div>
            ) : (
              alerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => {
                    setOpen(false);
                    router.push('/alerts');
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)]',
                    'border-b border-[var(--color-border)] last:border-0',
                  )}
                >
                  {/* Severity icon */}
                  <div className="mt-0.5">{severityIcon(alert.severity)}</div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                        {alert.title}
                      </p>
                      {/* Unread dot */}
                      <span
                        className={cn(
                          'h-2 w-2 flex-shrink-0 rounded-full',
                          severityDotColor(alert.severity),
                        )}
                      />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-tertiary)]">
                      {alert.message}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--color-text-tertiary)]">
                      {timeAgo(alert.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--color-border)] px-4 py-2.5">
            <button
              onClick={() => {
                setOpen(false);
                router.push('/alerts');
              }}
              className="w-full text-center text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
