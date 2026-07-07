/**
 * Fix 2 verification + final production provisioning test
 */

import pg from 'pg';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const suffix = Date.now().toString(36);
const ownerEmail = `v2-prod-test-${suffix}@retailx-test.com`;

const body = {
  shopName: `V2 Prod Test ${suffix}`,
  ownerName: 'V2 Prod Owner',
  ownerEmail,
  phone: '9876543210',
  city: 'Mumbai',
  state: 'Maharashtra',
  category: 'General',
  plan: 'standard',
};

async function signInAdmin() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bankebihari.com', password: 'Admin@12345' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const flagRow = await client.query(
  `SELECT key, enabled, environments FROM public.feature_flags WHERE key = 'USE_V2_PROVISIONING'`
);
const record = flagRow.rows[0];
const resolvedProduction = record.environments?.production === true;

console.log('=== resolveFlag(production) ===');
console.log(JSON.stringify({ record, resolvedProduction }, null, 2));

if (!resolvedProduction) {
  console.error('FAIL: USE_V2_PROVISIONING still false for production');
  process.exit(1);
}

const token = await signInAdmin();
const provisionRes = await fetch(`${SUPABASE_URL}/functions/v1/provision-shop`, {
  method: 'POST',
  headers: {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const provisionBody = JSON.parse(await provisionRes.text());
const ownerPassword = provisionBody.temporaryPassword;

console.log('\n=== PROVISION (edge function) ===');
console.log(JSON.stringify({ status: provisionRes.status, ownerEmail, provisionBody }, null, 2));

if (!provisionRes.ok) {
  await client.end();
  process.exit(1);
}

const authUsers = await client.query('SELECT email FROM auth.users WHERE email = $1', [ownerEmail]);
const profiles = await client.query(
  'SELECT email, role FROM public.user_profiles WHERE email = $1',
  [ownerEmail]
);
const requests = await client.query(
  'SELECT owner_email, status FROM public.provisioning_requests WHERE owner_email = $1',
  [ownerEmail]
);

console.log('\n=== VERIFICATION QUERIES ===');
console.log('auth.users:', JSON.stringify(authUsers.rows, null, 2));
console.log('user_profiles:', JSON.stringify(profiles.rows, null, 2));
console.log('provisioning_requests:', JSON.stringify(requests.rows, null, 2));

const ownerLogin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
});
const ownerData = await ownerLogin.json();

console.log('\n=== OWNER LOGIN ===');
console.log(JSON.stringify({
  ok: ownerLogin.ok,
  email: ownerEmail,
  password: ownerPassword,
  userId: ownerData.user?.id ?? null,
}, null, 2));

await client.end();

const allOk =
  authUsers.rowCount === 1 &&
  profiles.rowCount === 1 &&
  requests.rowCount === 1 &&
  ownerLogin.ok;

process.exit(allOk ? 0 : 1);
