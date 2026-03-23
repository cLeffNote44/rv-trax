'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Car, Clock, User, Phone, Mail, Plus, CheckCircle, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { getTestDrives, startTestDrive, endTestDrive, getUnits } from '@/lib/api';
import type { TestDrive } from '@/lib/api';
import type { Unit } from '@rv-trax/shared';
import { useApi } from '@/hooks/useApi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;

  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function computeHistoryDuration(td: TestDrive): string {
  if (!td.ended_at) return '--';
  const start = new Date(td.started_at).getTime();
  const end = new Date(td.ended_at).getTime();
  const diff = Math.floor((end - start) / 1000);
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Form schemas
// ---------------------------------------------------------------------------

const newTestDriveSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  customer_phone: z.string().optional(),
  customer_email: z.string().email('Invalid email').optional().or(z.literal('')),
});

type NewTestDriveFormData = z.infer<typeof newTestDriveSchema>;

const endTestDriveSchema = z.object({
  notes: z.string().optional(),
  distance_miles: z.coerce
    .number()
    .nonnegative('Must be non-negative')
    .optional()
    .or(z.literal('')),
});

type EndTestDriveFormData = z.infer<typeof endTestDriveSchema>;

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type Tab = 'active' | 'history';

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function TestDrivesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Unit search state for new test drive dialog
  const [unitSearch, setUnitSearch] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitResults, setUnitResults] = useState<Unit[]>([]);
  const [searchingUnits, setSearchingUnits] = useState(false);

  // Duration ticker
  const [, setTick] = useState(0);

  // Fetch test drives
  const {
    data: testDriveData,
    isLoading,
    refetch,
  } = useApi(() => getTestDrives({ limit: 200 }), []);

  const allTestDrives = testDriveData?.data ?? [];

  const activeTestDrives = useMemo(
    () => allTestDrives.filter((td) => td.ended_at === null),
    [allTestDrives],
  );

  const historyTestDrives = useMemo(
    () =>
      allTestDrives
        .filter((td) => td.ended_at !== null)
        .sort((a, b) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime()),
    [allTestDrives],
  );

  const totalCount = allTestDrives.length;

  // Tick every 30s to keep duration timers fresh
  useEffect(() => {
    if (activeTestDrives.length === 0) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, [activeTestDrives.length]);

  // -------------------------------------------------------------------------
  // Unit search
  // -------------------------------------------------------------------------

  const searchUnits = useCallback(async (query: string) => {
    if (query.trim().length < 1) {
      setUnitResults([]);
      return;
    }
    setSearchingUnits(true);
    try {
      const result = await getUnits({ search: query, limit: 10 });
      setUnitResults(result.data);
    } catch {
      setUnitResults([]);
    } finally {
      setSearchingUnits(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => searchUnits(unitSearch), 300);
    return () => clearTimeout(timeout);
  }, [unitSearch, searchUnits]);

  // -------------------------------------------------------------------------
  // New test drive form
  // -------------------------------------------------------------------------

  const newForm = useForm<NewTestDriveFormData>({
    resolver: zodResolver(newTestDriveSchema),
    defaultValues: {
      customer_name: '',
      customer_phone: '',
      customer_email: '',
    },
  });

  const handleNewTestDrive = async (data: NewTestDriveFormData) => {
    if (!selectedUnit) return;
    setSubmitting(true);
    try {
      await startTestDrive({
        unit_id: selectedUnit.id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || undefined,
        customer_email: data.customer_email || undefined,
      });
      setShowNewDialog(false);
      newForm.reset();
      setSelectedUnit(null);
      setUnitSearch('');
      setUnitResults([]);
      refetch();
    } catch (err) {
      console.error('Failed to start test drive:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // End test drive form
  // -------------------------------------------------------------------------

  const endForm = useForm<EndTestDriveFormData>({
    resolver: zodResolver(endTestDriveSchema),
    defaultValues: {
      notes: '',
      distance_miles: '',
    },
  });

  const handleEndTestDrive = async (data: EndTestDriveFormData) => {
    if (!showEndDialog) return;
    setSubmitting(true);
    try {
      await endTestDrive(showEndDialog, {
        notes: data.notes || undefined,
        distance_miles:
          data.distance_miles !== '' && data.distance_miles !== undefined
            ? Number(data.distance_miles)
            : undefined,
      });
      setShowEndDialog(null);
      endForm.reset();
      refetch();
    } catch (err) {
      console.error('Failed to end test drive:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Car className="h-7 w-7 text-[var(--color-text-secondary)]" />
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Test Drives</h1>
          {totalCount > 0 && <Badge variant="info">{totalCount}</Badge>}
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4" />
          New Test Drive
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--color-bg-secondary)] p-1">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'active'
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Active
          {activeTestDrives.length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-semibold text-white">
              {activeTestDrives.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          History
        </button>
      </div>

      {/* Tab content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-[var(--color-text-tertiary)]">
          <Clock className="mr-2 h-5 w-5 animate-spin" />
          Loading test drives...
        </div>
      ) : activeTab === 'active' ? (
        <ActiveTab
          testDrives={activeTestDrives}
          onEndClick={(id) => {
            setShowEndDialog(id);
            endForm.reset();
          }}
        />
      ) : (
        <HistoryTab testDrives={historyTestDrives} />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* New Test Drive Dialog                                              */}
      {/* ----------------------------------------------------------------- */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-[var(--color-bg-primary)] p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
              New Test Drive
            </h2>
            <form onSubmit={newForm.handleSubmit(handleNewTestDrive)} className="space-y-4">
              {/* Unit search */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                  Unit <span className="text-red-500">*</span>
                </label>
                {selectedUnit ? (
                  <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2.5">
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {selectedUnit.year} {selectedUnit.make} {selectedUnit.model}{' '}
                      <span className="text-[var(--color-text-tertiary)]">
                        (#{selectedUnit.stock_number})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUnit(null);
                        setUnitSearch('');
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Search by stock number..."
                      value={unitSearch}
                      onChange={(e) => setUnitSearch(e.target.value)}
                      icon={<Search className="h-4 w-4" />}
                    />
                    {unitSearch.trim().length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-lg">
                        {searchingUnits ? (
                          <div className="px-3 py-2 text-sm text-[var(--color-text-tertiary)]">
                            Searching...
                          </div>
                        ) : unitResults.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-[var(--color-text-tertiary)]">
                            No units found
                          </div>
                        ) : (
                          unitResults.map((unit) => (
                            <button
                              key={unit.id}
                              type="button"
                              onClick={() => {
                                setSelectedUnit(unit);
                                setUnitSearch('');
                                setUnitResults([]);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                            >
                              <Car className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
                              <span>
                                {unit.year} {unit.make} {unit.model}
                              </span>
                              <span className="text-[var(--color-text-tertiary)]">
                                #{unit.stock_number}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Customer name */}
              <Input
                label="Customer Name"
                placeholder="Full name"
                icon={<User className="h-4 w-4" />}
                error={newForm.formState.errors.customer_name?.message}
                {...newForm.register('customer_name')}
              />

              {/* Customer phone */}
              <Input
                label="Customer Phone"
                placeholder="(555) 123-4567"
                icon={<Phone className="h-4 w-4" />}
                error={newForm.formState.errors.customer_phone?.message}
                {...newForm.register('customer_phone')}
              />

              {/* Customer email */}
              <Input
                label="Customer Email"
                placeholder="customer@example.com"
                type="email"
                icon={<Mail className="h-4 w-4" />}
                error={newForm.formState.errors.customer_email?.message}
                {...newForm.register('customer_email')}
              />

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNewDialog(false);
                    newForm.reset();
                    setSelectedUnit(null);
                    setUnitSearch('');
                    setUnitResults([]);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={submitting} disabled={!selectedUnit}>
                  Start Test Drive
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* End Test Drive Dialog                                              */}
      {/* ----------------------------------------------------------------- */}
      {showEndDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-[var(--color-bg-primary)] p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
              End Test Drive
            </h2>
            <form onSubmit={endForm.handleSubmit(handleEndTestDrive)} className="space-y-4">
              <Input
                label="Distance (miles)"
                placeholder="e.g. 12.5"
                type="number"
                step="0.1"
                {...endForm.register('distance_miles')}
                error={endForm.formState.errors.distance_miles?.message}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                  Notes
                </label>
                <textarea
                  placeholder="Any notes from the test drive..."
                  rows={3}
                  className="block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  {...endForm.register('notes')}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEndDialog(null);
                    endForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={submitting}>
                  <CheckCircle className="h-4 w-4" />
                  End Test Drive
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Tab
// ---------------------------------------------------------------------------

function ActiveTab({
  testDrives,
  onEndClick,
}: {
  testDrives: TestDrive[];
  onEndClick: (id: string) => void;
}) {
  if (testDrives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-16 text-[var(--color-text-tertiary)]">
        <Car className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No active test drives</p>
        <p className="mt-1 text-xs">Click &quot;New Test Drive&quot; to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {testDrives.map((td) => (
        <div
          key={td.id}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] p-5 shadow-sm"
        >
          {/* Customer info */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              <span className="font-semibold text-[var(--color-text-primary)]">
                {td.customer_name}
              </span>
            </div>
            {td.customer_phone && (
              <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Phone className="h-3.5 w-3.5" />
                {td.customer_phone}
              </div>
            )}
            {td.customer_email && (
              <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Mail className="h-3.5 w-3.5" />
                {td.customer_email}
              </div>
            )}
          </div>

          {/* Unit info */}
          <div className="mb-3 rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Car className="h-4 w-4 text-[var(--color-text-tertiary)]" />
              <span className="font-medium text-[var(--color-text-primary)]">{td.unit_id}</span>
            </div>
          </div>

          {/* Sales rep */}
          {td.sales_rep_name && (
            <div className="mb-3 text-sm text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-tertiary)]">Sales Rep:</span>{' '}
              {td.sales_rep_name}
            </div>
          )}

          {/* Time info */}
          <div className="mb-4 flex items-center justify-between text-sm">
            <div className="text-[var(--color-text-secondary)]">
              <span className="text-[var(--color-text-tertiary)]">Started:</span>{' '}
              {formatTime(td.started_at)}
              <span className="ml-1 text-xs text-[var(--color-text-tertiary)]">
                ({formatTimeAgo(td.started_at)})
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(td.started_at)}
            </div>
          </div>

          {/* End button */}
          <Button variant="outline" size="sm" className="w-full" onClick={() => onEndClick(td.id)}>
            <CheckCircle className="h-4 w-4" />
            End Test Drive
          </Button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// History Tab
// ---------------------------------------------------------------------------

function HistoryTab({ testDrives }: { testDrives: TestDrive[] }) {
  if (testDrives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-16 text-[var(--color-text-tertiary)]">
        <Clock className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No test drive history</p>
        <p className="mt-1 text-xs">Completed test drives will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
              Date
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
              Customer
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
              Unit
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
              Sales Rep
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
              Duration
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
              Distance
            </th>
            <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
              Notes
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {testDrives.map((td) => (
            <tr key={td.id} className="transition-colors hover:bg-[var(--color-bg-secondary)]">
              <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-primary)]">
                {formatDate(td.started_at)}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-[var(--color-text-primary)]">
                  {td.customer_name}
                </div>
                {td.customer_phone && (
                  <div className="text-xs text-[var(--color-text-tertiary)]">
                    {td.customer_phone}
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                {td.unit_id}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                {td.sales_rep_name ?? '--'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                {computeHistoryDuration(td)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-[var(--color-text-secondary)]">
                {td.distance_miles != null ? `${td.distance_miles} mi` : '--'}
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-[var(--color-text-secondary)]">
                {td.notes ?? '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
