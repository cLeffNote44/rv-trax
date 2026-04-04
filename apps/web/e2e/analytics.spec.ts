import { test, expect } from '@playwright/test';

test.describe('Analytics & Reporting', () => {
  test('analytics index page requires authentication', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/login/);
  });

  test('aging analytics page requires authentication', async ({ page }) => {
    await page.goto('/analytics/aging');
    await expect(page).toHaveURL(/\/login/);
  });

  test('reports page requires authentication', async ({ page }) => {
    await page.goto('/analytics/reports');
    await expect(page).toHaveURL(/\/login/);
  });

  test('pricing analytics page requires authentication', async ({ page }) => {
    await page.goto('/analytics/pricing');
    await expect(page).toHaveURL(/\/login/);
  });
});
