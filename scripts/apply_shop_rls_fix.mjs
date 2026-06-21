import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '..', '.env.local');
const txt = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  txt
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const statements = [
  `ALTER TABLE IF EXISTS public.shops ENABLE ROW LEVEL SECURITY;`,
  `DROP POLICY IF EXISTS "Shop owners can access own shop" ON public.shops;`,
  `DROP POLICY IF EXISTS "Shop owners can access own shop by email" ON public.shops;`,
  `DROP POLICY IF EXISTS "Admins can manage all shops" ON public.shops;`,
  `CREATE POLICY "Shop owners can access own shop by email" ON public.shops
    FOR SELECT, UPDATE, DELETE
    TO authenticated
    USING (
      owner_email = auth.email()
    )
    WITH CHECK (
      owner_email = auth.email()
    );`,
  `CREATE POLICY "Admins can manage all shops" ON public.shops
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
          AND role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid()
          AND role = 'admin'
      )
    );`,
];

async function applyFix() {
  console.log('Applying shop RLS fix...');
  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec', { sql: stmt });
    if (error) {
      console.error('Error executing:', stmt.slice(0, 50), error.message);
    } else {
      console.log('✓', stmt.slice(0, 60));
    }
  }
  console.log('✅ RLS fix applied!');
}

applyFix().catch(console.error);
