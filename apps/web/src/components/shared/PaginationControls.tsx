'use client';

import { Button } from '@/components/ui/Button';

interface PaginationControlsProps {
  /** 1-based index of the first item on the current page. */
  from: number;
  /** 1-based index of the last item on the current page. */
  to: number;
  /** Total items across all pages. */
  total: number;
  /** Whether there is a next page. */
  hasMore: boolean;
  /** Cursor string for the next page (unused by this component but available). */
  nextCursor?: string | null;
  /** Called when user clicks Previous. */
  onPrevious: () => void;
  /** Called when user clicks Next. */
  onNext: () => void;
  /** Whether the previous button should be disabled. */
  hasPrevious: boolean;
}

export function PaginationControls({
  from,
  to,
  total,
  hasMore,
  onPrevious,
  onNext,
  hasPrevious,
}: PaginationControlsProps) {
  return (
    <div className="flex items-center justify-between px-2 py-3">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Showing{' '}
        <span className="font-medium text-[var(--color-text-primary)]">{from}</span>
        {' - '}
        <span className="font-medium text-[var(--color-text-primary)]">{to}</span>
        {' of '}
        <span className="font-medium text-[var(--color-text-primary)]">{total}</span>
        {' results'}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!hasPrevious}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasMore}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
