import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg-secondary)]">
      <div className="text-center">
        <p className="text-6xl font-bold text-[var(--color-brand-500)]">404</p>
        <h1 className="mt-4 text-2xl font-semibold text-[var(--color-text-primary)]">
          Page not found
        </h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-700)] focus-ring"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)] focus-ring"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
