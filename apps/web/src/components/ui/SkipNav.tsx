'use client';

/**
 * SkipNav — a visually hidden link that becomes visible on focus,
 * allowing keyboard users to skip directly to the main content area.
 */
export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none"
    >
      Skip to main content
    </a>
  );
}
