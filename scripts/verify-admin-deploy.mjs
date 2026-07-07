/**
 * Post-deploy verification: production site + admin login + shops RLS
 */

const SITE = process.env.SITE_URL ?? 'https://www.retailx.online';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.ADMIN_EMAIL ?? 'admin@bankebihari.com';
const PASS = process.env.ADMIN_PASSWORD ?? 'Admin@12345';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const results = [];
let accessToken;

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
  }
}

await check('Production site responds', async () => {
  const res = await fetch(SITE);
  const html = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!html.includes('id="root"')) throw new Error('Missing React root');
  if (!html.includes('/assets/index-')) throw new Error('Missing JS bundle reference');
  return `HTTP ${res.status}, root + bundle present`;
});

await check('Admin login succeeds', async () => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error_description || body.msg || JSON.stringify(body));
  if (!body.access_token) throw new Error('No access_token');
  accessToken = body.access_token;
  return `JWT issued for ${body.user?.email ?? EMAIL}`;
});

await check('Admin profile has admin role', async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?select=role,email&limit=1`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const rows = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(rows));
  if (!rows[0]) throw new Error('No profile row');
  if (rows[0].role !== 'admin') throw new Error(`role=${rows[0].role}`);
  return `role=admin for ${rows[0].email}`;
});

await check('Admin can fetch shops (dashboard data path)', async () => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/shops?select=id,shop_name,plan&order=created_at.desc&limit=5`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}` } }
  );
  const rows = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(rows));
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('0 shops returned');
  const plans = [...new Set(rows.map((r) => r.plan))];
  return `${rows.length}+ shops visible; plans include: ${plans.join(', ')}`;
});

await check('Deployed bundle includes plan fix markers', async () => {
  const htmlRes = await fetch(SITE);
  const html = await htmlRes.text();
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!match) throw new Error('Could not find main bundle path');
  const jsRes = await fetch(`${SITE}${match[1]}`);
  const js = await jsRes.text();
  if (!jsRes.ok) throw new Error(`Bundle HTTP ${jsRes.status}`);
  if (!js.includes('starter')) throw new Error('starter mapping not in bundle');
  return `bundle OK (${Math.round(js.length / 1024)} KB)`;
});

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
process.exit(failed.length ? 1 : 0);
