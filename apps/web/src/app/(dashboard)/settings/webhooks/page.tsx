'use client';

import { useState, useCallback } from 'react';
import {
  Plus,
  Webhook,
  Trash2,
  Pencil,
  Play,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import type { WebhookEndpoint, WebhookDelivery } from '@rv-trax/shared';
import { WebhookEventType } from '@rv-trax/shared';
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  testWebhook,
} from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
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

const ALL_EVENTS = Object.values(WebhookEventType);

const EVENT_LABELS: Record<string, string> = {
  'unit.created': 'Unit Created',
  'unit.status_changed': 'Unit Status Changed',
  'unit.moved': 'Unit Moved',
  'geofence.breach': 'Geofence Breach',
  'tracker.battery_low': 'Tracker Battery Low',
  'alert.created': 'Alert Created',
  'work_order.completed': 'Work Order Completed',
};

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
  active: 'success',
  paused: 'warning',
  failed: 'error',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WebhooksPage() {
  const {
    data: webhooks,
    isLoading,
    refetch,
  } = useApi<WebhookEndpoint[]>(() => getWebhooks(), []);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Secret visibility toggle
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  // Delivery logs
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  // Testing
  const [testingId, setTestingId] = useState<string | null>(null);

  const toggleSecret = useCallback((id: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleEvent = useCallback((event: string) => {
    setFormEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormUrl('');
    setFormEvents([]);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (webhook: WebhookEndpoint) => {
    setEditingId(webhook.id);
    setFormUrl(webhook.url);
    setFormEvents([...webhook.events]);
    setFormError('');
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormUrl('');
    setFormEvents([]);
    setFormError('');
  };

  const handleSubmitForm = async () => {
    if (!formUrl.trim() || formEvents.length === 0) return;

    if (!/^https?:\/\/.+/.test(formUrl.trim())) {
      setFormError('URL must start with https://');
      return;
    }

    setFormSubmitting(true);
    setFormError('');
    try {
      if (editingId) {
        await updateWebhook(editingId, {
          url: formUrl.trim(),
          events: formEvents as WebhookEndpoint['events'],
        });
      } else {
        await createWebhook({
          url: formUrl.trim(),
          events: formEvents,
        });
      }
      handleCloseForm();
      refetch();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to save webhook endpoint.'
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWebhook(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await testWebhook(id);
    } catch (err) {
      console.error('Webhook test failed:', err);
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleDeliveries = async (webhookId: string) => {
    if (expandedWebhook === webhookId) {
      setExpandedWebhook(null);
      setDeliveries([]);
      return;
    }
    setExpandedWebhook(webhookId);
    setLoadingDeliveries(true);
    try {
      const data = await getWebhookDeliveries(webhookId);
      setDeliveries(data);
    } catch (err) {
      console.error('Failed to load deliveries:', err);
      setDeliveries([]);
    } finally {
      setLoadingDeliveries(false);
    }
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
            Webhooks
          </h1>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Endpoint
        </Button>
      </div>

      {/* Webhook Endpoints */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="animate-pulse p-6">
              <div className="space-y-3">
                <div className="h-5 w-64 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </Card>
          ))}
        </div>
      ) : !webhooks || webhooks.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <Webhook className="mb-3 h-10 w-10 text-[var(--color-text-tertiary)]" />
          <p className="text-lg font-medium text-[var(--color-text-primary)]">
            No webhook endpoints
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Add an endpoint to receive real-time event notifications from RV Trax.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Endpoint
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((wh) => (
            <Card key={wh.id}>
              <CardContent className="space-y-4">
                {/* URL and Status */}
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <code className="break-all font-mono text-sm text-[var(--color-text-primary)]">
                      {wh.url}
                    </code>
                  </div>
                  <Badge variant={STATUS_VARIANT[wh.status] ?? 'default'}>
                    {wh.status}
                  </Badge>
                </div>

                {/* Event subscriptions */}
                <div className="flex flex-wrap gap-1.5">
                  {wh.events.map((evt) => (
                    <Badge key={evt} variant="info" className="text-[10px]">
                      {EVENT_LABELS[evt] ?? evt}
                    </Badge>
                  ))}
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                  {wh.failure_count > 0 && (
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {wh.failure_count} failure{wh.failure_count !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span>
                    Last triggered:{' '}
                    {wh.last_triggered_at
                      ? formatRelativeTime(wh.last_triggered_at)
                      : 'Never'}
                  </span>
                </div>

                {/* Secret */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    Secret:
                  </span>
                  <code className="font-mono text-xs text-[var(--color-text-secondary)]">
                    {visibleSecrets.has(wh.id)
                      ? wh.secret
                      : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                  </code>
                  <button
                    type="button"
                    onClick={() => toggleSecret(wh.id)}
                    className="rounded p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                    title={visibleSecrets.has(wh.id) ? 'Hide secret' : 'Show secret'}
                  >
                    {visibleSecrets.has(wh.id) ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(wh)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(wh.id)}
                    isLoading={testingId === wh.id}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Test
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => setDeleteTarget(wh)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleDeliveries(wh.id)}
                  >
                    {expandedWebhook === wh.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Delivery Log
                  </Button>
                </div>

                {/* Delivery Log */}
                {expandedWebhook === wh.id && (
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
                    {loadingDeliveries ? (
                      <div className="animate-pulse p-4">
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div
                              key={i}
                              className="h-8 rounded bg-gray-200 dark:bg-gray-700"
                            />
                          ))}
                        </div>
                      </div>
                    ) : deliveries.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-[var(--color-text-tertiary)]">
                        No deliveries yet.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Event Type</TableHead>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Response Status</TableHead>
                            <TableHead>Result</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deliveries.slice(0, 20).map((d) => (
                            <TableRow key={d.id}>
                              <TableCell>
                                <Badge variant="default" className="text-[10px]">
                                  {EVENT_LABELS[d.event_type] ?? d.event_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-[var(--color-text-secondary)]">
                                  {formatDate(d.attempted_at)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <code className="font-mono text-xs">
                                  {d.response_status ?? '-'}
                                </code>
                              </TableCell>
                              <TableCell>
                                {d.success ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <X className="h-4 w-4 text-red-600" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={formOpen}
        onClose={handleCloseForm}
        title={editingId ? 'Edit Webhook Endpoint' : 'Add Webhook Endpoint'}
        description="Configure the URL and events for this webhook."
      >
        <div className="space-y-4">
          <Input
            label="Endpoint URL"
            placeholder="https://your-server.com/webhook"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            error={
              formUrl.length > 0 && !/^https?:\/\/.+/.test(formUrl)
                ? 'URL must start with https://'
                : undefined
            }
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              Events
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ALL_EVENTS.map((event) => (
                <label
                  key={event}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 transition-colors hover:bg-[var(--color-bg-secondary)]"
                >
                  <input
                    type="checkbox"
                    checked={formEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-[var(--color-text-primary)]">
                    {EVENT_LABELS[event] ?? event}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleCloseForm}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitForm}
              disabled={
                !formUrl.trim() ||
                formEvents.length === 0 ||
                formSubmitting
              }
              isLoading={formSubmitting}
            >
              {editingId ? 'Save Changes' : 'Add Endpoint'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Webhook"
        description={`Are you sure you want to delete the webhook for "${deleteTarget?.url}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
