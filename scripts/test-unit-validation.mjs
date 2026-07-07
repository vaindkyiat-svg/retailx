/**
 * Verify ProductModal unit validation UX locally.
 * Usage: node scripts/test-unit-validation.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:4174';
const RUN = Date.now();

async function login(page, email, password) {
  await page.fill('input[autocomplete="email"]', email);
  await page.fill('input[autocomplete="current-password"]', password);
  await page.click('button[type="submit"]');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await login(page, 'admin@bankebihari.com', 'Admin@12345');
await page.waitForSelector('text=Admin Console', { timeout: 30000 });
await page.getByRole('button', { name: 'Register New Shop' }).click();
await page.waitForSelector('h3:has-text("New Shop Registration")', { timeout: 15000 });

const ownerEmail = `unit.test.${RUN}@retailx-test.com`;
await page.locator('input[placeholder="e.g. Sharma General Store"]').fill(`Unit Test Shop ${RUN}`);
await page.locator('input[placeholder="Full name"]').fill('Unit Tester');
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

await page.getByText('Inventory', { exact: true }).click();
await page.getByRole('button', { name: 'Add Product' }).click();
await page.waitForSelector('text=Add New Product');

const unitLabel = (await page.locator('.fixed label:has-text("Unit")').first().textContent()).trim();

// Save without unit
await page.getByPlaceholder('e.g. Kaju Katli').fill('No Unit Product');
await page.locator('.fixed select').selectOption('Namkeen & Snacks');
await page.locator('input[placeholder="0.00"]').first().fill('100');
await page.getByRole('button', { name: 'Add Product' }).click();
await page.waitForTimeout(500);

const errWithoutUnit = await page.locator('.fixed').getByText('Unit is required.').count();
const modalOpenAfterFail = await page.locator('text=Add New Product').count();

// Save with unit
await page.getByPlaceholder('500g / piece / plate').fill('500g');
await page.getByRole('button', { name: 'Add Product' }).click();
await page.waitForSelector('text=No Unit Product', { timeout: 20000 });

const result = {
  unitLabel,
  saveWithoutUnit_showsError: errWithoutUnit > 0,
  saveWithoutUnit_modalStaysOpen: modalOpenAfterFail > 0,
  saveWithUnit_500g_success: (await page.locator('text=No Unit Product').count()) > 0,
};

console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.saveWithoutUnit_showsError && result.saveWithUnit_500g_success ? 0 : 1);
