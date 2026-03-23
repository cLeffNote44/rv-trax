'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// PostHog types (loaded dynamically to keep bundle small when not configured)
type PostHogInstance = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (id: string, properties?: Record<string, unknown>) => void;
  reset: () => void;
};

let posthogInstance: PostHogInstance | null = null;

async function getPostHog(): Promise<PostHogInstance | null> {
  if (posthogInstance) return posthogInstance;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!key || !host) return null;

  try {
    const posthog = (await import('posthog-js')).default;
    posthog.init(key, {
      api_host: host,
      capture_pageview: false, // We handle this manually below
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      autocapture: false, // Reduce noise — only track intentional events
    });
    posthogInstance = posthog;
    return posthog;
  } catch {
    console.warn('[PostHog] Failed to initialize — analytics disabled');
    return null;
  }
}

// ─── Exported helpers for use across the app ────────────────────

export async function trackEvent(event: string, properties?: Record<string, unknown>) {
  const ph = await getPostHog();
  ph?.capture(event, properties);
}

export async function identifyUser(userId: string, properties?: Record<string, unknown>) {
  const ph = await getPostHog();
  ph?.identify(userId, properties);
}

export async function resetUser() {
  const ph = await getPostHog();
  ph?.reset();
}

// ─── Provider component ─────────────────────────────────────────

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize PostHog on mount
  useEffect(() => {
    getPostHog();
  }, []);

  // Track pageviews on route change
  useEffect(() => {
    async function trackPageview() {
      const ph = await getPostHog();
      if (!ph) return;

      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }

      ph.capture('$pageview', { $current_url: url });
    }

    trackPageview();
  }, [pathname, searchParams]);

  return <>{children}</>;
}
