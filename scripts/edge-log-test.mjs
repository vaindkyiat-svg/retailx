/**
 * Create shop via edge function and check DB traces (proxy for dashboard logs).
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const suffix = Date.now().toString(36);
const ownerEmail = `edge-log-test-${suffix}@retailx-test.com`;

const body = {
  shopName: `Log Test Shop ${suffix}`,
  ownerName: 'Log Test Owner',
  ownerEmail,
  phone: '9876543210',
  city: 'Delhi',
  state: 'Delhi',
  category: 'General',
  plan: 'standard',
};

const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@bankebihari.com', password: 'Admin@12345' }),
});
const adminData = await adminRes.json();
if (!adminRes.ok) throw new Error(JSON.stringify(adminData));

const before = new Date().toISOString();
const provisionRes = await fetch(`${SUPABASE_URL}/functions/v1/provision-shop`, {
  method: 'POST',
  headers: {
    apikey: ANON_KEY,
    Authorization: `Bearer ${adminData.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
const provisionBody = JSON.parse(await provisionRes.text());

console.log('=== EDGE INVOCATION ===');
console.log(JSON.stringify({
  ownerEmail,
  status: provisionRes.status,
  ok: provisionRes.ok,
  shopId: provisionBody.shopId ?? null,
  error: provisionBody.error ?? null,
  invokedAt: before,
}, null, 2));

if (process.env.DATABASE_URL) {
  const pg = await import('pg');
  const client = new pg.default.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const flag = await client.query(`SELECT enabled FROM public.feature_flags WHERE key = 'USE_V2_PROVISIONING'`);
  const logs = await client.query(
    `SELECT pl.step, pl.status, pl.created_at, pr.idempotency_key, pr.status AS request_status
     FROM public.provisioning_logs pl
     JOIN public.provisioning_requests pr ON pr.id = pl.request_id
     WHERE pl.created_at >= now() - interval '10 minutes'
     ORDER BY pl.created_at DESC
     LIMIT 20`
  );

  console.log('\n=== USE_V2_PROVISIONING (DB) ===');
  console.log(JSON.stringify(flag.rows[0], null, 2));
  console.log('\n=== provisioning_logs (last 10 min) ===');
  console.log(JSON.stringify(logs.rows, null, 2));

  const flagRead = await fetch(`${SUPABASE_URL}/rest/v1/feature_flags?select=key,enabled&key=eq.USE_V2_PROVISIONING`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${adminData.access_token}` },
  });
  const flagData = await flagRead.json();
  console.log('\n=== feature_flags read from browser client (admin JWT) ===');
  console.log(JSON.stringify({ status: flagRead.status, data: flagData }, null, 2));

  await client.end();
}

process.exit(provisionRes.ok ? 0 : 1);
