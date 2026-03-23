import Link from 'next/link';
import { Search } from 'lucide-react';

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
          <Search className="h-8 w-8 text-[var(--color-text-tertiary)]" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Page not found</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          This page doesn&apos;t exist within the dashboard.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-700)] focus-ring"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
