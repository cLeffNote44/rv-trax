/**
 * Crash reporting service for RV Trax mobile app.
 * Uses @sentry/react-native for production crash tracking.
 *
 * Setup: Set SENTRY_DSN in environment or .env file.
 * Falls back to console.error if Sentry is not configured.
 */

interface CrashReportingConfig {
  dsn?: string;
  environment: string;
  release: string;
  enabled: boolean;
}

const config: CrashReportingConfig = {
  dsn: process.env.SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  release: '1.0.0',
  enabled: !__DEV__ && !!process.env.SENTRY_DSN,
};

/**
 * Initialize crash reporting. Call once in App.tsx.
 */
export function initCrashReporting(): void {
  if (!config.enabled) {
    console.log('[CrashReporting] Disabled (no SENTRY_DSN or dev mode)');
    return;
  }

  // Lazy import to avoid bundling in dev
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: 0.2,
      enableAutoSessionTracking: true,
      attachStacktrace: true,
    });
    console.log('[CrashReporting] Sentry initialized');
  } catch {
    console.warn('[CrashReporting] @sentry/react-native not installed');
  }
}

/**
 * Capture a non-fatal error.
 */
export function captureError(error: Error, context?: Record<string, string>): void {
  if (!config.enabled) {
    console.error('[CrashReporting]', error.message, context);
    return;
  }

  try {
    const Sentry = require('@sentry/react-native');
    if (context) {
      Sentry.setContext('extra', context);
    }
    Sentry.captureException(error);
  } catch {
    console.error(error);
  }
}

/**
 * Set user context for crash reports.
 */
export function setUser(user: { id: string; email: string; name: string } | null): void {
  if (!config.enabled) return;

  try {
    const Sentry = require('@sentry/react-native');
    Sentry.setUser(user);
  } catch {
    // noop
  }
}

/**
 * Add breadcrumb for crash report context.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, string>,
): void {
  if (!config.enabled) return;

  try {
    const Sentry = require('@sentry/react-native');
    Sentry.addBreadcrumb({ message, category, data, level: 'info' });
  } catch {
    // noop
  }
}
