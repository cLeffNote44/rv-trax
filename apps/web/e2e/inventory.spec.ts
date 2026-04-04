import { test, expect } from '@playwright/test';

test.describe('Inventory Management', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/login/);
  });

  test('inventory page shows login form after redirect', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /sign in|log in/i })).toBeVisible();
  });

  test('unit detail page redirects to login', async ({ page }) => {
    await page.goto('/inventory/some-unit-id');
    await expect(page).toHaveURL(/\/login/);
  });

  test('inventory tracking is mentioned on landing page', async ({ page }) => {
    await page.goto('/');
    // Hero text: "Track inventory, monitor devices..."
    await expect(page.getByText(/inventory/i).first()).toBeVisible();
  });
});
