import pg from 'pg';

const shopId = process.argv[2];
if (!shopId) {
  console.error('Usage: node scripts/lookup-shop-detail.mjs <shop-id-or-search>');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
const pattern = `%${shopId.toLowerCase()}%`;
const shop = await client.query(
  `SELECT id, shop_name, owner_name, owner_email, username, password, status, plan, created_at
   FROM public.shops
   WHERE id::text = $1 OR lower(shop_name) LIKE $2 OR lower(owner_email) LIKE $2
   ORDER BY created_at DESC LIMIT 1`,
  [shopId, pattern]
);
const row = shop.rows[0];
if (!row) {
  console.log('Shop not found');
  process.exit(1);
}
const auth = await client.query('SELECT id, email FROM auth.users WHERE lower(email)=lower($1)', [row.owner_email]);
const prof = await client.query('SELECT id, email, role, shop_id FROM public.user_profiles WHERE shop_id=$1 OR lower(email)=lower($2)', [row.id, row.owner_email]);
console.log(JSON.stringify({ shop: row, authUsers: auth.rows, profiles: prof.rows }, null, 2));
await client.end();
