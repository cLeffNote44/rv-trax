import { test, expect } from '@playwright/test';

// Note: /dashboard redirect is also covered in dashboard-redirect.spec.ts.
// The tests here focus on surrounding dashboard-area routes.

test.describe('Dashboard & Core Routes', () => {
  test('alerts page requires authentication', async ({ page }) => {
    await page.goto('/alerts');
    await expect(page).toHaveURL(/\/login/);
  });

  test('activity page requires authentication', async ({ page }) => {
    await page.goto('/activity');
    await expect(page).toHaveURL(/\/login/);
  });

  test('audits page requires authentication', async ({ page }) => {
    await page.goto('/audits');
    await expect(page).toHaveURL(/\/login/);
  });

  test('audit detail page requires authentication', async ({ page }) => {
    await page.goto('/audits/some-audit-id');
    await expect(page).toHaveURL(/\/login/);
  });

  test('gateways page requires authentication', async ({ page }) => {
    await page.goto('/gateways');
    await expect(page).toHaveURL(/\/login/);
  });

  test('trackers page requires authentication', async ({ page }) => {
    await page.goto('/trackers');
    await expect(page).toHaveURL(/\/login/);
  });

  test('test drives page requires authentication', async ({ page }) => {
    await page.goto('/test-drives');
    await expect(page).toHaveURL(/\/login/);
  });

  test('staging page requires authentication', async ({ page }) => {
    await page.goto('/staging');
    await expect(page).toHaveURL(/\/login/);
  });
});
