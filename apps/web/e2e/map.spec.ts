import { test, expect } from '@playwright/test';

test.describe('Lot Map', () => {
  test('map page requires authentication', async ({ page }) => {
    await page.goto('/map');
    await expect(page).toHaveURL(/\/login/);
  });

  test('GPS tracking is mentioned on landing page', async ({ page }) => {
    await page.goto('/');
    // Landing page features section: "Real-Time GPS Tracking"
    await expect(page.getByText(/real-time gps tracking/i)).toBeVisible();
  });
});
