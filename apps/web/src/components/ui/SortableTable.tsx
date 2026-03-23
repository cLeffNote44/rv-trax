'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
  className?: string;
}

export interface SortableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortState = { key: string; direction: 'asc' | 'desc' } | null;

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  const multiplier = direction === 'asc' ? 1 : -1;

  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === 'number' && typeof b === 'number') {
    return (a - b) * multiplier;
  }

  if (a instanceof Date && b instanceof Date) {
    return (a.getTime() - b.getTime()) * multiplier;
  }

  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }) * multiplier;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SortableTable<T extends Record<string, unknown>>({
  data,
  columns,
  defaultSort,
  searchable = false,
  searchPlaceholder = 'Search...',
  searchKeys,
  onRowClick,
  emptyMessage = 'No data found.',
  className,
}: SortableTableProps<T>) {
  const [sort, setSort] = useState<SortState>(defaultSort ?? null);
  const [search, setSearch] = useState('');

  // -- Cycle sort on header click -------------------------------------------
  const handleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null; // third click clears
    });
  };

  // -- Filter rows ----------------------------------------------------------
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const keys = searchKeys ?? columns.map((c) => c.key);
    const term = search.toLowerCase();
    return data.filter((row) =>
      keys.some((k) => {
        const val = getNestedValue(row, k);
        return val != null && String(val).toLowerCase().includes(term);
      }),
    );
  }, [data, search, searchKeys, columns]);

  // -- Sort rows ------------------------------------------------------------
  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    return [...filteredData].sort((a, b) =>
      compareValues(getNestedValue(a, sort.key), getNestedValue(b, sort.key), sort.direction),
    );
  }, [filteredData, sort]);

  // -- Render sort icon -----------------------------------------------------
  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (!sort || sort.key !== colKey)
      return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
    return sort.direction === 'asc' ? (
      <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search bar */}
      {searchable && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] transition-colors focus:border-[var(--color-brand-500)] focus:outline-none"
          />
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  col.sortable !== false &&
                    'cursor-pointer select-none hover:text-[var(--color-text-secondary)]',
                  col.className,
                )}
                onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
              >
                {col.label}
                {col.sortable !== false && <SortIcon colKey={col.key} />}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-[var(--color-text-tertiary)]"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, idx) => (
              <TableRow
                key={(row.id as string | number | undefined) ?? idx}
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.render
                      ? col.render(getNestedValue(row, col.key), row)
                      : ((getNestedValue(row, col.key) as ReactNode) ?? '\u2014')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
