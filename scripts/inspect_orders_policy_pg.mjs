import pkg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
const { Client } = pkg;

function loadEnv() {
  const envPath = resolve('.env.local');
  const raw = readFileSync(envPath, 'utf8');
  return Object.fromEntries(raw.split(/\r?\n/).filter(Boolean).map(line => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i+1)];
  }));
}

(async () => {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const { hostname, pathname, protocol, port } = new URL(url);
  const connectionString = `${protocol}//postgres:${key}@${hostname}${port ? `:${port}` : ''}${pathname}`;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('Connected to database');
    const res = await client.query("SELECT policyname, cmd, permissive, roles, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='orders';");
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
})();
