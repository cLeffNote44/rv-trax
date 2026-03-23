// ---------------------------------------------------------------------------
// RV Trax Web — Product analytics (PostHog)
// ---------------------------------------------------------------------------
//
// Provides lightweight product analytics via PostHog.
// Set NEXT_PUBLIC_POSTHOG_KEY and optionally NEXT_PUBLIC_POSTHOG_HOST.
// When not configured, all calls are no-ops.
// ---------------------------------------------------------------------------

type Properties = Record<string, string | number | boolean | null>;

let posthog: {
  capture: (event: string, properties?: Properties) => void;
  identify: (userId: string, properties?: Properties) => void;
  reset: () => void;
} | null = null;

/**
 * Initialise PostHog. Call once on app mount.
 */
export async function initAnalytics(): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === 'undefined') return;

  try {
    const mod = await import(/* webpackIgnore: true */ 'posthog-js').catch(() => null);
    if (!mod) return;
    const posthogJs = mod.default;
    posthogJs.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      autocapture: false, // manual events only — less noise
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      disable_session_recording: true, // opt-in only
    });
    posthog = posthogJs;
  } catch {
    // posthog-js not installed — silent no-op
  }
}

/**
 * Track a product event.
 */
export function trackEvent(event: string, properties?: Properties): void {
  posthog?.capture(event, properties);
}

/**
 * Identify the current user after login.
 */
export function identifyUser(userId: string, properties?: Properties): void {
  posthog?.identify(userId, properties);
}

/**
 * Reset identity on logout.
 */
export function resetAnalytics(): void {
  posthog?.reset();
}
