'use client';

import { useState, useCallback } from 'react';
import { Key, Plus, Copy, Trash2, AlertTriangle, Check, Info } from 'lucide-react';
import type { ApiKey } from '@rv-trax/shared';
import { getApiKeys, createApiKey, revokeApiKey } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
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

const AVAILABLE_SCOPES = [
  { value: 'read:units', label: 'Read Units' },
  { value: 'write:units', label: 'Write Units' },
  { value: 'read:trackers', label: 'Read Trackers' },
  { value: 'write:trackers', label: 'Write Trackers' },
  { value: 'read:alerts', label: 'Read Alerts' },
  { value: 'read:analytics', label: 'Read Analytics' },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApiKeysPage() {
  const { data: keys, isLoading, refetch } = useApi<ApiKey[]>(() => getApiKeys(), []);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Success dialog (show key once)
  const [successOpen, setSuccessOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');
  const [keyCopied, setKeyCopied] = useState(false);

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Clipboard helper
  const [prefixCopied, setPrefixCopied] = useState<string | null>(null);

  const handleCopyPrefix = useCallback(async (prefix: string) => {
    try {
      await navigator.clipboard.writeText(prefix);
      setPrefixCopied(prefix);
      setTimeout(() => setPrefixCopied(null), 2000);
    } catch {
      // ignore
    }
  }, []);

  const handleCopyKey = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [generatedKey]);

  const toggleScope = useCallback((scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || selectedScopes.length === 0) return;
    setCreating(true);
    setCreateError('');
    try {
      const result = await createApiKey({
        name: newName.trim(),
        scopes: selectedScopes,
      });
      setCreateOpen(false);
      setGeneratedKey(result.key);
      setSuccessOpen(true);
      setNewName('');
      setSelectedScopes([]);
      refetch();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'Failed to create API key.'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeApiKey(revokeTarget.id);
      setRevokeTarget(null);
      refetch();
    } catch (err) {
      console.error('Failed to revoke API key:', err);
    } finally {
      setRevoking(false);
    }
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setNewName('');
    setSelectedScopes([]);
    setCreateError('');
  };

  const handleCloseSuccess = () => {
    setSuccessOpen(false);
    setGeneratedKey('');
    setKeyCopied(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a
            href="/settings"
            className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            Settings
          </a>
          <span className="text-[var(--color-text-tertiary)]">/</span>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            API Keys
          </h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          API keys allow external services to access your RV Trax data
          programmatically. Keep your keys secure and rotate them regularly.
        </p>
      </div>

      {/* Keys Table */}
      <Card>
        {isLoading ? (
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
        ) : !keys || keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Key className="mb-3 h-10 w-10 text-[var(--color-text-tertiary)]" />
            <p className="text-lg font-medium text-[var(--color-text-primary)]">
              No API keys
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Create your first API key to get started with the RV Trax API.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create API Key
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key Prefix</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Rate Limit</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => {
                const isExpired =
                  key.expires_at != null &&
                  new Date(key.expires_at) < new Date();
                const isActive = key.is_active && !isExpired;

                return (
                  <TableRow key={key.id}>
                    <TableCell>
                      <span className="font-medium">{key.name}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <code className="rounded bg-[var(--color-bg-secondary)] px-2 py-0.5 font-mono text-xs">
                          {key.key_prefix}...
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyPrefix(key.key_prefix)}
                          className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                          title="Copy prefix"
                        >
                          {prefixCopied === key.key_prefix ? (
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="info" className="text-[10px]">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {key.rate_limit_per_min}/min
                      </span>
                    </TableCell>
                    <TableCell>
                      {key.last_used_at ? (
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          {formatRelativeTime(key.last_used_at)}
                        </span>
                      ) : (
                        <span className="text-sm text-[var(--color-text-tertiary)]">
                          Never
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isActive ? 'success' : 'error'}>
                        {isActive ? 'Active' : isExpired ? 'Expired' : 'Revoked'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => setRevokeTarget(key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create API Key Dialog */}
      <Dialog
        open={createOpen}
        onClose={handleCloseCreate}
        title="Create API Key"
        description="Give your key a name and select the permissions it should have."
      >
        <div className="space-y-4">
          <Input
            label="Key Name"
            placeholder="e.g. DMS Integration"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              Scopes
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label
                  key={scope.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors hover:bg-[var(--color-bg-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.value)}
                    onChange={() => toggleScope(scope.value)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-[var(--color-text-primary)]">
                    {scope.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCloseCreate}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || selectedScopes.length === 0 || creating}
              isLoading={creating}
            >
              Create Key
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Success Dialog - Show Generated Key */}
      <Dialog
        open={successOpen}
        onClose={handleCloseSuccess}
        title="API Key Created"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Copy this key now. It will not be shown again.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2 font-mono text-sm">
              {generatedKey}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyKey}>
              {keyCopied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleCloseSuccess}>Done</Button>
          </div>
        </div>
      </Dialog>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke API Key"
        description={`Are you sure you want to revoke "${revokeTarget?.name}"? Any integrations using this key will immediately lose access.`}
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
        loading={revoking}
      />
    </div>
  );
}
