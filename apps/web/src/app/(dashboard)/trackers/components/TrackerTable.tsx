'use client';

import { Fragment, useState, useMemo } from 'react';
import {
  createColumnHelper,
  type ColumnDef,
  type ExpandedState,
} from '@tanstack/react-table';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import type { Tracker, TrackerAssignment } from '@rv-trax/shared';
import { cn, formatRelativeTime } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/Button';

interface TrackerTableProps {
  trackers: Tracker[];
  loading?: boolean;
  onRefresh: () => void;
}

// Extended tracker type with optional UI-level fields
interface TrackerRow extends Tracker {
  assigned_unit_stock?: string;
  assigned_unit_id?: string;
  rssi?: number | null;
  assignment_history?: TrackerAssignment[];
}

const columnHelper = createColumnHelper<TrackerRow>();

function BatteryBar({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-[var(--color-text-tertiary)]">N/A</span>;
  }

  let color = 'bg-green-500';
  if (pct < 20) color = 'bg-red-500';
  else if (pct <= 50) color = 'bg-amber-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums">{pct}%</span>
    </div>
  );
}

function AssignmentHistory({
  history,
}: {
  history: TrackerAssignment[] | undefined;
}) {
  if (!history || history.length === 0) {
    return (
      <p className="px-8 py-4 text-sm text-[var(--color-text-tertiary)]">
        No assignment history available.
      </p>
    );
  }

  return (
    <div className="px-8 py-4">
      <h4 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
        Assignment History
      </h4>
      <div className="space-y-2">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-4 rounded-md bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
          >
            <span className="font-mono text-xs">{entry.unit_id}</span>
            <span className="text-[var(--color-text-secondary)]">
              Assigned {formatRelativeTime(entry.assigned_at)}
            </span>
            {entry.unassigned_at && (
              <span className="text-[var(--color-text-tertiary)]">
                Unassigned {formatRelativeTime(entry.unassigned_at)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrackerTable({
  trackers,
  loading = false,
  onRefresh,
}: TrackerTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<TrackerRow, any>[]>(
    () => [
      columnHelper.display({
        id: 'expand',
        header: () => null,
        cell: ({ row }) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              row.toggleExpanded();
            }}
            className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            <svg
              className={cn(
                'h-4 w-4 transition-transform',
                row.getIsExpanded() && 'rotate-90'
              )}
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M6 4l4 4-4 4V4z" />
            </svg>
          </button>
        ),
        size: 32,
      }),
      columnHelper.accessor('device_eui', {
        header: 'Device EUI',
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('label', {
        header: 'Label',
        cell: (info) =>
          info.getValue() || (
            <span className="text-[var(--color-text-tertiary)]">--</span>
          ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <StatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor('assigned_unit_stock', {
        header: 'Assigned Unit',
        cell: (info) => {
          const stock = info.getValue();
          const unitId = info.row.original.assigned_unit_id;
          if (!stock)
            return (
              <span className="text-[var(--color-text-tertiary)]">--</span>
            );
          return (
            <a
              href={`/inventory/${unitId}`}
              className="font-medium text-[var(--color-brand-600)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              #{stock}
            </a>
          );
        },
      }),
      columnHelper.accessor('battery_pct', {
        header: 'Battery',
        cell: (info) => <BatteryBar pct={info.getValue()} />,
        sortingFn: 'basic',
      }),
      columnHelper.accessor('rssi', {
        header: 'RSSI',
        cell: (info) => {
          const val = info.getValue();
          if (val === null || val === undefined)
            return (
              <span className="text-[var(--color-text-tertiary)]">--</span>
            );
          return <span className="text-xs tabular-nums">{val} dBm</span>;
        },
      }),
      columnHelper.accessor('last_seen_at', {
        header: 'Last Seen',
        cell: (info) => {
          const val = info.getValue();
          if (!val)
            return (
              <span className="text-[var(--color-text-tertiary)]">Never</span>
            );
          return (
            <span className="text-xs text-[var(--color-text-secondary)]">
              {formatRelativeTime(val)}
            </span>
          );
        },
      }),
      columnHelper.accessor('firmware_version', {
        header: 'Firmware',
        cell: (info) =>
          info.getValue() || (
            <span className="text-[var(--color-text-tertiary)]">--</span>
          ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const tracker = row.original;
          const isAssigned = tracker.status === 'assigned';
          const isRetired = tracker.status === 'retired';

          return (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {!isRetired && (
                <>
                  {isAssigned ? (
                    <Button variant="ghost" size="sm">
                      Unassign
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm">
                      Assign
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-red-600">
                    Retire
                  </Button>
                </>
              )}
            </div>
          );
        },
      }),
    ],
    []
  );

  const data = useMemo<TrackerRow[]>(
    () => trackers as TrackerRow[],
    [trackers]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            >
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]',
                    header.column.getCanSort() && 'cursor-pointer select-none'
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {header.column.getIsSorted() === 'asc' && (
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 2l4 5H2z" />
                      </svg>
                    )}
                    {header.column.getIsSorted() === 'desc' && (
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 10l4-5H2z" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                {Array.from({ length: columns.length }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 rounded bg-gray-200 dark:bg-gray-700" />
                  </td>
                ))}
              </tr>
            ))
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-[var(--color-text-tertiary)]"
              >
                No trackers found.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  className={cn(
                    'border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-secondary)]',
                    'cursor-pointer'
                  )}
                  onClick={() => row.toggleExpanded()}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr key={`${row.id}-expanded`}>
                    <td
                      colSpan={columns.length}
                      className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
                    >
                      <AssignmentHistory
                        history={row.original.assignment_history}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
