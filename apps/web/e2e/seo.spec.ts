import { test, expect } from '@playwright/test';

test.describe('SEO & Meta Tags', () => {
  test('landing page has proper <title> tag', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/RV Trax/i);
  });

  test('landing page has meta description', async ({ page }) => {
    await page.goto('/');

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /GPS tracking|lot management/i);
  });

  test('landing page has Open Graph tags', async ({ page }) => {
    await page.goto('/');

    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /RV Trax/i);

    const ogDescription = page.locator('meta[property="og:description"]');
    await expect(ogDescription).toHaveAttribute('content', /.+/);

    const ogType = page.locator('meta[property="og:type"]');
    await expect(ogType).toHaveAttribute('content', 'website');
  });

  test('landing page has Twitter card tags', async ({ page }) => {
    await page.goto('/');

    const twitterCard = page.locator('meta[name="twitter:card"]');
    await expect(twitterCard).toHaveAttribute('content', 'summary_large_image');
  });

  test('login page has proper <title> tag', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveTitle(/sign in|log in|RV Trax/i);
  });

  test('robots.txt is accessible and contains rules', async ({ page }) => {
    const response = await page.request.get('/robots.txt');

    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    expect(body).toContain('User-Agent');
    expect(body).toContain('Allow');
    expect(body).toContain('Sitemap');
  });

  test('sitemap.xml is accessible and contains URLs', async ({ page }) => {
    const response = await page.request.get('/sitemap.xml');

    expect(response.ok()).toBeTruthy();

    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toContain('<loc>');
  });

  test('landing page has lang attribute on html', async ({ page }) => {
    await page.goto('/');

    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('en');
  });
});
