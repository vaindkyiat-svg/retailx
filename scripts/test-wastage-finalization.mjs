/**
 * Wastage sprint acceptance test — full lifecycle verification.
 * Usage: node scripts/test-wastage-finalization.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:4177';
const RUN = Date.now();
const PRODUCT = `WstProd ${RUN}`;
const BATCH_NO = `BT-WST-${RUN}`;

const report = {
  steps: {},
  postStatuses: {},
  consoleErrors: [],
  pageErrors: [],
  apiFailures: [],
  result: 'FAIL',
};

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
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('406')) {
    report.consoleErrors.push(msg.text());
  }
});
page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('supabase.co')) return;
  const status = res.status();
  if (status >= 400) {
    let body = '';
    try { body = (await res.text()).slice(0, 300); } catch {}
    report.apiFailures.push({ method: res.request().method(), status, url: url.split('/rest/v1/')[1] || url, body });
  }
  const method = res.request().method();
  if (method === 'POST' && url.includes('wastage_entries')) report.postStatuses.wastage = status;
  if (method === 'PATCH' && url.includes('batches')) report.postStatuses.batchPatch = status;
});

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await login(page, 'admin@bankebihari.com', 'Admin@12345');
  await page.waitForSelector('text=Admin Console', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  const registerTab = page.getByRole('button', { name: 'Register New Shop' });
  await registerTab.waitFor({ state: 'visible', timeout: 15000 });
  await registerTab.click();
  await page.waitForSelector('h3:has-text("New Shop Registration")', { timeout: 15000 });
  await page.waitForTimeout(500);

  const ownerEmail = `wst.final.${RUN}@retailx-test.com`;
  await page.locator('input[placeholder="e.g. Sharma General Store"]').fill(`Wst Shop ${RUN}`);
  await page.locator('input[placeholder="Full name"]').fill('Wst Owner');
  await page.locator('input[placeholder="+91 99999 00000"]').fill('+91 9876543210');
  await page.locator('input[placeholder="shop@example.com"]').fill(ownerEmail);
  await page.locator('input[placeholder="e.g. Lucknow"]').fill('Lucknow');
  await page.getByRole('button', { name: 'Register Shop & Generate Credentials' }).click();
  await page.waitForResponse((r) => r.url().includes('provision-shop') && r.status() === 200, { timeout: 90000 });
  await page.waitForSelector('text=Shop Registered!', { timeout: 20000 });
  const ownerPassword = (await page.locator('span.font-mono.font-bold.text-indigo-300').nth(1).textContent()).trim();

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.waitForSelector('input[autocomplete="email"]');
  await login(page, ownerEmail, ownerPassword);
  await page.waitForSelector('text=Billing Counter', { timeout: 45000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading your data'), { timeout: 30000 }).catch(() => {});
  pass('owner_login');

  // Product + batch (10 units, block for wastage)
  await page.getByText('Inventory', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Product' }).click();
  await page.getByPlaceholder('e.g. Kaju Katli').fill(PRODUCT);
  await page.locator('.fixed select').selectOption('Namkeen & Snacks');
  await page.getByPlaceholder('500g / piece / plate').fill('500g');
  await page.locator('input[placeholder="0.00"]').first().fill('100');
  await page.locator('.fixed').getByRole('button', { name: 'Add Product' }).click();
  await page.waitForSelector(`text=${PRODUCT}`);
  pass('add_product');

  await page.locator('tr', { hasText: PRODUCT }).click();
  await page.getByRole('button', { name: /Batches/ }).click();
  await page.getByRole('button', { name: 'Add New Batch' }).click();
  const today = new Date().toISOString().split('T')[0];
  const future = new Date(); future.setFullYear(future.getFullYear() + 1);
  await page.getByPlaceholder('BT-2024-001').fill(BATCH_NO);
  await page.locator('input[type="date"]').first().fill(today);
  await page.locator('input[type="date"]').nth(1).fill(future.toISOString().split('T')[0]);
  await page.getByPlaceholder('50').fill('10');
  await page.getByRole('button', { name: 'Add Batch' }).click();
  await page.waitForTimeout(3000);
  pass('add_batch');

  await page.getByRole('button', { name: 'Block' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Wastage', exact: true }).click();
  await page.locator('label:has-text("Quantity to waste")').locator('..').locator('input').fill('3');
  await page.getByRole('button', { name: 'Confirm Wastage' }).click();
  await page.waitForTimeout(3000);

  if (report.postStatuses.wastage !== 201) {
    fail('wastage_post', `POST wastage_entries status=${report.postStatuses.wastage}`);
  }
  pass('wastage_post', 'POST wastage_entries 201');

  const batchCard = page.locator('div.rounded-2xl', { hasText: BATCH_NO });
  const unitsText = await batchCard.locator('text=/\\d+\\s*units/').first().textContent();
  if (!unitsText?.includes('7')) fail('batch_qty', `Expected 7 units, got ${unitsText}`);
  pass('batch_qty', unitsText);

  await page.getByRole('button', { name: 'Wastage Log', exact: true }).click();
  await page.waitForSelector('h1:has-text("Wastage Log")');
  if (!(await page.locator(`text=${PRODUCT}`).count())) fail('wastage_log', 'Entry not in Wastage Log');
  pass('wastage_log');

  // Refresh
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Billing Counter', { timeout: 45000 });
  await page.waitForFunction(() => !document.body.innerText.includes('Loading your data'), { timeout: 30000 }).catch(() => {});
  await page.getByRole('button', { name: 'Wastage Log', exact: true }).click();
  if (!(await page.locator(`text=${PRODUCT}`).count())) fail('refresh', 'Wastage entry missing after refresh');
  pass('refresh');

  // Re-login
  await page.getByTitle('Sign out').click();
  await page.waitForSelector('input[autocomplete="email"]');
  await login(page, ownerEmail, ownerPassword);
  await page.waitForSelector('text=Billing Counter', { timeout: 45000 });
  await page.getByRole('button', { name: 'Wastage Log', exact: true }).click();
  if (!(await page.locator(`text=${PRODUCT}`).count())) fail('relogin', 'Wastage entry missing after re-login');
  pass('relogin');

  if (report.pageErrors.length) fail('console', report.pageErrors.join('; '));
  if (report.consoleErrors.length) fail('console', report.consoleErrors.join('; '));
  const criticalApiFails = report.apiFailures.filter(f =>
    f.status >= 400 && f.status !== 406 && !f.url?.includes('drawer_days')
  );
  if (criticalApiFails.length) fail('api', JSON.stringify(criticalApiFails));

  report.result = 'PASS';
} catch (err) {
  report.error = String(err);
} finally {
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}
