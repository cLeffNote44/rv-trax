'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAlerts, acknowledgeAlert, dismissAlert, snoozeAlert } from '@/lib/api';
import type { Alert, PaginatedResponse } from '@rv-trax/shared';
import { AlertStatus, AlertSeverity } from '@rv-trax/shared';
import { Bell, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
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

  const unacknowledgedCount = alerts.filter((a) => a.status === AlertStatus.NEW_ALERT).length;

  const filteredAlerts = alerts.filter((alert) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'acknowledged') return alert.status === AlertStatus.ACKNOWLEDGED;
    if (activeTab === 'critical') return alert.severity === AlertSeverity.CRITICAL;
    if (activeTab === 'warning') return alert.severity === AlertSeverity.WARNING;
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
      <PageHeader
        icon={Bell}
        title="Alerts"
        badge={
          unacknowledgedCount > 0 ? (
            <Badge variant="error">{unacknowledgedCount} unacknowledged</Badge>
          ) : undefined
        }
        actions={
          <a
            href="/settings/notifications"
            className="text-sm font-medium text-[var(--color-brand-600)] hover:underline"
          >
            Alert Rules
          </a>
        }
      />

      {/* Filter Tabs */}
      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as FilterTab)} items={FILTER_TABS} />

      {/* Alert List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No alerts match the current filter" />
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
