'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAlerts, acknowledgeAlert, dismissAlert, snoozeAlert } from '@/lib/api';
import type { Alert, PaginatedResponse } from '@rv-trax/shared';
import { AlertStatus, AlertSeverity } from '@rv-trax/shared';
import { Badge } from '@/components/ui/Badge';
import { AlertCard } from './components/AlertCard';

type FilterTab = 'all' | 'critical' | 'warning' | 'info' | 'acknowledged';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
  { value: 'acknowledged', label: 'Acknowledged' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const response: PaginatedResponse<Alert> = await getAlerts();
      setAlerts(response.data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const unacknowledgedCount = alerts.filter(
    (a) => a.status === AlertStatus.NEW_ALERT
  ).length;

  const filteredAlerts = alerts.filter((alert) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'acknowledged')
      return alert.status === AlertStatus.ACKNOWLEDGED;
    if (activeTab === 'critical')
      return alert.severity === AlertSeverity.CRITICAL;
    if (activeTab === 'warning')
      return alert.severity === AlertSeverity.WARNING;
    if (activeTab === 'info') return alert.severity === AlertSeverity.INFO;
    return true;
  });

  const handleAcknowledge = async (alertId: string) => {
    try {
      await acknowledgeAlert(alertId);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await dismissAlert(alertId);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  const handleSnooze = async (alertId: string, hours: number) => {
    try {
      await snoozeAlert(alertId, hours);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to snooze alert:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Alerts
          </h1>
          {unacknowledgedCount > 0 && (
            <Badge variant="error">{unacknowledgedCount} unacknowledged</Badge>
          )}
        </div>
        <a
          href="/settings/notifications"
          className="text-sm font-medium text-[var(--color-brand-600)] hover:underline"
        >
          Alert Rules
        </a>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--color-bg-secondary)] p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-white text-[var(--color-text-primary)] shadow-sm dark:bg-[var(--color-bg-tertiary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-[var(--color-border)] p-4"
            >
              <div className="mb-2 h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-64 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] p-12 text-center">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-[var(--color-text-tertiary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            No alerts match the current filter.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onDismiss={handleDismiss}
              onSnooze={handleSnooze}
            />
          ))}
        </div>
      )}
    </div>
  );
}
