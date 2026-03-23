import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Skeleton — loading placeholder with pulse animation
//
// Usage:
//   <Skeleton className="h-10 w-32" />
//   <Skeleton variant="circle" className="h-10 w-10" />
//   <Skeleton variant="card" />
//   <Skeleton variant="text" lines={3} />
// ---------------------------------------------------------------------------

interface SkeletonProps {
  variant?: 'default' | 'circle' | 'card' | 'text';
  className?: string;
  lines?: number;
}

export function Skeleton({ variant = 'default', className, lines = 1 }: SkeletonProps) {
  if (variant === 'circle') {
    return (
      <div className={cn('animate-pulse rounded-full bg-[var(--color-bg-tertiary)]', className)} />
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'h-[120px] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)]',
          className,
        )}
      />
    );
  }

  if (variant === 'text') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-4 animate-pulse rounded bg-[var(--color-bg-tertiary)]',
              i === lines - 1 ? 'w-3/4' : 'w-full',
            )}
          />
        ))}
      </div>
    );
  }

  return <div className={cn('animate-pulse rounded bg-[var(--color-bg-tertiary)]', className)} />;
}

// ---------------------------------------------------------------------------
// SkeletonTable — loading placeholder for data tables
// ---------------------------------------------------------------------------

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 flex-1 animate-pulse rounded bg-[var(--color-bg-tertiary)]" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-8 flex-1 animate-pulse rounded bg-[var(--color-bg-secondary)]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
