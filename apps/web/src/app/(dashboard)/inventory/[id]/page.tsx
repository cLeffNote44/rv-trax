'use client';

import { useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  MapPin,
  WifiOff,
  Clock,
  Package,
  DollarSign,
  Ruler,
  Tag,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

import {
  getUnit,
  updateUnit,
  deleteUnit,
  getAuditLog,
  getWorkOrders,
} from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  formatStatus,
} from '@/lib/utils';
import { UnitStatus } from '@rv-trax/shared';
import type {
  Unit,
  AuditLogEntry,
  WorkOrder,
  PaginatedResponse,
} from '@rv-trax/shared';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/shared/StatusBadge';

// ---------------------------------------------------------------------------
// Edit form schema
// ---------------------------------------------------------------------------

const editUnitSchema = z.object({
  status: z.string().min(1, 'Status is required'),
  current_zone: z.string().optional(),
  current_row: z.string().optional(),
  current_spot: z.string().optional(),
  msrp: z.coerce.number().nonnegative('Must be non-negative').optional().or(z.literal('')),
  floorplan: z.string().optional(),
  length_ft: z.coerce.number().positive('Must be positive').optional().or(z.literal('')),
});

type EditUnitFormData = z.infer<typeof editUnitSchema>;

// ---------------------------------------------------------------------------
// Status and type options
// ---------------------------------------------------------------------------

const statusOptions = Object.values(UnitStatus).map((val) => ({
  value: val,
  label: formatStatus(val),
}));

const typeLabels: Record<string, string> = {
  motorhome: 'Motorhome',
  fifth_wheel: 'Fifth Wheel',
  travel_trailer: 'Travel Trailer',
  toy_hauler: 'Toy Hauler',
  truck_camper: 'Truck Camper',
  popup: 'Pop-up',
  van: 'Van',
};

// ---------------------------------------------------------------------------
// Helper: days on lot
// ---------------------------------------------------------------------------

function daysOnLot(createdAt: string): number {
  return differenceInDays(new Date(), new Date(createdAt));
}

// ---------------------------------------------------------------------------
// Detail row component
// ---------------------------------------------------------------------------

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between py-2.5">
      <span className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-[var(--color-text-primary)]">
        {value ?? '--'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UnitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const unitId = params.id as string;

  // ---- Fetch unit ----
  const {
    data: unit,
    isLoading: unitLoading,
    error: unitError,
    refetch: refetchUnit,
  } = useApi<Unit>(() => getUnit(unitId), [unitId]);

  // ---- Fetch audit log for this unit ----
  const { data: auditData } = useApi<PaginatedResponse<AuditLogEntry>>(
    () => getAuditLog({ entity_type: 'unit', entity_id: unitId, limit: 20 }),
    [unitId],
  );

  // ---- Fetch work orders for this unit ----
  const { data: workOrdersData } = useApi<PaginatedResponse<WorkOrder>>(
    () => getWorkOrders({ unit_id: unitId, limit: 20 }),
    [unitId],
  );

  const auditEntries = auditData?.data ?? [];
  const workOrders = workOrdersData?.data ?? [];

  // ---- Dialog states ----
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ---- Edit form ----
  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors: formErrors },
  } = useForm<EditUnitFormData>({
    resolver: zodResolver(editUnitSchema),
  });

  const handleOpenEditDialog = useCallback(() => {
    if (!unit) return;
    resetForm({
      status: unit.status,
      current_zone: unit.current_zone ?? '',
      current_row: unit.current_row ?? '',
      current_spot: unit.current_spot ?? '',
      msrp: unit.msrp ?? ('' as unknown as number),
      floorplan: unit.floorplan ?? '',
      length_ft: unit.length_ft ?? ('' as unknown as number),
    });
    setEditDialogOpen(true);
  }, [unit, resetForm]);

  const handleEditSubmit = async (data: EditUnitFormData) => {
    setIsSubmitting(true);
    try {
      const payload: Partial<Unit> = {
        status: data.status as UnitStatus,
        current_zone: data.current_zone || null,
        current_row: data.current_row || null,
        current_spot: data.current_spot || null,
        msrp: typeof data.msrp === 'number' ? data.msrp : null,
        floorplan: data.floorplan || null,
        length_ft: typeof data.length_ft === 'number' ? data.length_ft : null,
      };
      await updateUnit(unitId, payload);
      setEditDialogOpen(false);
      refetchUnit();
    } catch (err) {
      console.error('Failed to update unit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteUnit(unitId);
      router.push('/inventory');
    } catch (err) {
      console.error('Failed to delete unit:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // ---- Location string ----
  const locationString = useMemo(() => {
    if (!unit) return null;
    const parts = [unit.current_zone, unit.current_row, unit.current_spot].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : null;
  }, [unit]);

  // ---- Loading state ----
  if (unitLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-text-tertiary)]" />
      </div>
    );
  }

  // ---- Error state ----
  if (unitError) {
    return (
      <div className="space-y-4">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 font-medium text-red-700 dark:text-red-300">
            Failed to load unit
          </p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {unitError}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refetchUnit}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ---- Unit not found ----
  if (!unit) {
    return (
      <div className="space-y-4">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>
        <div className="rounded-lg border-2 border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Unit not found.
          </p>
        </div>
      </div>
    );
  }

  const days = daysOnLot(unit.created_at);

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Link
            href="/inventory"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {unit.stock_number}
            </h1>
            <StatusBadge status={unit.status} />
          </div>
          {unit.vin && (
            <p className="font-mono text-sm text-[var(--color-text-secondary)]">
              VIN: {unit.vin}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenEditDialog}>
            <Edit2 className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* ---- Details Grid ---- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Unit Info */}
        <Card>
          <CardHeader>
            <CardTitle>Unit Information</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-[var(--color-border)]">
            <DetailRow
              label="Year"
              value={unit.year}
              icon={<Tag className="h-3.5 w-3.5" />}
            />
            <DetailRow label="Make" value={unit.make} />
            <DetailRow label="Model" value={unit.model} />
            <DetailRow label="Floorplan" value={unit.floorplan} />
            <DetailRow
              label="Type"
              value={typeLabels[unit.unit_type] ?? unit.unit_type}
              icon={<Package className="h-3.5 w-3.5" />}
            />
            <DetailRow
              label="Length"
              value={unit.length_ft ? `${unit.length_ft} ft` : null}
              icon={<Ruler className="h-3.5 w-3.5" />}
            />
            <DetailRow
              label="MSRP"
              value={unit.msrp != null ? formatCurrency(unit.msrp) : null}
              icon={<DollarSign className="h-3.5 w-3.5" />}
            />
            <DetailRow
              label="Status"
              value={<StatusBadge status={unit.status} />}
            />
            <DetailRow
              label="Days on Lot"
              value={
                <span
                  className={cn(
                    'text-sm font-semibold',
                    days > 90
                      ? 'text-red-600'
                      : days > 60
                        ? 'text-amber-600'
                        : 'text-[var(--color-text-primary)]',
                  )}
                >
                  {days}
                </span>
              }
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <DetailRow
              label="Location"
              value={locationString}
              icon={<MapPin className="h-3.5 w-3.5" />}
            />
            <DetailRow
              label="Lot"
              value={unit.lot_id ? unit.lot_id : null}
            />
            <DetailRow
              label="Added"
              value={formatDate(unit.created_at)}
            />
            <DetailRow
              label="Last Updated"
              value={formatRelativeTime(unit.updated_at)}
            />
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Tracker Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Tracker</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <WifiOff className="h-8 w-8 text-[var(--color-text-tertiary)]" />
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  No tracker assigned
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                  Assign a tracker to enable real-time location tracking
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Location Map Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              {unit.current_lat != null && unit.current_lng != null ? (
                <div className="relative h-48 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <MapPin className="mx-auto h-8 w-8 text-blue-500" />
                      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                        {unit.current_lat.toFixed(6)}, {unit.current_lng.toFixed(6)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                        Map view requires Mapbox integration
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)]">
                  <div className="text-center">
                    <MapPin className="mx-auto h-8 w-8 text-[var(--color-text-tertiary)]" />
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                      No location data
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-6">
                <p className="text-sm text-[var(--color-text-tertiary)]">
                  No notes yet
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- Activity Log ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-text-tertiary)]">
              No activity recorded for this unit.
            </p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
                    <Clock className="h-3 w-3 text-[var(--color-text-tertiary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--color-text-primary)]">
                      <span className="font-medium">{formatStatus(entry.action)}</span>
                      {entry.changes && Object.keys(entry.changes).length > 0 && (
                        <span className="text-[var(--color-text-secondary)]">
                          {' '}
                          - {Object.keys(entry.changes).join(', ')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {formatRelativeTime(entry.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Work Orders ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Work Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-text-tertiary)]">
              No work orders for this unit.
            </p>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {workOrders.map((wo) => (
                <div key={wo.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {formatStatus(wo.order_type)}
                    </p>
                    {wo.notes && (
                      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                        {wo.notes}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                      Created {formatDate(wo.created_at)}
                      {wo.due_date && ` - Due ${formatDate(wo.due_date)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        wo.status === 'complete'
                          ? 'success'
                          : wo.status === 'blocked'
                            ? 'error'
                            : wo.status === 'in_progress'
                              ? 'info'
                              : 'default'
                      }
                    >
                      {formatStatus(wo.status)}
                    </Badge>
                    <Badge
                      variant={
                        wo.priority === 'urgent'
                          ? 'error'
                          : wo.priority === 'low'
                            ? 'default'
                            : 'warning'
                      }
                    >
                      {formatStatus(wo.priority)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Edit Dialog ---- */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title="Edit Unit"
        description={`Editing ${unit.stock_number}`}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit(handleEditSubmit)} className="space-y-4">
          <Select
            label="Status *"
            options={statusOptions}
            {...register('status')}
            error={formErrors.status?.message}
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Zone"
              {...register('current_zone')}
              error={formErrors.current_zone?.message}
              placeholder="e.g. A"
            />
            <Input
              label="Row"
              {...register('current_row')}
              error={formErrors.current_row?.message}
              placeholder="e.g. 3"
            />
            <Input
              label="Spot"
              {...register('current_spot')}
              error={formErrors.current_spot?.message}
              placeholder="e.g. 12"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="MSRP"
              type="number"
              step="1"
              {...register('msrp')}
              error={formErrors.msrp?.message}
              placeholder="e.g. 85000"
            />
            <Input
              label="Floorplan"
              {...register('floorplan')}
              error={formErrors.floorplan?.message}
              placeholder="e.g. 24D"
            />
            <Input
              label="Length (ft)"
              type="number"
              step="0.1"
              {...register('length_ft')}
              error={formErrors.length_ft?.message}
              placeholder="e.g. 24"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ---- Delete Confirmation Dialog ---- */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Unit"
        description="This action cannot be undone."
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Are you sure you want to delete unit{' '}
            <span className="font-semibold text-[var(--color-text-primary)]">
              {unit.stock_number}
            </span>
            ? This will permanently remove the unit and all associated data.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              isLoading={isDeleting}
            >
              Delete Unit
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
