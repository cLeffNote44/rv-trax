import { test, expect } from '@playwright/test';

test.describe('Work Orders & Service', () => {
  test('work orders page requires authentication', async ({ page }) => {
    await page.goto('/service/work-orders');
    await expect(page).toHaveURL(/\/login/);
  });

  test('service index page requires authentication', async ({ page }) => {
    await page.goto('/service');
    await expect(page).toHaveURL(/\/login/);
  });

  test('service bays page requires authentication', async ({ page }) => {
    await page.goto('/service/bays');
    await expect(page).toHaveURL(/\/login/);
  });

  test('recalls page requires authentication', async ({ page }) => {
    await page.goto('/service/recalls');
    await expect(page).toHaveURL(/\/login/);
  });
});
