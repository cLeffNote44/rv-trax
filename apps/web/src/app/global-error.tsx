'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-6xl font-bold text-red-500">500</p>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-slate-600">
            An unexpected error occurred. Our team has been notified.
          </p>
          {error.digest && <p className="mt-1 text-xs text-slate-400">Error ID: {error.digest}</p>}
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={reset}
              className="rounded-lg bg-[#C4943D] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#8a6126]"
            >
              Try Again
            </button>
            <a
              href="/dashboard"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
