'use client';

import type { Gateway } from '@rv-trax/shared';
import { GatewayStatus } from '@rv-trax/shared';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, formatRelativeTime } from '@/lib/utils';

interface GatewayCardProps {
  gateway: Gateway;
}

const backhaulLabels: Record<string, string> = {
  ethernet: 'Ethernet',
  cellular: 'Cellular',
  wifi: 'WiFi',
};

const backhaulColors: Record<string, string> = {
  ethernet: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  cellular: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  wifi: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
};

export function GatewayCard({ gateway }: GatewayCardProps) {
  const isOnline = gateway.status === GatewayStatus.ONLINE;
  const isOffline = gateway.status === GatewayStatus.OFFLINE;

  return (
    <Card className={cn('relative overflow-hidden', isOffline && 'ring-2 ring-red-300 dark:ring-red-700')}>
      {/* Offline Warning Banner */}
      {isOffline && (
        <div className="bg-red-50 px-4 py-2 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
          Offline
          {gateway.last_seen_at && (
            <> &mdash; Last seen {formatRelativeTime(gateway.last_seen_at)}</>
          )}
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                isOnline ? 'bg-green-500' : 'bg-red-500'
              )}
            />
            <h3 className="font-semibold text-[var(--color-text-primary)]">
              {gateway.label || 'Unnamed Gateway'}
            </h3>
          </div>
          <Badge
            className={cn(
              'text-xs',
              backhaulColors[gateway.backhaul_type] ?? backhaulColors.ethernet
            )}
          >
            {backhaulLabels[gateway.backhaul_type] ?? gateway.backhaul_type}
          </Badge>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">EUI</span>
            <span className="font-mono text-xs">{gateway.device_eui}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Status</span>
            <span
              className={cn(
                'font-medium',
                isOnline ? 'text-green-600' : 'text-red-600'
              )}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {gateway.last_seen_at && (
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Last Seen</span>
              <span className="text-[var(--color-text-secondary)]">
                {formatRelativeTime(gateway.last_seen_at)}
              </span>
            </div>
          )}

          {gateway.ip_address && (
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">IP Address</span>
              <span className="font-mono text-xs">{gateway.ip_address}</span>
            </div>
          )}

          {gateway.firmware_version && (
            <div className="flex justify-between">
              <span className="text-[var(--color-text-secondary)]">Firmware</span>
              <span className="text-xs">{gateway.firmware_version}</span>
            </div>
          )}
        </div>

        {/* Mini Stats Bar */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-[var(--color-bg-secondary)] p-2">
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-tertiary)]">Received</p>
            <p className="text-sm font-semibold">--</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-tertiary)]">Forwarded</p>
            <p className="text-sm font-semibold">--</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-tertiary)]">Loss Rate</p>
            <p className="text-sm font-semibold">--</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
