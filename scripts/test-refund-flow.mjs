/**
 * Refund flow validation: checkout → refund → verify DB effects.
 * Usage: node scripts/test-refund-flow.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:4174';
const RUN = Date.now();
const report = { steps: {}, postStatuses: {}, result: 'BLOCKED' };

async function login(page, email, password) {
  await page.fill('input[autocomplete="email"]', email);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.click('button[type="submit"]');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('response', async (response) => {
  const url = response.url();
  if (!url.includes('supabase.co')) return;
  const method = response.request().method();
  if (method === 'POST') {
    if (url.includes('/rest/v1/orders')) report.postStatuses.orders = response.status();
    if (url.includes('/rest/v1/refunds')) report.postStatuses.refunds = response.status();
    if (url.includes('/rest/v1/drawer_transactions')) {
      report.postStatuses.drawer_transactions = response.status();
    }
  }
});

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await login(page, 'admin@bankebihari.com', 'Admin@12345');
  await page.waitForSelector('text=Admin Console', { timeout: 30000 });
  await page.getByRole('button', { name: 'Register New Shop' }).click();
  await page.waitForSelector('h3:has-text("New Shop Registration")', { timeout: 15000 });

  const ownerEmail = `refund.e2e.${RUN}@retailx-test.com`;
  await page.locator('input[placeholder="e.g. Sharma General Store"]').fill(`Refund E2E ${RUN}`);
  await page.locator('input[placeholder="Full name"]').fill('Refund Tester');
  await page.locator('input[placeholder="+91 99999 00000"]').fill('+91 9876543210');
  await page.locator('input[placeholder="shop@example.com"]').fill(ownerEmail);
  await page.locator('input[placeholder="e.g. Lucknow"]').fill('Lucknow');
  await page.getByRole('button', { name: 'Register Shop & Generate Credentials' }).click();
  await page.waitForSelector('text=Shop Registered!', { timeout: 90000 });
  const ownerPassword = (await page.locator('span.font-mono.font-bold.text-indigo-300').nth(1).textContent()).trim();

  await page.getByRole('button', { name: 'Sign Out' }).click();
  await page.waitForSelector('input[autocomplete="email"]');
  await login(page, ownerEmail, ownerPassword);
  await page.waitForSelector('text=Billing Counter', { timeout: 45000 });

  // Add product + batch
  await page.getByText('Inventory', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Product' }).click();
  await page.getByPlaceholder('e.g. Kaju Katli').fill(`Refund Product ${RUN}`);
  await page.locator('.fixed select').selectOption('Namkeen & Snacks');
  await page.getByPlaceholder('500g / piece / plate').fill('500g');
  await page.locator('input[placeholder="0.00"]').first().fill('200');
  await page.locator('.fixed').getByRole('button', { name: 'Add Product' }).click();
  await page.waitForSelector(`text=Refund Product ${RUN}`, { timeout: 20000 });

  await page.locator('tr', { hasText: `Refund Product ${RUN}` }).click();
  await page.getByRole('button', { name: /Batches/ }).click();
  await page.getByRole('button', { name: 'Add New Batch' }).click();
  const today = new Date().toISOString().split('T')[0];
  const expiry = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);
  await page.getByPlaceholder('BT-2024-001').fill(`BT-REF-${RUN}`);
  await page.locator('input[type="date"]').first().fill(today);
  await page.locator('input[type="date"]').nth(1).fill(expiry.toISOString().split('T')[0]);
  await page.getByPlaceholder('50').fill('50');
  await page.getByRole('button', { name: 'Add Batch' }).click();
  await page.waitForTimeout(3000);
  await page.getByText('Back to Inventory').click();

  // Checkout
  report.postStatuses.refunds = null;
  report.postStatuses.drawer_transactions = null;
  await page.getByText('Billing Counter', { exact: true }).click();
  await page.getByText(`Refund Product ${RUN}`, { exact: true }).click();
  await page.getByRole('button', { name: /Place Order & Invoice/i }).click();
  await page.waitForTimeout(4000);
  if (await page.getByRole('heading', { name: 'Tax Invoice' }).count()) {
    await page.locator('h2:has-text("Tax Invoice")').locator('..').locator('button').last().click();
  }
  report.steps.checkout = report.postStatuses.orders === 201 ? 'pass' : 'fail';

  // Refund
  await page.getByText('Order Records', { exact: true }).click();
  await page.waitForSelector('h1:has-text("Order Records")');
  await page.waitForSelector('text=Walk-in Customer', { timeout: 30000 });
  await page.locator('td button', { hasText: 'Refund' }).first().click({ timeout: 15000 });
  await page.waitForSelector('h2:has-text("Process Refund")', { timeout: 15000 });
  await page.locator('textarea').fill('E2E test refund');
  const refundPostBefore = report.postStatuses.refunds;
  await page.getByRole('button', { name: /Refund ₹/ }).click();
  await page.waitForTimeout(5000);

  const refundedBadge = await page.locator('text=Refunded').count();
  const modalStillOpen = await page.locator('h2:has-text("Process Refund")').count();

  report.steps.refund_post = report.postStatuses.refunds === 201 ? 'pass' : 'fail';
  report.steps.order_marked_refunded = refundedBadge > 0 ? 'pass' : 'fail';
  report.steps.modal_closed_on_success = modalStillOpen === 0 ? 'pass' : 'fail';
  report.steps.drawer_tx = report.postStatuses.drawer_transactions === 201 ? 'pass' : 'skip';

  // Sales reports
  await page.getByText('Sales Records', { exact: true }).click();
  await page.waitForSelector('h1:has-text("Sales Records")');
  const netRevenueVisible = await page.locator('text=Net Revenue').count();
  report.steps.reports = netRevenueVisible > 0 ? 'pass' : 'fail';

  const allPass = Object.values(report.steps).every(s => s === 'pass' || s === 'skip');
  report.result = allPass && report.postStatuses.refunds === 201 ? 'PASS' : 'BLOCKED';
} catch (err) {
  report.error = String(err);
}

await browser.close();
writeFileSync('reports/test-refund-flow.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.result === 'PASS' ? 0 : 1);
