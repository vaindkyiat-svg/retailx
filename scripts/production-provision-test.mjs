/**
 * Production provisioning test via edge function (admin-authenticated)
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = 'admin@bankebihari.com';
const ADMIN_PASSWORD = 'Admin@12345';

const suffix = Date.now().toString(36);
const ownerEmail = `prod-test-${suffix}@retailx-test.com`;
const body = {
  shopName: `Prod Test Shop ${suffix}`,
  ownerName: 'Prod Test Owner',
  ownerEmail,
  phone: '9876543210',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  category: 'General',
  plan: 'standard',
};

async function signInAdmin() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Admin sign-in failed: ${JSON.stringify(data)}`);
  return { token: data.access_token, password: body.temporaryPassword };
}

const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
});
const adminData = await adminRes.json();
if (!adminRes.ok) {
  console.error('Admin login failed', adminData);
  process.exit(1);
}

const provisionRes = await fetch(`${SUPABASE_URL}/functions/v1/provision-shop`, {
  method: 'POST',
  headers: {
    apikey: ANON_KEY,
    Authorization: `Bearer ${adminData.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const provisionText = await provisionRes.text();
let provisionData;
try {
  provisionData = JSON.parse(provisionText);
} catch {
  provisionData = { raw: provisionText };
}

console.log('=== PROVISION RESPONSE ===');
console.log(JSON.stringify({ status: provisionRes.status, body: provisionData }, null, 2));

const ownerPassword = provisionData.temporaryPassword ?? provisionData.password;
if (!provisionRes.ok) {
  console.error('Provisioning failed');
  process.exit(1);
}

console.log('\n=== OWNER CREDENTIALS ===');
console.log(JSON.stringify({ email: ownerEmail, password: ownerPassword }, null, 2));

if (process.env.DATABASE_URL) {
  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const authUsers = await client.query(
    'SELECT id, email FROM auth.users WHERE email = $1',
    [ownerEmail]
  );
  const profiles = await client.query(
    'SELECT id, email, role, shop_id FROM public.user_profiles WHERE email = $1',
    [ownerEmail]
  );

  console.log('\n=== auth.users ===');
  console.log(JSON.stringify(authUsers.rows, null, 2));
  console.log('\n=== user_profiles ===');
  console.log(JSON.stringify(profiles.rows, null, 2));

  await client.end();

  if (authUsers.rowCount !== 1 || profiles.rowCount !== 1) {
    console.error('Expected exactly 1 row in each table');
    process.exit(1);
  }
}

const ownerLoginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
});
const ownerLoginData = await ownerLoginRes.json();

console.log('\n=== OWNER LOGIN ===');
console.log(JSON.stringify({
  ok: ownerLoginRes.ok,
  email: ownerEmail,
  userId: ownerLoginData.user?.id ?? null,
  error: ownerLoginData.error_description ?? null,
}, null, 2));

process.exit(ownerLoginRes.ok ? 0 : 1);
