import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const SCREENSHOTS_DIR = './docs/screenshots';
const BASE_URL = 'http://localhost:3001';

async function main() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  // Log API responses for debugging
  page.on('response', res => {
    const url = res.url();
    if (url.includes('/api/v1/') && !url.includes('_next')) {
      const short = url.replace(/https?:\/\/[^/]+/, '');
      console.log(`  [API] ${res.status()} ${short}`);
    }
  });

  // ── Login page screenshot ─────────────────────────────────────────
  console.log('Taking: 01-login');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.fill('input[name="email"]', 'owner@kcrv.com');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login.png` });
  console.log('  ✓ 01-login.png');

  // ── Login via form ────────────────────────────────────────────────
  console.log('Logging in...');
  await page.fill('input[name="password"]', 'Password1!');
  await Promise.all([
    page.waitForURL('**/dashboard**', { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log('  ✓ On dashboard');
  await page.waitForTimeout(5000);

  console.log('Taking: 02-dashboard');
  await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-dashboard.png` });
  console.log('  ✓ 02-dashboard.png');

  // ── Sidebar navigation ───────────────────────────────────────────
  const pages = [
    { name: '03-inventory', text: 'Inventory', wait: 6000, directNav: true },
    { name: '04-trackers', text: 'Trackers', wait: 4000 },
    { name: '05-alerts', text: 'Alerts', wait: 3000 },
    { name: '06-analytics', text: 'Analytics', wait: 4000 },
    { name: '07-staging', text: 'Staging', wait: 3000 },
    { name: '08-service', text: 'Service', wait: 2000 },
    { name: '09-gateways', text: 'Gateways', wait: 4000 },
    { name: '10-settings', text: 'Settings', wait: 3000 },
  ];

  for (const pg of pages) {
    console.log(`Taking: ${pg.name}`);
    try {
      if (pg.directNav) {
        // Use full page navigation instead of client-side nav
        const path = '/' + pg.name.replace(/^\d+-/, '');
        await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load', timeout: 15000 });
      } else {
        await page.locator('nav a', { hasText: pg.text }).first().click({ timeout: 5000 });
      }
      await page.waitForTimeout(pg.wait);
    } catch (e) {
      console.log(`  nav failed: ${e.message.substring(0, 50)}`);
    }
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/${pg.name}.png` });
    console.log(`  ✓ ${pg.name}.png`);
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
