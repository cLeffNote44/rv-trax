'use client';

import { useEffect, useState, useCallback } from 'react';
import { getGateways } from '@/lib/api';
import type { Gateway } from '@rv-trax/shared';
import { GatewayStatus } from '@rv-trax/shared';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { GatewayCard } from './components/GatewayCard';
import { GatewayHealthChart } from './components/GatewayHealthChart';

export default function GatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGateways = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGateways();
      setGateways(data);
    } catch (err) {
      console.error('Failed to fetch gateways:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  const onlineCount = gateways.filter(
    (g) => g.status === GatewayStatus.ONLINE
  ).length;
  const offlineCount = gateways.filter(
    (g) => g.status === GatewayStatus.OFFLINE
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Gateways
        </h1>
        <Badge variant="default">{gateways.length}</Badge>
      </div>

      {/* Summary */}
      <div className="flex gap-4">
        <Card className="flex items-center gap-3 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">Online</p>
            <p className="text-xl font-bold text-green-600">{onlineCount}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">Offline</p>
            <p className="text-xl font-bold text-red-600">{offlineCount}</p>
          </div>
        </Card>
      </div>

      {/* Gateway Health Chart */}
      <GatewayHealthChart gateways={gateways} />

      {/* Gateway Cards Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse p-6">
              <div className="mb-4 h-5 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-2">
                <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-36 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </Card>
          ))}
        </div>
      ) : gateways.length === 0 ? (
        <Card className="p-12 text-center text-[var(--color-text-tertiary)]">
          No gateways registered. Add gateways to begin monitoring.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gateways.map((gateway) => (
            <GatewayCard key={gateway.id} gateway={gateway} />
          ))}
        </div>
      )}

      {/* Gateway Map Placeholder */}
      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          Gateway Map
        </h3>
        <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="text-center">
            <svg
              className="mx-auto mb-2 h-10 w-10 text-[var(--color-text-tertiary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
              />
            </svg>
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Map view showing gateway positions on the lot
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Map integration coming in a future update
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
