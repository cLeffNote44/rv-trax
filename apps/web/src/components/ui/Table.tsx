import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const Table = forwardRef<
  HTMLTableElement,
  HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-auto">
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-sm', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

// ---------------------------------------------------------------------------
// TableHeader
// ---------------------------------------------------------------------------

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('border-b border-[var(--color-border)]', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

// ---------------------------------------------------------------------------
// TableBody
// ---------------------------------------------------------------------------

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

// ---------------------------------------------------------------------------
// TableRow
// ---------------------------------------------------------------------------

export const TableRow = forwardRef<
  HTMLTableRowElement,
  HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-secondary)]',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

// ---------------------------------------------------------------------------
// TableHead
// ---------------------------------------------------------------------------

export const TableHead = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

// ---------------------------------------------------------------------------
// TableCell
// ---------------------------------------------------------------------------

export const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-4 py-3 align-middle text-sm text-[var(--color-text-primary)]',
      className
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';
