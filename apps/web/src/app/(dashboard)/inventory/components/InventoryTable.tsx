'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Battery } from 'lucide-react';
import { cn, getStatusColor, formatRelativeTime } from '@/lib/utils';
import type { Unit } from '@rv-trax/shared';

interface InventoryTableProps {
  units: Unit[];
  loading: boolean;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  trackerBatteries?: Map<string, number | null>;
}

const statusLabels: Record<string, string> = {
  new_arrival: 'New Arrival',
  pdi_pending: 'PDI Pending',
  pdi_in_progress: 'PDI In Progress',
  lot_ready: 'Lot Ready',
  available: 'Available',
  hold: 'Hold',
  shown: 'Shown',
  deposit: 'Deposit',
  sold: 'Sold',
  pending_delivery: 'Pending Delivery',
  delivered: 'Delivered',
  in_service: 'In Service',
  wholesale: 'Wholesale',
  archived: 'Archived',
};

const typeLabels: Record<string, string> = {
  motorhome: 'Motorhome',
  fifth_wheel: 'Fifth Wheel',
  travel_trailer: 'Travel Trailer',
  toy_hauler: 'Toy Hauler',
  truck_camper: 'Truck Camper',
  popup: 'Pop-up',
  van: 'Van',
};

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc') return <ArrowUp className="ml-1 inline h-3.5 w-3.5" />;
  if (isSorted === 'desc') return <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
  return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-30" />;
}

function daysOnLot(createdAt: string): number {
  return Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );
}

export default function InventoryTable({
  units,
  loading,
  sorting,
  onSortingChange,
  rowSelection,
  onRowSelectionChange,
  trackerBatteries,
}: InventoryTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<Unit>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
        ),
        enableSorting: false,
        size: 40,
      },
      {
        accessorKey: 'stock_number',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting()}
            className="flex items-center font-semibold"
          >
            Stock #
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-medium text-slate-900">
            {row.original.stock_number}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: 'vin',
        header: 'VIN',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-600">
            {row.original.vin
              ? `...${row.original.vin.slice(-8)}`
              : '--'}
          </span>
        ),
        size: 110,
      },
      {
        accessorKey: 'year',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting()}
            className="flex items-center font-semibold"
          >
            Year
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        size: 70,
      },
      {
        accessorKey: 'make',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting()}
            className="flex items-center font-semibold"
          >
            Make
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        size: 120,
      },
      {
        accessorKey: 'model',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting()}
            className="flex items-center font-semibold"
          >
            Model
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        size: 140,
      },
      {
        accessorKey: 'unit_type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="text-slate-600">
            {typeLabels[row.original.unit_type] ?? row.original.unit_type}
          </span>
        ),
        size: 110,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting()}
            className="flex items-center font-semibold"
          >
            Status
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              getStatusColor(row.original.status),
            )}
          >
            {statusLabels[row.original.status] ?? row.original.status}
          </span>
        ),
        size: 130,
      },
      {
        id: 'location',
        header: 'Zone / Row',
        cell: ({ row }) => {
          const zone = row.original.current_zone;
          const rowVal = row.original.current_row;
          if (!zone && !rowVal) return <span className="text-slate-400">--</span>;
          return (
            <span className="text-slate-600">
              {zone ?? '--'} / {rowVal ?? '--'}
            </span>
          );
        },
        size: 100,
      },
      {
        id: 'days_on_lot',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting()}
            className="flex items-center font-semibold"
          >
            Days
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => daysOnLot(row.created_at),
        cell: ({ getValue }) => {
          const days = getValue() as number;
          return (
            <span
              className={cn(
                'text-sm',
                days > 90 ? 'font-semibold text-red-600' : days > 60 ? 'text-amber-600' : 'text-slate-600',
              )}
            >
              {days}
            </span>
          );
        },
        size: 60,
      },
      {
        id: 'battery',
        header: 'Battery',
        cell: ({ row }) => {
          const pct = trackerBatteries?.get(row.original.id);
          if (pct == null) return <span className="text-slate-300">--</span>;
          return (
            <div className="flex items-center gap-1.5">
              <Battery
                className={cn(
                  'h-3.5 w-3.5',
                  pct > 50
                    ? 'text-emerald-500'
                    : pct > 20
                      ? 'text-amber-500'
                      : 'text-red-500',
                )}
              />
              <span className="text-xs text-slate-600">{pct}%</span>
            </div>
          );
        },
        size: 80,
      },
      {
        id: 'last_moved',
        header: ({ column }) => (
          <button
            type="button"
            onClick={() => column.toggleSorting()}
            className="flex items-center font-semibold"
          >
            Last Moved
            <SortIcon isSorted={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => row.last_moved_at,
        cell: ({ row }) => (
          <span className="text-xs text-slate-500">
            {row.original.last_moved_at
              ? formatRelativeTime(row.original.last_moved_at)
              : '--'}
          </span>
        ),
        size: 110,
      },
    ],
    [trackerBatteries],
  );

  const table = useReactTable({
    data: units,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange(next);
    },
    onRowSelectionChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(rowSelection) : updater;
      onRowSelectionChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
  });

  if (loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              {Array.from({ length: 12 }).map((_, i) => (
                <th key={i} className="px-3 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-t border-slate-100">
                {Array.from({ length: 12 }).map((_, colIdx) => (
                  <td key={colIdx} className="px-3 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 py-16">
        <div className="text-4xl">📋</div>
        <p className="mt-3 text-sm font-medium text-slate-600">
          No units found
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Try adjusting your filters or add a new unit
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => router.push(`/inventory/${row.original.id}`)}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-blue-50/50',
                  row.getIsSelected() && 'bg-blue-50',
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="whitespace-nowrap px-3 py-2.5 text-sm"
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
