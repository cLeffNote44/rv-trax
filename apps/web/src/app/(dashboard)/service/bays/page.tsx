'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Warehouse,
  Plus,
  ArrowRight,
  LogOut,
  Clock,
  Search,
  AlertTriangle,
  Wrench,
  CheckCircle,
  Timer,
  BarChart3,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useApi } from '@/hooks/useApi';
import {
  getServiceBays,
  getServiceBayMetrics,
  createServiceBay,
  checkInToBay,
  advanceBayStage,
  checkOutFromBay,
  getUnits,
  getWorkOrders,
} from '@/lib/api';
import type { ServiceBay, ServiceBayAssignment, ServiceBayMetrics } from '@/lib/api';
import { ServiceBayType, ServiceBayStatus, ServiceStage } from '@rv-trax/shared';
import type { Unit, WorkOrder } from '@rv-trax/shared';
import { formatStatus, cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGES = [
  ServiceStage.CHECKED_IN,
  ServiceStage.DIAGNOSIS,
  ServiceStage.IN_REPAIR,
  ServiceStage.QUALITY_CHECK,
  ServiceStage.READY,
] as const;

const STAGE_LABELS: Record<string, string> = {
  [ServiceStage.CHECKED_IN]: 'Checked In',
  [ServiceStage.DIAGNOSIS]: 'Diagnosis',
  [ServiceStage.IN_REPAIR]: 'In Repair',
  [ServiceStage.QUALITY_CHECK]: 'Quality Check',
  [ServiceStage.READY]: 'Ready',
};

const STAGE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  [ServiceStage.CHECKED_IN]: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  },
  [ServiceStage.DIAGNOSIS]: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  },
  [ServiceStage.IN_REPAIR]: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-300 dark:border-orange-700',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  },
  [ServiceStage.QUALITY_CHECK]: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-300 dark:border-purple-700',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  },
  [ServiceStage.READY]: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-300 dark:border-green-700',
    badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  },
};

const BAY_TYPE_OPTIONS = [
  { value: ServiceBayType.GENERAL, label: 'General' },
  { value: ServiceBayType.DETAIL, label: 'Detail' },
  { value: ServiceBayType.BODY, label: 'Body' },
  { value: ServiceBayType.ELECTRICAL, label: 'Electrical' },
  { value: ServiceBayType.PDI, label: 'PDI' },
];

const BAY_STATUS_COLORS: Record<string, string> = {
  [ServiceBayStatus.AVAILABLE]: 'bg-green-500',
  [ServiceBayStatus.OCCUPIED]: 'bg-red-500',
  [ServiceBayStatus.MAINTENANCE]: 'bg-gray-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNextStage(current: string): string | null {
  const idx = STAGES.indexOf(current as (typeof STAGES)[number]);
  if (idx < 0 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1] as string;
}

function formatElapsed(checkedInAt: string): string {
  const ms = Date.now() - new Date(checkedInAt).getTime();
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return `${hours}h ${minutes}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatAvgTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Elapsed timer hook
// ---------------------------------------------------------------------------

function useElapsedTimer(assignments: ServiceBayAssignment[]): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (assignments.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [assignments.length]);
  return tick;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ServiceBaysPage() {
  // Data fetching
  const {
    data: baysData,
    isLoading: baysLoading,
    error: baysError,
    refetch: refetchBays,
  } = useApi(() => getServiceBays(), []);
  const bays = baysData?.data ?? [];

  const {
    data: metricsData,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useApi(() => getServiceBayMetrics(), []);
  const metrics = metricsData?.data ?? null;

  // Gather all active assignments from occupied bays
  const activeAssignments: (ServiceBayAssignment & { bayName: string; bayId: string })[] = [];
  for (const bay of bays) {
    if (bay.current_assignment) {
      activeAssignments.push({
        ...bay.current_assignment,
        bayName: bay.name,
        bayId: bay.id,
      });
    }
  }

  // Tick timer for elapsed displays
  useElapsedTimer(activeAssignments);

  // Group assignments by stage for kanban
  const byStage: Record<string, typeof activeAssignments> = {};
  for (const stage of STAGES) {
    byStage[stage] = [];
  }
  for (const a of activeAssignments) {
    const stage = a.assignment.stage;
    if (byStage[stage]) {
      byStage[stage].push(a);
    }
  }

  // Dialog state
  const [addBayOpen, setAddBayOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInBayId, setCheckInBayId] = useState<string | null>(null);

  // Submitting states
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const refetchAll = useCallback(() => {
    refetchBays();
    refetchMetrics();
  }, [refetchBays, refetchMetrics]);

  // ── Advance stage ──
  const handleAdvance = useCallback(
    async (bayId: string, currentStage: string) => {
      const next = getNextStage(currentStage);
      if (!next) return;
      setAdvancing(bayId);
      try {
        await advanceBayStage(bayId, next);
        refetchAll();
      } catch {
        // Error handled by API layer
      } finally {
        setAdvancing(null);
      }
    },
    [refetchAll],
  );

  // ── Check out ──
  const handleCheckOut = useCallback(
    async (bayId: string) => {
      setCheckingOut(bayId);
      try {
        await checkOutFromBay(bayId);
        refetchAll();
      } catch {
        // Error handled by API layer
      } finally {
        setCheckingOut(null);
      }
    },
    [refetchAll],
  );

  // ── Open check-in for specific bay ──
  const openCheckIn = useCallback((bayId: string) => {
    setCheckInBayId(bayId);
    setCheckInOpen(true);
  }, []);

  // ── Error state ──
  if (baysError) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-500" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Failed to load service bays
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{baysError}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={refetchBays}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Warehouse className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Service Bays</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Track units through your service workflow
            </p>
          </div>
        </div>
        <Button variant="primary" size="md" onClick={() => setAddBayOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Bay
        </Button>
      </div>

      {/* ── Metrics Row ── */}
      <MetricsRow metrics={metrics} isLoading={metricsLoading} />

      {/* ── Kanban Board ── */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
          Service Workflow
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              items={byStage[stage] ?? []}
              onAdvance={handleAdvance}
              onCheckOut={handleCheckOut}
              advancing={advancing}
              checkingOut={checkingOut}
            />
          ))}
        </div>
      </div>

      {/* ── Bay Management ── */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">
          Bay Management
        </h2>
        {baysLoading ? (
          <BayListSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bays.map((bay) => (
              <BayCard key={bay.id} bay={bay} onCheckIn={openCheckIn} />
            ))}
            {bays.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
                <Warehouse className="mx-auto mb-2 h-8 w-8 text-[var(--color-text-tertiary)]" />
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No service bays configured yet. Click &quot;Add Bay&quot; to get started.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <AddBayDialog open={addBayOpen} onClose={() => setAddBayOpen(false)} onSuccess={refetchAll} />
      <CheckInDialog
        open={checkInOpen}
        bayId={checkInBayId}
        onClose={() => {
          setCheckInOpen(false);
          setCheckInBayId(null);
        }}
        onSuccess={refetchAll}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics Row
// ---------------------------------------------------------------------------

function MetricsRow({
  metrics,
  isLoading,
}: {
  metrics: ServiceBayMetrics | null;
  isLoading: boolean;
}) {
  const items = [
    {
      label: 'Total Bays',
      value: metrics?.total_bays ?? 0,
      icon: Warehouse,
      color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    },
    {
      label: 'Occupied',
      value: metrics?.occupied ?? 0,
      icon: Wrench,
      color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
    },
    {
      label: 'Available',
      value: metrics?.available ?? 0,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
    },
    {
      label: 'Avg Time in Bay',
      value: metrics ? formatAvgTime(metrics.avg_time_minutes) : '--',
      icon: Timer,
      color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
    },
    {
      label: 'Completed This Week',
      value: metrics?.completed_this_week ?? 0,
      icon: BarChart3,
      color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-20 rounded bg-[var(--color-bg-tertiary)]" />
                <div className="h-7 w-12 rounded bg-[var(--color-bg-tertiary)]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div
                className={cn('flex h-9 w-9 items-center justify-center rounded-lg', item.color)}
              >
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">{item.label}</p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">{item.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kanban Column
// ---------------------------------------------------------------------------

type AssignmentWithBay = ServiceBayAssignment & { bayName: string; bayId: string };

function KanbanColumn({
  stage,
  items,
  onAdvance,
  onCheckOut,
  advancing,
  checkingOut,
}: {
  stage: string;
  items: AssignmentWithBay[];
  onAdvance: (bayId: string, currentStage: string) => void;
  onCheckOut: (bayId: string) => void;
  advancing: string | null;
  checkingOut: string | null;
}) {
  const colors = STAGE_COLORS[stage] ?? STAGE_COLORS[ServiceStage.CHECKED_IN]!;
  const isLast = stage === ServiceStage.READY;

  return (
    <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      {/* Column header */}
      <div
        className={cn(
          'flex items-center justify-between rounded-t-xl border-b-2 px-3 py-2.5',
          colors.border,
        )}
      >
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {STAGE_LABELS[stage] ?? formatStatus(stage)}
        </h3>
        <span
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold',
            colors.badge,
          )}
        >
          {items.length}
        </span>
      </div>

      {/* Cards list */}
      <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto p-2">
        {items.length === 0 && (
          <p className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">No units</p>
        )}
        {items.map((item) => {
          const a = item.assignment;
          const unitLabel = [item.year, item.make, item.model].filter(Boolean).join(' ');
          const nextStage = getNextStage(a.stage);

          return (
            <div
              key={a.id}
              className={cn(
                'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-3 shadow-sm',
              )}
            >
              {/* Stock # and bay */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    #{item.stock_number}
                  </p>
                  {unitLabel && (
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">
                      {unitLabel}
                    </p>
                  )}
                </div>
                <Badge variant="default" className="shrink-0 text-[10px]">
                  {item.bayName}
                </Badge>
              </div>

              {/* Elapsed time */}
              <div className="mt-2 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                <Clock className="h-3 w-3" />
                <span>{formatElapsed(a.checked_in_at)}</span>
              </div>

              {/* Technician */}
              {a.technician_id && (
                <div className="mt-1 flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                  <User className="h-3 w-3" />
                  <span className="truncate">Tech assigned</span>
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex gap-2">
                {nextStage && !isLast && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 text-xs"
                    isLoading={advancing === item.bayId}
                    onClick={() => onAdvance(item.bayId, a.stage)}
                  >
                    <ArrowRight className="h-3 w-3" />
                    Advance
                  </Button>
                )}
                {isLast ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 text-xs"
                    isLoading={checkingOut === item.bayId}
                    onClick={() => onCheckOut(item.bayId)}
                  >
                    <LogOut className="h-3 w-3" />
                    Check Out
                  </Button>
                ) : (
                  nextStage === ServiceStage.READY && null
                )}
                {/* In non-last, non-final-advance columns, just show Advance */}
                {!nextStage && !isLast && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">Final stage</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bay Card (management section)
// ---------------------------------------------------------------------------

function BayCard({ bay, onCheckIn }: { bay: ServiceBay; onCheckIn: (bayId: string) => void }) {
  const isAvailable = bay.status === ServiceBayStatus.AVAILABLE;
  const statusDot = BAY_STATUS_COLORS[bay.status] ?? 'bg-gray-400';

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full', statusDot)} />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {bay.name}
            </span>
          </div>
          <Badge variant="default" className="text-[10px]">
            {formatStatus(bay.bay_type)}
          </Badge>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {formatStatus(bay.status)}
          </span>
          {isAvailable && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onCheckIn(bay.id)}
            >
              Check In
            </Button>
          )}
        </div>

        {bay.current_assignment && (
          <div className="mt-2 rounded-md bg-[var(--color-bg-secondary)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)]">
            <span className="font-medium text-[var(--color-text-primary)]">
              #{bay.current_assignment.stock_number}
            </span>{' '}
            &mdash;{' '}
            {STAGE_LABELS[bay.current_assignment.assignment.stage] ??
              bay.current_assignment.assignment.stage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Bay List Skeleton
// ---------------------------------------------------------------------------

function BayListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="py-4">
            <div className="animate-pulse space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-bg-tertiary)]" />
                <div className="h-4 w-24 rounded bg-[var(--color-bg-tertiary)]" />
              </div>
              <div className="h-3 w-16 rounded bg-[var(--color-bg-tertiary)]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Bay Dialog
// ---------------------------------------------------------------------------

function AddBayDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [bayType, setBayType] = useState<string>(ServiceBayType.GENERAL);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setBayType(ServiceBayType.GENERAL);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createServiceBay({ name: name.trim(), bay_type: bayType });
      resetForm();
      onClose();
      onSuccess();
    } catch {
      // Error handled by API layer
    } finally {
      setSubmitting(false);
    }
  }, [name, bayType, resetForm, onClose, onSuccess]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Add Service Bay"
      description="Create a new service bay for your shop."
    >
      <div className="space-y-4">
        <Input
          label="Bay Name"
          placeholder="e.g. Bay 1, Detail Bay A"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <Select
          label="Bay Type"
          options={BAY_TYPE_OPTIONS}
          value={bayType}
          onChange={(e) => setBayType(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={submitting}
            disabled={!name.trim()}
            onClick={handleSubmit}
          >
            Create Bay
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Check-In Dialog
// ---------------------------------------------------------------------------

function CheckInDialog({
  open,
  bayId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  bayId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [unitSearch, setUnitSearch] = useState('');
  const [unitResults, setUnitResults] = useState<Unit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedWoId, setSelectedWoId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced unit search
  useEffect(() => {
    if (!open) return;
    if (unitSearch.trim().length < 2) {
      setUnitResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await getUnits({ search: unitSearch.trim(), limit: 10 });
        setUnitResults(res.data);
      } catch {
        setUnitResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [unitSearch, open]);

  // When unit selected, fetch work orders for it
  useEffect(() => {
    if (!selectedUnit) {
      setWorkOrders([]);
      return;
    }
    (async () => {
      try {
        const res = await getWorkOrders({ unit_id: selectedUnit.id, limit: 20 });
        setWorkOrders(res.data);
      } catch {
        setWorkOrders([]);
      }
    })();
  }, [selectedUnit]);

  const resetForm = useCallback(() => {
    setUnitSearch('');
    setUnitResults([]);
    setSelectedUnit(null);
    setWorkOrders([]);
    setSelectedWoId('');
    setNotes('');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!bayId || !selectedUnit) return;
    setSubmitting(true);
    try {
      await checkInToBay(bayId, {
        unit_id: selectedUnit.id,
        work_order_id: selectedWoId || undefined,
        notes: notes.trim() || undefined,
      });
      resetForm();
      onClose();
      onSuccess();
    } catch {
      // Error handled by API layer
    } finally {
      setSubmitting(false);
    }
  }, [bayId, selectedUnit, selectedWoId, notes, resetForm, onClose, onSuccess]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title="Check In Unit"
      description="Search for a unit and assign it to this bay."
    >
      <div className="space-y-4">
        {/* Unit search */}
        {!selectedUnit ? (
          <div>
            <Input
              label="Search Unit"
              placeholder="Stock #, VIN, or name..."
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
              autoFocus
            />
            {searching && (
              <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">Searching...</p>
            )}
            {unitResults.length > 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--color-border)]">
                {unitResults.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-bg-secondary)]"
                    onClick={() => {
                      setSelectedUnit(unit);
                      setUnitSearch('');
                      setUnitResults([]);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--color-text-primary)]">
                        #{unit.stock_number}
                      </p>
                      <p className="truncate text-xs text-[var(--color-text-secondary)]">
                        {[unit.year, unit.make, unit.model].filter(Boolean).join(' ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {unitSearch.trim().length >= 2 && !searching && unitResults.length === 0 && (
              <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">No units found</p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  #{selectedUnit.stock_number}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {[selectedUnit.year, selectedUnit.make, selectedUnit.model]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedUnit(null)}>
                Change
              </Button>
            </div>
          </div>
        )}

        {/* Work order selection */}
        {selectedUnit && workOrders.length > 0 && (
          <Select
            label="Work Order (optional)"
            placeholder="Select work order..."
            options={[
              { value: '', label: 'None' },
              ...workOrders.map((wo) => ({
                value: wo.id,
                label: `${formatStatus(wo.order_type)} - ${formatStatus(wo.status)}`,
              })),
            ]}
            value={selectedWoId}
            onChange={(e) => setSelectedWoId(e.target.value)}
          />
        )}

        {/* Notes */}
        {selectedUnit && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              Notes (optional)
            </label>
            <textarea
              className={cn(
                'block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-sm',
                'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
                'transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
              )}
              rows={3}
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={submitting}
            disabled={!selectedUnit}
            onClick={handleSubmit}
          >
            Check In
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
