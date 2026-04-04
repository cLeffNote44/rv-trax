import { test, expect } from '@playwright/test';

test.describe('Settings & Configuration', () => {
  test('settings index page requires authentication', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('dealership settings requires authentication', async ({ page }) => {
    await page.goto('/settings/dealership');
    await expect(page).toHaveURL(/\/login/);
  });

  test('billing settings requires authentication', async ({ page }) => {
    await page.goto('/settings/billing');
    await expect(page).toHaveURL(/\/login/);
  });

  test('API keys page requires authentication', async ({ page }) => {
    await page.goto('/settings/api-keys');
    await expect(page).toHaveURL(/\/login/);
  });

  test('notification settings requires authentication', async ({ page }) => {
    await page.goto('/settings/notifications');
    await expect(page).toHaveURL(/\/login/);
  });

  test('lot management requires authentication', async ({ page }) => {
    await page.goto('/settings/lots');
    await expect(page).toHaveURL(/\/login/);
  });

  test('DMS integration requires authentication', async ({ page }) => {
    await page.goto('/settings/dms');
    await expect(page).toHaveURL(/\/login/);
  });

  test('user management requires authentication', async ({ page }) => {
    await page.goto('/settings/users');
    await expect(page).toHaveURL(/\/login/);
  });

  test('webhooks settings requires authentication', async ({ page }) => {
    await page.goto('/settings/webhooks');
    await expect(page).toHaveURL(/\/login/);
  });
});
