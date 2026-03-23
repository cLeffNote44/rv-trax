import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('hero section renders with title and CTA buttons', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /know where every unit is/i })).toBeVisible();

    await expect(page.getByRole('link', { name: /start free trial/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /see how it works/i })).toBeVisible();
  });

  test('feature grid renders all 9 feature cards', async ({ page }) => {
    const features = page.locator('#features');
    await expect(features).toBeVisible();

    const featureTitles = [
      'Real-Time GPS Tracking',
      'Geofencing & Alerts',
      'Staging & Lot Optimization',
      'Analytics & Reporting',
      'Service & Work Orders',
      'Open API & Integrations',
      'Floor Plan Audits',
      'Staff Activity Tracking',
      'Test Drive Management',
    ];

    for (const title of featureTitles) {
      await expect(features.getByText(title)).toBeVisible();
    }
  });

  test('how it works section shows 3 steps', async ({ page }) => {
    const section = page.locator('#how-it-works');
    await expect(section).toBeVisible();

    await expect(section.getByText('Step 01')).toBeVisible();
    await expect(section.getByText('Step 02')).toBeVisible();
    await expect(section.getByText('Step 03')).toBeVisible();

    await expect(section.getByText('Install Gateways')).toBeVisible();
    await expect(section.getByText('Attach Trackers')).toBeVisible();
    await expect(section.getByText('Track Everything')).toBeVisible();
  });

  test('screenshot section renders images', async ({ page }) => {
    const section = page.locator('#screenshots');
    await expect(section).toBeVisible();

    await expect(section.getByText('Dashboard Overview')).toBeVisible();
    await expect(section.getByText('Tracker Management')).toBeVisible();
    await expect(section.getByText('Alerts & Notifications')).toBeVisible();
    await expect(section.getByText('Analytics & Reports')).toBeVisible();

    const images = section.locator('img');
    await expect(images).toHaveCount(6);
  });

  test('pricing section shows 3 tiers', async ({ page }) => {
    const section = page.locator('#pricing');
    await expect(section).toBeVisible();

    await expect(section.getByText('Starter')).toBeVisible();
    await expect(section.getByText('Professional')).toBeVisible();
    await expect(section.getByText('Enterprise')).toBeVisible();

    await expect(section.getByText('$49')).toBeVisible();
    await expect(section.getByText('$149')).toBeVisible();
    await expect(section.getByText('Custom')).toBeVisible();

    await expect(section.getByText('Most Popular')).toBeVisible();
  });

  test('navigation anchor links point to correct sections', async ({ page }) => {
    const nav = page.locator('nav');

    await expect(nav.getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features');
    await expect(nav.getByRole('link', { name: 'How It Works' })).toHaveAttribute(
      'href',
      '#how-it-works',
    );
    await expect(nav.getByRole('link', { name: 'Screenshots' })).toHaveAttribute(
      'href',
      '#screenshots',
    );
    await expect(nav.getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '#pricing');
  });

  test('Sign In link navigates to /login', async ({ page }) => {
    await page.getByRole('link', { name: 'Sign In' }).first().click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('Get Started link navigates to /login', async ({ page }) => {
    await page.getByRole('link', { name: 'Get Started' }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test('metrics bar renders key stats', async ({ page }) => {
    await expect(page.getByText('10x')).toBeVisible();
    await expect(page.getByText('30s')).toBeVisible();
    await expect(page.getByText('99.9%')).toBeVisible();
    await expect(page.getByText('5min')).toBeVisible();
  });

  test('footer renders with company info and links', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByText('RV Trax')).toBeVisible();
    await expect(footer.getByText(/all rights reserved/i)).toBeVisible();
  });
});

test.describe('Landing Page — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('navigation links are hidden on mobile viewport', async ({ page }) => {
    await page.goto('/');

    // Desktop nav links should be hidden (they have "hidden md:flex")
    const featuresLink = page.locator('nav a[href="#features"]');
    await expect(featuresLink).toBeHidden();

    // Sign In and Get Started should still be visible
    await expect(page.locator('nav').getByRole('link', { name: 'Sign In' })).toBeVisible();
    await expect(page.locator('nav').getByRole('link', { name: 'Get Started' })).toBeVisible();
  });
});
