'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck,
  Plus,
  AlertTriangle,
  Calendar,
  BarChart3,
  Clock,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { useApi } from '@/hooks/useApi';
import { getFloorPlanAudits, startFloorPlanAudit, type FloorPlanAudit } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { FloorPlanAuditStatus } from '@rv-trax/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadgeVariant(status: string): 'default' | 'info' | 'success' {
  switch (status) {
    case FloorPlanAuditStatus.IN_PROGRESS:
      return 'info';
    case FloorPlanAuditStatus.COMPLETED:
      return 'success';
    default:
      return 'default';
  }
}

function statusLabel(status: string): string {
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AuditsPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const { data, isLoading, error, refetch } = useApi(() => getFloorPlanAudits({ limit: 50 }), []);

  const audits: FloorPlanAudit[] = data?.data ?? [];

  // ---- Derived stats ----
  const totalAudits = audits.length;
  const inProgress = audits.filter((a) => a.status === FloorPlanAuditStatus.IN_PROGRESS).length;
  const completed = audits.filter((a) => a.status === FloorPlanAuditStatus.COMPLETED).length;
  const lastAuditDate = audits.length > 0 ? audits[0]!.created_at : null;

  // ---- Start audit ----
  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      await startFloorPlanAudit({});
      setConfirmOpen(false);
      refetch();
    } catch {
      // Error handled by API layer
    } finally {
      setStarting(false);
    }
  }, [refetch]);

  // ---- Loading skeleton ----
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-56 animate-pulse rounded-lg bg-[var(--color-bg-tertiary)]" />
            <div className="h-4 w-72 animate-pulse rounded-lg bg-[var(--color-bg-tertiary)]" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-lg bg-[var(--color-bg-tertiary)]" />
        </div>
        {/* Summary cards skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
                  <div className="h-8 w-16 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Table skeleton */}
        <Card>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
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
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Floor Plan Audits</h1>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                Failed to load audits
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Floor Plan Audits
            </h1>
            <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
              Verify inventory against your floor plan records
            </p>
          </div>
        </div>
        <Button onClick={() => setConfirmOpen(true)}>
          <Plus className="h-4 w-4" />
          Start New Audit
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]">
                <BarChart3 className="h-4 w-4 text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
                  Total Audits
                </p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{totalAudits}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">In Progress</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{inProgress}</p>
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
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">Completed</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)]">
                <Calendar className="h-4 w-4 text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
                  Last Audit Date
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {lastAuditDate ? formatDate(lastAuditDate) : 'None'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Table */}
      {audits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-16">
          <ClipboardCheck className="mb-3 h-10 w-10 text-[var(--color-text-tertiary)]" />
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">No audits yet</p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Start a new floor plan audit to verify your inventory.
          </p>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-tertiary)]">
                    <th className="px-6 py-3 font-medium">Date Started</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium text-right">Total Units</th>
                    <th className="px-6 py-3 font-medium text-right">Verified</th>
                    <th className="px-6 py-3 font-medium text-right">Missing</th>
                    <th className="px-6 py-3 font-medium text-right">Completion %</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map((audit) => {
                    const completionPct =
                      audit.total_units > 0
                        ? Math.round(
                            ((audit.verified_units + audit.missing_units) / audit.total_units) *
                              100,
                          )
                        : 0;

                    return (
                      <tr
                        key={audit.id}
                        className="border-b border-[var(--color-border)] last:border-0 transition-colors hover:bg-[var(--color-bg-secondary)]"
                      >
                        <td className="px-6 py-3 font-medium text-[var(--color-text-primary)]">
                          {audit.started_at
                            ? formatDate(audit.started_at)
                            : formatDate(audit.created_at)}
                        </td>
                        <td className="px-6 py-3">
                          <Badge variant={statusBadgeVariant(audit.status)}>
                            {statusLabel(audit.status)}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-right text-[var(--color-text-secondary)]">
                          {audit.total_units}
                        </td>
                        <td className="px-6 py-3 text-right text-[var(--color-text-secondary)]">
                          {audit.verified_units}
                        </td>
                        <td className="px-6 py-3 text-right text-[var(--color-text-secondary)]">
                          {audit.missing_units}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  completionPct === 100 ? 'bg-green-500' : 'bg-blue-500',
                                )}
                                style={{ width: `${completionPct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                              {completionPct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Link href={`/audits/${audit.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </Link>
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

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Start New Audit"
        description="This will create a new floor plan audit with all current inventory units. Are you sure you want to proceed?"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              A snapshot of your current inventory will be taken. Each unit will need to be verified
              against your floor plan records.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStart} isLoading={starting}>
              <ClipboardCheck className="h-4 w-4" />
              Start Audit
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
