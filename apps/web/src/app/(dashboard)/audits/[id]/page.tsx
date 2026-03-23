'use client';

import { useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  User,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { useApi } from '@/hooks/useApi';
import {
  getFloorPlanAudit,
  verifyAuditItem,
  completeFloorPlanAudit,
  type FloorPlanAuditItem,
} from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { FloorPlanAuditStatus, AuditItemStatus } from '@rv-trax/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterTab = 'all' | 'pending' | 'verified' | 'missing' | 'mislocated';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function auditStatusBadgeVariant(status: string): 'default' | 'info' | 'success' {
  switch (status) {
    case FloorPlanAuditStatus.IN_PROGRESS:
      return 'info';
    case FloorPlanAuditStatus.COMPLETED:
      return 'success';
    default:
      return 'default';
  }
}

function auditStatusLabel(status: string): string {
  switch (status) {
    case FloorPlanAuditStatus.PENDING:
      return 'Pending';
    case FloorPlanAuditStatus.IN_PROGRESS:
      return 'In Progress';
    case FloorPlanAuditStatus.COMPLETED:
      return 'Completed';
    default:
      return status;
  }
}

function itemStatusBadge(status: string) {
  switch (status) {
    case AuditItemStatus.VERIFIED:
      return { label: 'Verified', variant: 'success' as const };
    case AuditItemStatus.MISSING:
      return { label: 'Missing', variant: 'error' as const };
    case AuditItemStatus.MISLOCATED:
      return { label: 'Mislocated', variant: 'warning' as const };
    default:
      return { label: 'Pending', variant: 'default' as const };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuditDetailPage() {
  const params = useParams<{ id: string }>();
  const auditId = params.id;

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

  const { data, isLoading, error, refetch } = useApi(() => getFloorPlanAudit(auditId), [auditId]);

  const audit = data?.data ?? null;
  const items: FloorPlanAuditItem[] = audit?.items ?? [];

  // ---- Derived counts ----
  const counts = useMemo(() => {
    const verified = items.filter((i) => i.status === AuditItemStatus.VERIFIED).length;
    const missing = items.filter((i) => i.status === AuditItemStatus.MISSING).length;
    const mislocated = items.filter((i) => i.status === AuditItemStatus.MISLOCATED).length;
    const pending = items.filter((i) => i.status === AuditItemStatus.PENDING).length;
    return { verified, missing, mislocated, pending, total: items.length };
  }, [items]);

  // ---- Filtered items ----
  const filteredItems = useMemo(() => {
    let result = items;
    if (activeTab !== 'all') {
      result = result.filter((i) => i.status === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) => {
        const u = i.unit;
        if (!u) return false;
        return (
          u.stock_number?.toLowerCase().includes(q) ||
          u.make?.toLowerCase().includes(q) ||
          u.model?.toLowerCase().includes(q) ||
          u.vin?.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [items, activeTab, searchQuery]);

  // ---- Progress ----
  const progressPct =
    counts.total > 0
      ? Math.round(((counts.verified + counts.missing + counts.mislocated) / counts.total) * 100)
      : 0;

  // ---- Verify item ----
  const handleVerify = useCallback(
    async (itemId: string, status: string) => {
      setUpdatingItemId(itemId);
      try {
        await verifyAuditItem(auditId, itemId, { status });
        refetch();
      } catch {
        // Error handled by API layer
      } finally {
        setUpdatingItemId(null);
      }
    },
    [auditId, refetch],
  );

  // ---- Complete audit ----
  const handleComplete = useCallback(async () => {
    setCompleting(true);
    try {
      await completeFloorPlanAudit(auditId);
      setCompleteDialogOpen(false);
      refetch();
    } catch {
      // Error handled by API layer
    } finally {
      setCompleting(false);
    }
  }, [auditId, refetch]);

  // ---- Filter tabs config ----
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.total },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'verified', label: 'Verified', count: counts.verified },
    { key: 'missing', label: 'Missing', count: counts.missing },
    { key: 'mislocated', label: 'Mislocated', count: counts.mislocated },
  ];

  // ---- Loading skeleton ----
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-24 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-64 animate-pulse rounded-lg bg-[var(--color-bg-tertiary)]" />
            <div className="h-4 w-48 animate-pulse rounded-lg bg-[var(--color-bg-tertiary)]" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-lg bg-[var(--color-bg-tertiary)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 w-20 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
                  <div className="h-8 w-12 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="space-y-6">
        <Link
          href="/audits"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Audits
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Failed to load audit
              </p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!audit) return null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/audits"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Audits
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Floor Plan Audit
            </h1>
            <Badge variant={auditStatusBadgeVariant(audit.status)}>
              {auditStatusLabel(audit.status)}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-secondary)]">
            {audit.started_at && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Started {formatDate(audit.started_at)}
              </span>
            )}
            {audit.started_by && (
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {audit.started_by}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="h-2 w-48 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  progressPct === 100 ? 'bg-green-500' : 'bg-blue-500',
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              {counts.verified + counts.missing + counts.mislocated} / {counts.total} reviewed (
              {progressPct}%)
            </span>
          </div>
        </div>

        {audit.status === FloorPlanAuditStatus.IN_PROGRESS && (
          <Button onClick={() => setCompleteDialogOpen(true)}>
            <CheckCircle2 className="h-4 w-4" />
            Complete Audit
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]">
                <ClipboardCheck className="h-4 w-4 text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Total Units</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{counts.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Verified</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {counts.verified}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Missing</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{counts.missing}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Mislocated</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {counts.mislocated}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800/30">
                <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Pending</p>
                <p className="text-xl font-bold text-[var(--color-text-secondary)]">
                  {counts.pending}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs',
                  activeTab === tab.key
                    ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                    : 'bg-transparent text-[var(--color-text-tertiary)]',
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            placeholder="Search by stock #, make, model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-64"
          />
        </div>
      </div>

      {/* Unit Checklist Table */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-12">
          <ClipboardCheck className="mb-3 h-8 w-8 text-[var(--color-text-tertiary)]" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">No units found</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            {searchQuery
              ? 'Try adjusting your search terms.'
              : 'No units match the selected filter.'}
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-tertiary)]">
                    <th className="px-6 py-3 font-medium">Stock #</th>
                    <th className="px-6 py-3 font-medium">Year</th>
                    <th className="px-6 py-3 font-medium">Make</th>
                    <th className="px-6 py-3 font-medium">Model</th>
                    <th className="px-6 py-3 font-medium">Expected Zone</th>
                    <th className="px-6 py-3 font-medium">Found Zone</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const badge = itemStatusBadge(item.status);
                    const isUpdating = updatingItemId === item.id;
                    const isInProgress = audit.status === FloorPlanAuditStatus.IN_PROGRESS;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-[var(--color-border)] last:border-0 transition-colors hover:bg-[var(--color-bg-secondary)]"
                      >
                        <td className="px-6 py-3 font-medium text-[var(--color-text-primary)]">
                          {item.unit?.stock_number ?? '-'}
                        </td>
                        <td className="px-6 py-3 text-[var(--color-text-secondary)]">
                          {item.unit?.year ?? '-'}
                        </td>
                        <td className="px-6 py-3 text-[var(--color-text-secondary)]">
                          {item.unit?.make ?? '-'}
                        </td>
                        <td className="px-6 py-3 text-[var(--color-text-secondary)]">
                          {item.unit?.model ?? '-'}
                        </td>
                        <td className="px-6 py-3 text-[var(--color-text-secondary)]">
                          {item.expected_zone ?? '-'}
                        </td>
                        <td className="px-6 py-3 text-[var(--color-text-secondary)]">
                          {item.found_zone ?? '-'}
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-6 py-3 text-right">
                          {isInProgress && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isUpdating}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                                onClick={() => handleVerify(item.id, AuditItemStatus.VERIFIED)}
                              >
                                {isUpdating ? (
                                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Verify
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isUpdating}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                onClick={() => handleVerify(item.id, AuditItemStatus.MISSING)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Missing
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isUpdating}
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                                onClick={() => handleVerify(item.id, AuditItemStatus.MISLOCATED)}
                              >
                                <MapPin className="h-3.5 w-3.5" />
                                Mislocated
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Audit Confirmation Dialog */}
      <Dialog
        open={completeDialogOpen}
        onClose={() => setCompleteDialogOpen(false)}
        title="Complete Audit"
        description="Are you sure you want to mark this audit as completed?"
      >
        <div className="space-y-4">
          {counts.pending > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {counts.pending} unit{counts.pending !== 1 ? 's' : ''} still pending review.
                  Completing the audit will finalize results as-is.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[var(--color-text-tertiary)]">Verified</p>
                <p className="font-semibold text-green-600 dark:text-green-400">
                  {counts.verified}
                </p>
              </div>
              <div>
                <p className="text-[var(--color-text-tertiary)]">Missing</p>
                <p className="font-semibold text-red-600 dark:text-red-400">{counts.missing}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-tertiary)]">Mislocated</p>
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  {counts.mislocated}
                </p>
              </div>
              <div>
                <p className="text-[var(--color-text-tertiary)]">Pending</p>
                <p className="font-semibold text-[var(--color-text-secondary)]">{counts.pending}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleComplete} isLoading={completing}>
              <CheckCircle2 className="h-4 w-4" />
              Complete Audit
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
