// ---------------------------------------------------------------------------
// RV Trax API — Sentry error tracking plugin
// ---------------------------------------------------------------------------
//
// Initialises Sentry for the Fastify API server.
// Requires SENTRY_DSN environment variable. When absent, this plugin
// is a no-op so development works without a Sentry account.
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

let sentryInitialised = false;

const sentryPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  const dsn = process.env['SENTRY_DSN'];

  if (!dsn) {
    app.log.info('[sentry] No SENTRY_DSN configured — error tracking disabled');
    return;
  }

  try {
    // Dynamic import so Sentry is not required in development
    const Sentry = await import('@sentry/node');

    Sentry.init({
      dsn,
      environment: process.env['NODE_ENV'] ?? 'development',
      release: `rv-trax-api@${process.env['npm_package_version'] ?? '0.1.0'}`,
      tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.2 : 1.0,
      // Don't send PII (emails, IPs) unless explicitly opted in
      sendDefaultPii: false,
      // Filter out health check noise
      beforeSend(event) {
        const url = event.request?.url ?? '';
        if (url.includes('/health') || url.includes('/ready')) return null;
        return event;
      },
    });

    sentryInitialised = true;

    // Capture unhandled errors from Fastify
    app.addHook('onError', async (request, _reply, error) => {
      Sentry.withScope((scope) => {
        scope.setTag('route', request.url);
        scope.setTag('method', request.method);
        if (request.user) {
          scope.setUser({
            id: (request.user as { sub: string }).sub,
          });
          scope.setTag('dealershipId', (request.user as { dealershipId: string }).dealershipId);
        }
        Sentry.captureException(error);
      });
    });

    app.log.info('[sentry] Error tracking initialised');
  } catch {
    app.log.warn('[sentry] Failed to initialise — @sentry/node may not be installed');
  }
};

export default sentryPlugin;

/** Flush Sentry events before shutdown */
export async function flushSentry(): Promise<void> {
  if (!sentryInitialised) return;
  try {
    const Sentry = await import('@sentry/node');
    await Sentry.close(2000);
  } catch {
    // best-effort
  }
}
