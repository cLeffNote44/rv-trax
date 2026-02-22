// ---------------------------------------------------------------------------
// RV Trax Web — Auth helpers (cookie-based, HttpOnly)
// ---------------------------------------------------------------------------
//
// The API now sets access & refresh tokens as HttpOnly cookies. The browser
// cannot read them via JS — that's the point (XSS protection). These helpers
// are minimal utilities for the few things the client still needs.
// ---------------------------------------------------------------------------

/**
 * Cookie name for the access token (set by the API as HttpOnly).
 * Exported for the Next.js edge middleware which CAN read HttpOnly cookies.
 */
export const TOKEN_KEY = 'rv-trax-token';

/**
 * Clear auth cookies by setting them to empty with max-age=0.
 * This works even for HttpOnly cookies set by the API because we match
 * the same path/domain — the browser will expire them.
 */
export function removeToken(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
  document.cookie = 'rv-trax-refresh=; path=/; max-age=0';
}
