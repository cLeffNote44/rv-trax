'use client';

import { AlertTriangle } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-8 w-8 text-[var(--color-error)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          Something went wrong
        </h2>
        <p className="mt-2 max-w-md text-sm text-[var(--color-text-secondary)]">
          {error.message || 'An unexpected error occurred while loading this page.'}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Error ID: {error.digest}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-700)] focus-ring"
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)] focus-ring"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
