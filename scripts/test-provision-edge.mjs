/**
 * Invoke provision-shop edge function as admin and collect diagnostics.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@bankebihari.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin@12345';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const suffix = Date.now().toString(36);
const body = {
  shopName: `Edge Test Shop ${suffix}`,
  ownerName: 'Edge Test Owner',
  ownerEmail: `edge-test-${suffix}@retailx-test.com`,
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
  if (!res.ok) throw new Error(`Admin sign-in failed: ${data.error_description ?? JSON.stringify(data)}`);
  return data.access_token;
}

async function invokeProvisionShop(token) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/provision-shop`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, ok: res.ok, body: parsed };
}

const token = await signInAdmin();
console.log('Admin signed in');

const result = await invokeProvisionShop(token);
console.log('\n=== provision-shop response ===');
console.log(JSON.stringify({ status: result.status, body: result.body }, null, 2));

if (process.env.DATABASE_URL) {
  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  const flag = await client.query(
    `SELECT enabled FROM public.feature_flags WHERE key = 'USE_V2_PROVISIONING'`
  );
  console.log('\n=== USE_V2_PROVISIONING flag ===');
  console.log(JSON.stringify(flag.rows[0] ?? { enabled: null }, null, 2));

  const logs = await client.query(
    `SELECT pl.step, pl.status, pl.detail, pl.created_at, pr.idempotency_key, pr.status AS request_status, pr.error_message
     FROM public.provisioning_logs pl
     JOIN public.provisioning_requests pr ON pr.id = pl.request_id
     ORDER BY pl.created_at DESC
     LIMIT 15`
  );
  console.log('\n=== recent provisioning_logs (DB) ===');
  console.log(JSON.stringify(logs.rows, null, 2));

  await client.end();
}

process.exit(result.ok ? 0 : 1);
