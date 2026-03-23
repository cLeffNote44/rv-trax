'use client';

import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <WifiOff className="mx-auto h-16 w-16 text-[var(--color-text-tertiary)]" />
        <h1 className="mt-6 text-2xl font-bold text-[var(--color-text-primary)]">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Check your internet connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-[var(--color-brand-600)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-700)]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
