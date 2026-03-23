import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/this-does-not-exist');

    await expect(page.getByText(/404|not found/i)).toBeVisible();
  });

  test('health check endpoint returns ok', async ({ page }) => {
    const response = await page.request.get('/api/health');

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('rv-trax-web');
  });

  test('landing page loads for unauthenticated users', async ({ page }) => {
    await page.goto('/');

    // Landing page should be visible (not redirect to login)
    await expect(page).toHaveURL('/');
  });
});
