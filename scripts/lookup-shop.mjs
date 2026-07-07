import pg from 'pg';

const term = process.argv[2] ?? '';
if (!term) {
  console.error('Usage: node scripts/lookup-shop.mjs <search-term>');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
const pattern = `%${term.toLowerCase()}%`;
const res = await client.query(
  `SELECT s.id, s.shop_name, s.name, s.owner_name, s.owner_email, s.username, s.password, s.status, s.plan,
          up.id AS profile_id, up.email AS profile_email, up.role
   FROM public.shops s
   LEFT JOIN public.user_profiles up ON up.shop_id = s.id
   WHERE lower(coalesce(s.shop_name, s.name, '')) LIKE $1
      OR lower(coalesce(s.owner_name, '')) LIKE $1
      OR lower(coalesce(s.owner_email, '')) LIKE $1
      OR lower(coalesce(s.username, '')) LIKE $1
   ORDER BY s.created_at DESC`,
  [pattern]
);

let authUsers = [];
try {
  const auth = await client.query(
    `SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed
     FROM auth.users
     WHERE lower(email) LIKE $1`,
    [pattern]
  );
  authUsers = auth.rows;
} catch {
  // auth schema may be unavailable in some environments
}

console.log(JSON.stringify({ shops: res.rows, authUsers }, null, 2));
await client.end();