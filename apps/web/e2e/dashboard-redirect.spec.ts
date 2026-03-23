import { test, expect } from '@playwright/test';

test.describe('Dashboard Auth Guards', () => {
  const protectedRoutes = [
    '/dashboard',
    '/inventory',
    '/trackers',
    '/alerts',
    '/audits',
    '/activity',
    '/service/bays',
    '/settings',
    '/analytics',
    '/map',
    '/staging',
    '/gateways',
    '/test-drives',
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to /login when unauthenticated`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  }
});
