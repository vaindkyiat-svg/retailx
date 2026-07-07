import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const r = await client.query(`SELECT * FROM public.feature_flags WHERE key = 'USE_V2_PROVISIONING'`);
console.log(JSON.stringify(r.rows, null, 2));
await client.end();
