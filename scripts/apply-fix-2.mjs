import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

await client.query(`
  UPDATE public.feature_flags
  SET environments = jsonb_build_object(
    'development', false,
    'staging', false,
    'production', true
  ),
  updated_at = now()
  WHERE key = 'USE_V2_PROVISIONING'
`);

const verify = await client.query(`
  SELECT key, enabled, environments
  FROM public.feature_flags
  WHERE key = 'USE_V2_PROVISIONING'
`);

console.log('=== FLAG AFTER FIX 2 ===');
console.log(JSON.stringify(verify.rows[0], null, 2));

await client.end();
