import { test, expect } from '@playwright/test';

test.describe('Error Pages', () => {
  test('404 page renders with "Page not found" heading', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');

    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
    await expect(page.getByText(/the page you're looking for doesn't exist/i)).toBeVisible();
  });

  test('404 page has navigation links back to app', async ({ page }) => {
    await page.goto('/some-nonexistent-page');

    await expect(page.getByRole('link', { name: /go to dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();
  });

  test('404 "Go to Dashboard" link navigates correctly', async ({ page }) => {
    await page.goto('/another-missing-page');

    await page.getByRole('link', { name: /go to dashboard/i }).click();

    // Should redirect to login since user is unauthenticated
    await expect(page).toHaveURL(/\/(dashboard|login)/);
  });

  test('login page shows error message for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('bad@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid|incorrect|unauthorized|failed/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
