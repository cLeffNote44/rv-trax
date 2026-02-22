'use client';

import { useState, useCallback } from 'react';
import {
  RefreshCw,
  Settings,
  Unplug,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Database,
} from 'lucide-react';
import type { DmsIntegration, DmsSyncLog } from '@rv-trax/shared';
import { DmsProvider, DmsSyncStatus } from '@rv-trax/shared';
import {
  getDmsIntegration,
  configureDms,
  triggerDmsSync,
  getDmsSyncHistory,
  disconnectDms,
} from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface ProviderInfo {
  id: string;
  name: string;
  description: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: DmsProvider.IDS_ASTRA,
    name: 'IDS Astra',
    description: 'Full two-way sync with IDS Astra G2 dealer management system.',
  },
  {
    id: DmsProvider.LIGHTSPEED,
    name: 'Lightspeed EVO',
    description: 'Connect to Lightspeed EVO for RV and marine dealerships.',
  },
  {
    id: DmsProvider.MOTILITY,
    name: 'Motility',
    description: 'Integrate with Motility for comprehensive inventory management.',
  },
  {
    id: DmsProvider.DEALER_CLICK,
    name: 'DealerClick',
    description: 'Sync inventory data with DealerClick cloud-based DMS.',
  },
  {
    id: DmsProvider.CSV_IMPORT,
    name: 'CSV Import',
    description: 'Upload CSV files manually to sync your inventory data.',
  },
];

const SYNC_STATUS_COLORS: Record<string, 'default' | 'info' | 'success' | 'error'> = {
  [DmsSyncStatus.IDLE]: 'default',
  [DmsSyncStatus.SYNCING]: 'info',
  [DmsSyncStatus.SUCCESS]: 'success',
  [DmsSyncStatus.ERROR]: 'error',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DmsIntegrationPage() {
  const {
    data: integration,
    isLoading: loadingIntegration,
    refetch: refetchIntegration,
  } = useApi<DmsIntegration | null>(() => getDmsIntegration(), []);

  const {
    data: syncHistory,
    isLoading: loadingSyncHistory,
    refetch: refetchHistory,
  } = useApi<DmsSyncLog[]>(() => getDmsSyncHistory(), []);

  // Setup wizard
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState(false);
  const [configError, setConfigError] = useState('');

  // Config fields (simple key/value for now)
  const [configApiKey, setConfigApiKey] = useState('');
  const [configEndpoint, setConfigEndpoint] = useState('');

  // Sync
  const [syncing, setSyncing] = useState(false);

  // Disconnect
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConfigure = async () => {
    if (!selectedProvider) return;
    setConfiguring(true);
    setConfigError('');
    try {
      const config: Record<string, unknown> = {};
      if (selectedProvider !== DmsProvider.CSV_IMPORT) {
        config.api_key = configApiKey;
        config.endpoint = configEndpoint;
      }
      await configureDms({ provider: selectedProvider, config });
      setSelectedProvider(null);
      setConfigApiKey('');
      setConfigEndpoint('');
      refetchIntegration();
      refetchHistory();
    } catch (err) {
      setConfigError(
        err instanceof Error ? err.message : 'Failed to configure DMS integration.'
      );
    } finally {
      setConfiguring(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerDmsSync();
      refetchIntegration();
      refetchHistory();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectDms();
      setDisconnectOpen(false);
      refetchIntegration();
      refetchHistory();
    } catch (err) {
      console.error('Failed to disconnect DMS:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const providerName = useCallback(
    (providerId: string) =>
      PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId,
    []
  );

  const formatDuration = (start: string, end: string | null): string => {
    if (!end) return 'In progress';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    const secs = Math.round(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ${secs % 60}s`;
  };

  // Loading
  if (loadingIntegration) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <a
            href="/settings"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Settings
          </a>
          <span className="text-[var(--color-text-tertiary)]">/</span>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            DMS Integration
          </h1>
        </div>
        <Card className="animate-pulse p-6">
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 rounded bg-gray-200 dark:bg-gray-700"
              />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // No integration configured -- show setup wizard
  if (!integration) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <a
            href="/settings"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Settings
          </a>
          <span className="text-[var(--color-text-tertiary)]">/</span>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            DMS Integration
          </h1>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Connect your Dealer Management System to automatically sync inventory
          data with RV Trax.
        </p>

        {/* Provider Selection */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDERS.map((provider) => (
            <Card
              key={provider.id}
              className={`cursor-pointer p-5 transition-all hover:shadow-md ${
                selectedProvider === provider.id
                  ? 'ring-2 ring-blue-500'
                  : ''
              }`}
              onClick={() => setSelectedProvider(provider.id)}
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-bg-secondary)]">
                <Database className="h-6 w-6 text-[var(--color-text-secondary)]" />
              </div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">
                {provider.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {provider.description}
              </p>
            </Card>
          ))}
        </div>

        {/* Config form for selected provider */}
        {selectedProvider && (
          <Card className="max-w-lg p-6">
            <h3 className="mb-4 font-semibold text-[var(--color-text-primary)]">
              Configure {providerName(selectedProvider)}
            </h3>
            <div className="space-y-4">
              {selectedProvider !== DmsProvider.CSV_IMPORT && (
                <>
                  <Input
                    label="API Key / Token"
                    placeholder="Enter your DMS API key"
                    value={configApiKey}
                    onChange={(e) => setConfigApiKey(e.target.value)}
                    type="password"
                  />
                  <Input
                    label="Endpoint URL"
                    placeholder="https://api.your-dms.com/v1"
                    value={configEndpoint}
                    onChange={(e) => setConfigEndpoint(e.target.value)}
                  />
                </>
              )}

              {configError && (
                <p className="text-sm text-red-600">{configError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedProvider(null);
                    setConfigApiKey('');
                    setConfigEndpoint('');
                    setConfigError('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfigure}
                  isLoading={configuring}
                  disabled={
                    configuring ||
                    (selectedProvider !== DmsProvider.CSV_IMPORT &&
                      (!configApiKey.trim() || !configEndpoint.trim()))
                  }
                >
                  Connect
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // Integration exists -- show status and controls
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <a
          href="/settings"
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Settings
        </a>
        <span className="text-[var(--color-text-tertiary)]">/</span>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          DMS Integration
        </h1>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Provider */}
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Provider
              </span>
              <p className="mt-1 font-medium text-[var(--color-text-primary)]">
                {providerName(integration.provider)}
              </p>
            </div>

            {/* Sync Status */}
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Sync Status
              </span>
              <div className="mt-1">
                <Badge
                  variant={
                    SYNC_STATUS_COLORS[integration.sync_status] ?? 'default'
                  }
                >
                  {integration.sync_status === DmsSyncStatus.SYNCING && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {integration.sync_status === DmsSyncStatus.SUCCESS && (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  )}
                  {integration.sync_status === DmsSyncStatus.ERROR && (
                    <AlertCircle className="mr-1 h-3 w-3" />
                  )}
                  {integration.sync_status === DmsSyncStatus.IDLE && (
                    <Clock className="mr-1 h-3 w-3" />
                  )}
                  {integration.sync_status}
                </Badge>
              </div>
            </div>

            {/* Last Sync */}
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Last Sync
              </span>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {integration.last_sync_at
                  ? formatRelativeTime(integration.last_sync_at)
                  : 'Never'}
              </p>
            </div>

            {/* Last Error */}
            {integration.last_error && (
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Last Error
                </span>
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {integration.last_error}
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 border-t border-[var(--color-border)] pt-4">
            <Button
              onClick={handleSync}
              isLoading={syncing}
              disabled={syncing}
            >
              <RefreshCw className="h-4 w-4" />
              Sync Now
            </Button>
            <Button variant="outline">
              <Settings className="h-4 w-4" />
              Configure
            </Button>
            <Button
              variant="ghost"
              className="text-red-600"
              onClick={() => setDisconnectOpen(true)}
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
        </CardHeader>
        {loadingSyncHistory ? (
          <div className="animate-pulse p-6">
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded bg-gray-200 dark:bg-gray-700"
                />
              ))}
            </div>
          </div>
        ) : !syncHistory || syncHistory.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--color-text-tertiary)]">
            No sync history yet. Trigger a sync to see results here.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Units Created</TableHead>
                <TableHead>Units Updated</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncHistory.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {log.direction === 'pull' ? (
                        <ArrowDownToLine className="h-4 w-4 text-blue-500" />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4 text-green-500" />
                      )}
                      <span className="text-sm capitalize">{log.direction}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-green-600">
                      {log.units_created}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-blue-600">
                      {log.units_updated}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-medium ${
                        log.errors > 0
                          ? 'text-red-600'
                          : 'text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {log.errors}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {formatDate(log.started_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {formatDuration(log.started_at, log.completed_at)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Disconnect Confirmation */}
      <ConfirmDialog
        open={disconnectOpen}
        title="Disconnect DMS"
        description="Are you sure you want to disconnect your DMS integration? Automatic inventory syncing will stop."
        confirmLabel="Disconnect"
        variant="destructive"
        onConfirm={handleDisconnect}
        onCancel={() => setDisconnectOpen(false)}
        loading={disconnecting}
      />
    </div>
  );
}
