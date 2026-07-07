/**
 * Verify drawer + wastage on production URL.
 * Usage: node scripts/verify-production-fixes.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://www.retailx.online';
const report = { base: BASE, drawer: {}, wastage: {}, pageErrors: [], consoleErrors: [] };

async function login(page, email, password) {
  await page.fill('input[autocomplete="email"]', email);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.click('button[type="submit"]');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => report.pageErrors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });

try {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
  // Try shop owner login for Banke Bihari - may not have password. Register fresh shop via admin.
  await login(page, 'admin@bankebihari.com', 'Admin@12345');
  await page.waitForSelector('text=Admin Console', { timeout: 30000 }).catch(() => null);
  if (await page.locator('text=Admin Console').count()) {
    report.adminLogin = true;
    const RUN = Date.now();
    await page.getByRole('button', { name: 'Register New Shop' }).click();
    await page.waitForSelector('h3:has-text("New Shop Registration")', { timeout: 15000 });
    const ownerEmail = `prod.verify.${RUN}@retailx-test.com`;
    await page.locator('input[placeholder="e.g. Sharma General Store"]').fill(`ProdVerify ${RUN}`);
    await page.locator('input[placeholder="Full name"]').fill('Prod QA');
    await page.locator('input[placeholder="+91 99999 00000"]').fill('+91 9876543210');
    await page.locator('input[placeholder="shop@example.com"]').fill(ownerEmail);
    await page.locator('input[placeholder="e.g. Lucknow"]').fill('Lucknow');
    await page.getByRole('button', { name: 'Register Shop & Generate Credentials' }).click();
    await page.waitForSelector('text=Shop Registered!', { timeout: 90000 });
    const pwd = (await page.locator('span.font-mono.font-bold.text-indigo-300').nth(1).textContent()).trim();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await login(page, ownerEmail, pwd);
    await page.waitForSelector('text=Billing Counter', { timeout: 60000 });
    report.shopProvisioned = ownerEmail;

    // Checkout for drawer
    await page.getByText('Inventory', { exact: true }).click();
    await page.getByRole('button', { name: 'Add Product' }).click();
    await page.getByPlaceholder('e.g. Kaju Katli').fill(`PV${RUN}`);
    await page.locator('.fixed select').selectOption('Namkeen & Snacks');
    await page.getByPlaceholder('500g / piece / plate').fill('500g');
    await page.locator('input[placeholder="0.00"]').first().fill('100');
    await page.locator('.fixed').getByRole('button', { name: 'Add Product' }).click();
    await page.waitForSelector(`text=PV${RUN}`);
    await page.locator('tr', { hasText: `PV${RUN}` }).click();
    await page.getByRole('button', { name: /Batches/ }).click();
    await page.getByRole('button', { name: 'Add New Batch' }).click();
    const today = new Date().toISOString().split('T')[0];
    const exp = new Date(); exp.setFullYear(exp.getFullYear() + 1);
    await page.getByPlaceholder('BT-2024-001').fill(`BT${RUN}`);
    await page.locator('input[type="date"]').first().fill(today);
    await page.locator('input[type="date"]').nth(1).fill(exp.toISOString().split('T')[0]);
    await page.getByPlaceholder('50').fill('5');
    await page.getByRole('button', { name: 'Add Batch' }).click();
    await page.waitForTimeout(3000);
    await page.getByText('Back to Inventory').click();
    await page.getByText('Billing Counter', { exact: true }).click();
    await page.getByText(`PV${RUN}`, { exact: true }).click();
    await page.getByRole('button', { name: /Place Order & Invoice/i }).click();
    await page.waitForTimeout(5000);
    if (await page.getByRole('heading', { name: 'Tax Invoice' }).count()) {
      await page.locator('h2:has-text("Tax Invoice")').locator('..').locator('button').last().click();
    }

    report.pageErrors.length = 0;
    await page.locator('header button').filter({ hasText: /Cash Drawer|₹/ }).first().click();
    await page.waitForTimeout(2000);
    report.drawer = {
      pageErrors: [...report.pageErrors],
      hasHeading: await page.locator('h2:has-text("Cash Drawer")').count() > 0,
      bodyEmpty: (await page.locator('body').innerText()).length < 50,
    };

    // Wastage
    report.pageErrors.length = 0;
    await page.getByText('Inventory', { exact: true }).click();
    await page.locator('tr', { hasText: `PV${RUN}` }).click();
    await page.getByRole('button', { name: /Batches/ }).click();
    await page.getByRole('button', { name: 'Block' }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Wastage', exact: true }).click();
    const hasQtyField = await page.locator('label:has-text("Quantity to waste")').count() > 0;
    await page.locator('label:has-text("Quantity to waste")').locator('..').locator('input').fill('2').catch(() => {});
    await page.getByRole('button', { name: 'Confirm Wastage' }).click();
    await page.waitForTimeout(3000);
    await page.getByRole('button', { name: 'Wastage Log', exact: true }).click();
    await page.waitForTimeout(2000);
    report.wastage = {
      hasQtyField,
      logShowsProduct: await page.locator(`text=PV${RUN}`).count() > 0,
      logEmpty: await page.locator('text=No wastage recorded yet').count() > 0,
    };
  } else {
    report.adminLogin = false;
  }
} catch (e) {
  report.error = String(e);
} finally {
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}
