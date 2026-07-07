/**
 * Drawer finalization E2E: open, balance, refresh, re-login.
 * Usage: node scripts/test-drawer-finalization.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:4175';
const RUN = Date.now();
const report = { steps: {}, pageErrors: [], result: 'FAIL' };

function pass(step, detail = '') { report.steps[step] = { status: 'pass', detail }; }
function fail(step, detail) { report.steps[step] = { status: 'fail', detail }; throw new Error(detail); }

async function login(page, email, password) {
  await page.fill('input[autocomplete="email"]', email);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.click('button[type="submit"]');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => report.pageErrors.push(String(err)));

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await login(page, 'admin@bankebihari.com', 'Admin@12345');
  await page.waitForSelector('text=Admin Console', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  const registerTab = page.getByRole('button', { name: 'Register New Shop' });
  await registerTab.waitFor({ state: 'visible', timeout: 15000 });
  await registerTab.click();
  await page.waitForSelector('h3:has-text("New Shop Registration")', { timeout: 15000 });
  const ownerEmail = `dr.final.${RUN}@retailx-test.com`;
  await page.locator('input[placeholder="e.g. Sharma General Store"]').fill(`Drawer Final ${RUN}`);
  await page.locator('input[placeholder="Full name"]').fill('Drawer QA');
  await page.locator('input[placeholder="+91 99999 00000"]').fill('+91 9876543210');
  await page.locator('input[placeholder="shop@example.com"]').fill(ownerEmail);
  await page.locator('input[placeholder="e.g. Lucknow"]').fill('Lucknow');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Register Shop & Generate Credentials' }).click();
  await page.waitForResponse(
    (r) => r.url().includes('provision-shop') && r.status() === 200,
    { timeout: 90000 }
  );
  await page.waitForSelector('text=Shop Registered!', { timeout: 20000 });
  const ownerPassword = (await page.locator('span.font-mono.font-bold.text-indigo-300').nth(1).textContent()).trim();

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.waitForSelector('input[autocomplete="email"]', { timeout: 15000 });
  await login(page, ownerEmail, ownerPassword);
  await page.waitForSelector('text=Billing Counter', { timeout: 45000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading your data'), { timeout: 30000 }).catch(() => {});

  // Product + batch + checkout (auto-creates drawer day + sale tx)
  await page.getByText('Inventory', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Product' }).click();
  await page.getByPlaceholder('e.g. Kaju Katli').fill(`DF${RUN}`);
  await page.locator('.fixed select').selectOption('Namkeen & Snacks');
  await page.getByPlaceholder('500g / piece / plate').fill('500g');
  await page.locator('input[placeholder="0.00"]').first().fill('250');
  await page.locator('.fixed').getByRole('button', { name: 'Add Product' }).click();
  await page.waitForSelector(`text=DF${RUN}`);
  await page.locator('tr', { hasText: `DF${RUN}` }).click();
  await page.getByRole('button', { name: /Batches/ }).click();
  await page.getByRole('button', { name: 'Add New Batch' }).click();
  const today = new Date().toISOString().split('T')[0];
  const exp = new Date(); exp.setFullYear(exp.getFullYear() + 1);
  await page.getByPlaceholder('BT-2024-001').fill(`BTDF${RUN}`);
  await page.locator('input[type="date"]').first().fill(today);
  await page.locator('input[type="date"]').nth(1).fill(exp.toISOString().split('T')[0]);
  await page.getByPlaceholder('50').fill('2');
  await page.getByRole('button', { name: 'Add Batch' }).click();
  await page.waitForTimeout(3000);
  await page.getByText('Back to Inventory').click();
  await page.getByText('Billing Counter', { exact: true }).click();
  await page.getByText(`DF${RUN}`, { exact: true }).click();
  await page.getByRole('button', { name: /Place Order & Invoice/i }).click();
  await page.waitForTimeout(4000);
  if (await page.getByRole('heading', { name: 'Tax Invoice' }).count()) {
    await page.locator('h2:has-text("Tax Invoice")').locator('..').locator('button').last().click();
  }
  pass('checkout');

  report.pageErrors.length = 0;
  await page.locator('header button').filter({ hasText: /Cash Drawer|₹/ }).first().click();
  await page.waitForTimeout(1500);

  if (report.pageErrors.length) fail('drawer_open', report.pageErrors.join('; '));
  if (!(await page.locator('h2:has-text("Cash Drawer")').count())) fail('drawer_open', 'Drawer panel did not render');
  const balanceText = await page.locator('text=Current Balance').locator('..').locator('.font-mono').first().textContent();
  if (!balanceText || !balanceText.includes('250')) fail('running_balance', `Expected ₹250, got ${balanceText}`);
  pass('drawer_open', balanceText);

  const activityCount = await page.locator('text=Sale ORD').count();
  if (activityCount === 0) fail('history', 'No sale transaction in drawer activity');
  pass('history', `${activityCount} sale tx visible`);

  await page.locator('div.fixed.inset-0.z-50').click({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(500);

  // Refresh — history must survive
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Billing Counter', { timeout: 45000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading your data'), { timeout: 30000 }).catch(() => {});

  report.pageErrors.length = 0;
  await page.locator('header button').filter({ hasText: /Cash Drawer|₹/ }).first().click();
  await page.waitForTimeout(1500);
  if (report.pageErrors.length) fail('refresh', report.pageErrors.join('; '));
  const balanceAfterRefresh = await page.locator('text=Current Balance').locator('..').locator('.font-mono').first().textContent();
  if (!balanceAfterRefresh?.includes('250')) fail('refresh', `Balance after refresh: ${balanceAfterRefresh}`);
  const historyAfterRefresh = await page.locator('text=Sale ORD').count();
  if (historyAfterRefresh === 0) fail('refresh', 'History empty after refresh');
  pass('refresh', balanceAfterRefresh);

  // Re-login
  await page.getByTitle('Sign out').click();
  await page.waitForSelector('input[autocomplete="email"]');
  await login(page, ownerEmail, ownerPassword);
  await page.waitForSelector('text=Billing Counter', { timeout: 45000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading your data'), { timeout: 30000 }).catch(() => {});

  report.pageErrors.length = 0;
  await page.locator('header button').filter({ hasText: /Cash Drawer|₹/ }).first().click();
  await page.waitForTimeout(1500);
  if (report.pageErrors.length) fail('relogin', report.pageErrors.join('; '));
  const balanceRelogin = await page.locator('text=Current Balance').locator('..').locator('.font-mono').first().textContent();
  if (!balanceRelogin?.includes('250')) fail('relogin', `Balance after re-login: ${balanceRelogin}`);
  pass('relogin', balanceRelogin);

  report.result = 'PASS';
} catch (err) {
  report.error = String(err);
} finally {
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
