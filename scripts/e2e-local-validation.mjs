/**
 * Full E2E validation against local preview build.
 * Usage: node scripts/e2e-local-validation.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const ADMIN_EMAIL = 'admin@bankebihari.com';
const ADMIN_PASSWORD = 'Admin@12345';
const RUN_ID = Date.now();
const OWNER_EMAIL = `e2e.local.${RUN_ID}@retailx-test.com`;
const SHOP_NAME = `E2E Local Shop ${RUN_ID}`;
const PRODUCT_NAME = `E2E Product ${RUN_ID}`;

const report = {
  baseUrl: BASE,
  steps: {},
  networkRequests: [],
  postStatuses: { products: null, batches: null, orders: null },
  consoleErrors: [],
  pageErrors: [],
  unhandledRejections: [],
  nonDrawer406: [],
  result: 'BLOCKED',
  failedStep: null,
};

function pass(step, detail = '') {
  report.steps[step] = { status: 'pass', detail };
}

function fail(step, detail) {
  report.steps[step] = { status: 'fail', detail };
  if (!report.failedStep) report.failedStep = step;
}

function isAllowedConsoleError(text) {
  if (/406/.test(text)) return true; // drawer_days empty row (known)
  return false;
}

async function login(page, email, password) {
  await page.fill('input[autocomplete="email"]', email);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.click('button[type="submit"]');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!isAllowedConsoleError(text)) {
        report.consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    report.pageErrors.push(String(err));
  });

  page.on('requestfailed', (req) => {
    if (req.url().includes('supabase.co')) {
      report.unhandledRejections.push(`requestfailed: ${req.method()} ${req.url()} ${req.failure()?.errorText}`);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('supabase.co')) return;
    const method = response.request().method();
    let requestBody = null;
    try {
      requestBody = response.request().postDataJSON?.() ?? response.request().postData();
    } catch {}
    let responseBody = null;
    try {
      responseBody = await response.text();
    } catch {}
    const entry = {
      method,
      url,
      status: response.status(),
      requestBody,
      responseBody: responseBody?.slice(0, 2000),
    };
    report.networkRequests.push(entry);

    if (method === 'POST') {
      if (url.includes('/rest/v1/products')) {
        report.postStatuses.products = response.status();
      }
      if (url.includes('/rest/v1/batches')) {
        report.postStatuses.batches = response.status();
      }
      if (url.includes('/rest/v1/orders')) {
        report.postStatuses.orders = response.status();
      }
    }
    if (response.status() === 406 && !url.includes('drawer_days')) {
      report.nonDrawer406.push(url);
    }
  });

  try {
    // ── Step 1: Admin login ──
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.waitForSelector('text=Admin Console', { timeout: 30000 });
    await page.waitForResponse(
      (r) => r.url().includes('/rest/v1/shops') && r.request().method() === 'GET' && r.status() === 200,
      { timeout: 30000 }
    ).catch(() => {});
    await page.waitForLoadState('networkidle');
    pass('1_admin_login');

    // ── Step 2: Register new shop ──
    const registerTab = page.getByRole('button', { name: 'Register New Shop' });
    await registerTab.waitFor({ state: 'visible', timeout: 15000 });
    await registerTab.click();
    await page.waitForSelector('h3:has-text("New Shop Registration")', { timeout: 15000 });
    await page.locator('input[placeholder="e.g. Sharma General Store"]').fill(SHOP_NAME);
    await page.locator('input[placeholder="Full name"]').fill('E2E Owner');
    await page.locator('input[placeholder="+91 99999 00000"]').fill('+91 9876543210');
    await page.locator('input[placeholder="shop@example.com"]').fill(OWNER_EMAIL);
    await page.locator('input[placeholder="e.g. Lucknow"]').fill('Lucknow');
    await page.getByRole('button', { name: 'Register Shop & Generate Credentials' }).click();
    const provisionDone = page.waitForResponse(
      (r) => r.url().includes('provision-shop') && r.status() === 200,
      { timeout: 90000 }
    );
    await provisionDone;
    await page.waitForSelector('text=Shop Registered!', { timeout: 20000 });

    const ownerPassword = await page.locator('span.font-mono.font-bold.text-indigo-300').nth(1).textContent();
    if (!ownerPassword) throw new Error('Could not read generated owner password');
    pass('2_register_shop', `email=${OWNER_EMAIL}`);

    // ── Step 3: Owner login ──
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await page.waitForSelector('input[autocomplete="email"]', { timeout: 15000 });
    await login(page, OWNER_EMAIL, ownerPassword.trim());
    await page.waitForSelector('text=Billing Counter', { timeout: 45000 });
    await page.waitForFunction(() => !document.body.innerText.includes('Loading your data'), { timeout: 30000 }).catch(() => {});
    pass('3_owner_login');

    // ── Step 4: Add category (select on product form) ──
    await page.getByText('Inventory', { exact: true }).click();
    await page.waitForSelector('h1:has-text("Inventory")', { timeout: 20000 });
    await page.getByRole('button', { name: 'Add Product' }).waitFor({ state: 'visible', timeout: 15000 });
    await page.getByRole('button', { name: 'Add Product' }).click();
    await page.waitForSelector('text=Add New Product', { timeout: 15000 });
    await page.locator('.fixed select').selectOption('Namkeen & Snacks');
    pass('4_add_category', 'Namkeen & Snacks selected');

    // ── Step 5: Add product ──
    await page.getByPlaceholder('e.g. Kaju Katli').fill(PRODUCT_NAME);
    await page.getByPlaceholder('500g / piece / plate').fill('500g');
    await page.locator('input[placeholder="0.00"]').first().fill('150');
    await page.locator('.fixed').getByRole('button', { name: 'Add Product' }).click();
    await page.waitForSelector(`text=${PRODUCT_NAME}`, { timeout: 20000 });
    if (report.postStatuses.products !== 201) {
      fail('5_add_product', `POST /products status=${report.postStatuses.products}`);
    } else {
      pass('5_add_product', 'POST /products 201');
    }

    // ── Step 6: Add batch (via product detail — avoids row click conflict) ──
    await page.locator('tr', { hasText: PRODUCT_NAME }).click();
    await page.waitForSelector('text=Back to Inventory', { timeout: 15000 });
    await page.getByRole('button', { name: /Batches/ }).click();
    await page.getByRole('button', { name: 'Add New Batch' }).click();
    await page.getByPlaceholder('BT-2024-001').fill(`BT-E2E-${RUN_ID}`);
    const today = new Date().toISOString().split('T')[0];
    const futureExpiry = new Date();
    futureExpiry.setFullYear(futureExpiry.getFullYear() + 1);
    const expiryStr = futureExpiry.toISOString().split('T')[0];
    await page.locator('input[type="date"]').first().fill(today);
    await page.locator('input[type="date"]').nth(1).fill(expiryStr);
    await page.getByPlaceholder('50').fill('100');
    await page.getByRole('button', { name: 'Add Batch' }).click();
    await page.waitForTimeout(4000);
    if (report.postStatuses.batches !== 201) {
      fail('6_add_batch', `POST /batches status=${report.postStatuses.batches}`);
    } else {
      pass('6_add_batch', 'POST /batches 201');
    }
    await page.getByText('Back to Inventory').click();
    await page.waitForSelector('h1:has-text("Inventory")', { timeout: 10000 });

    // ── Step 7: Checkout ──
    await page.getByText('Billing Counter', { exact: true }).click();
    await page.waitForSelector('h1:has-text("Billing Counter")');
    await page.getByText(PRODUCT_NAME, { exact: true }).click();
    await page.getByRole('button', { name: /Place Order & Invoice/i }).click();
    await page.waitForTimeout(5000);
    if (report.postStatuses.orders !== 201) {
      fail('7_checkout', `POST /orders status=${report.postStatuses.orders}`);
    } else if (report.consoleErrors.some((e) => e.includes('Checkout partial failure') || e.includes('drawer_days') && e.includes('42501'))) {
      fail('7_checkout', 'Order saved (201) but drawer_days RLS blocked drawer transaction — see console errors');
    } else {
      pass('7_checkout', 'POST /orders 201');
    }
    // Close invoice modal if open (blocks nav clicks)
    if (await page.getByRole('heading', { name: 'Tax Invoice' }).count()) {
      await page.locator('h2:has-text("Tax Invoice")').locator('..').locator('button').last().click();
      await page.waitForTimeout(500);
    }

    // ── Step 8: Order history ──
    await page.getByText('Order Records', { exact: true }).click();
    await page.waitForSelector('h1:has-text("Order Records")');
    const orderVisible = await page.locator('text=Walk-in Customer').count();
    if (orderVisible === 0) {
      fail('8_order_history', 'No orders visible in Order Records');
    } else {
      pass('8_order_history');
    }

    // ── Step 9: Reports (Sales Records) ──
    await page.getByText('Sales Records', { exact: true }).click();
    await page.waitForSelector('h1:has-text("Sales Records")');
    pass('9_reports');
  } catch (err) {
    const step = report.failedStep || Object.keys(report.steps).pop() || 'unknown';
    if (!report.failedStep) {
      const next = !report.steps['1_admin_login'] ? '1_admin_login'
        : !report.steps['2_register_shop'] ? '2_register_shop'
        : !report.steps['3_owner_login'] ? '3_owner_login'
        : !report.steps['4_add_category'] ? '4_add_category'
        : !report.steps['5_add_product'] ? '5_add_product'
        : !report.steps['6_add_batch'] ? '6_add_batch'
        : !report.steps['7_checkout'] ? '7_checkout'
        : !report.steps['8_order_history'] ? '8_order_history'
        : '9_reports';
      fail(next, String(err));
    }
  }

  await browser.close();

  const stepFails = Object.entries(report.steps).filter(([, v]) => v.status === 'fail');
  const postOk =
    report.postStatuses.products === 201 &&
    report.postStatuses.batches === 201 &&
    report.postStatuses.orders === 201;
  const cleanConsole = report.consoleErrors.length === 0;
  const cleanReact = report.pageErrors.length === 0;
  const noBad406 = report.nonDrawer406.length === 0;

  if (stepFails.length === 0 && postOk && cleanConsole && cleanReact && noBad406) {
    report.result = 'READY FOR PRODUCTION';
  } else {
    report.result = 'BLOCKED';
    if (!report.failedStep && stepFails.length) report.failedStep = stepFails[0][0];
    if (!postOk && !report.failedStep) report.failedStep = 'post_status_check';
    if (!cleanConsole && !report.failedStep) report.failedStep = 'console_errors';
    if (!cleanReact && !report.failedStep) report.failedStep = 'react_errors';
  }

  writeFileSync('reports/e2e-local-validation.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    result: report.result,
    failedStep: report.failedStep,
    steps: report.steps,
    postStatuses: report.postStatuses,
    consoleErrorCount: report.consoleErrors.length,
    consoleErrors: report.consoleErrors.slice(0, 5),
    pageErrors: report.pageErrors,
    networkPostCount: report.networkRequests.filter((r) => r.method === 'POST').length,
  }, null, 2));

  process.exit(report.result === 'READY FOR PRODUCTION' ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
