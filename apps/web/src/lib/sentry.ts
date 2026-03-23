// ---------------------------------------------------------------------------
// RV Trax Web — Sentry error tracking (client-side)
// ---------------------------------------------------------------------------
//
// Lazy-initialised via dynamic import. When @sentry/nextjs is not installed,
// all functions are safe no-ops. The dynamic import prevents webpack from
// failing the build when the package is absent.
// ---------------------------------------------------------------------------

let initialised = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentry: any = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || initialised || typeof window === 'undefined') return;

  try {
    _sentry = await import(/* webpackIgnore: true */ '@sentry/nextjs').catch(() => null);
    if (!_sentry) return;

    _sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });

    initialised = true;
  } catch {
    // @sentry/nextjs not installed — silent no-op
  }
}

export function captureError(error: Error, context?: Record<string, string>): void {
  if (!_sentry) {
    console.error('[sentry] Not initialised, logging error:', error.message);
    return;
  }
  _sentry.withScope?.((scope: { setTag: (k: string, v: string) => void }) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => scope.setTag(key, value));
    }
    _sentry.captureException(error);
  });
}
