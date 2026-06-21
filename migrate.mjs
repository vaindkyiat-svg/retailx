import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envFile = readFileSync(resolve('.env.local'), 'utf-8');
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const [key, ...valueParts] = line.split('=');
  if (!key || key.startsWith('#')) continue;
  env[key.trim()] = valueParts.join('=').trim();
}

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://xheaeamycsqdwdezrixr.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const authKey = supabaseServiceRoleKey || supabaseAnonKey;
if (!authKey) {
  throw new Error('Missing Supabase auth key. Set VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local');
}

if (supabaseServiceRoleKey) {
  console.log('Using SUPABASE_SERVICE_ROLE_KEY for migration (recommended when RLS is enabled).');
} else {
  console.log('Using anon key for migration; this may fail if row-level security is enabled.');
}

const supabase = createClient(supabaseUrl, authKey);
async function runMigration() {
  console.log('Starting Supabase migration...');
  
  try {
    // Step 1: Check if columns exist and insert seed data
    console.log('\n1. Inserting seed shops with all fields...');
    const { data: inserted, error: insertError } = await supabase
      .from('shops')
      .insert([
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          shop_name: 'Banke Bihari Sweets & Restaurants',
          name: 'Banke Bihari Sweets & Restaurants',
          owner_name: 'Gopal Krishna Sharma',
          owner_phone: '+91 99999 12345',
          owner_email: 'bb.sweets@gmail.com',
          address: 'Vrindavan, Uttar Pradesh',
          gst_no: '09AABCU9603R1ZM',
          city: 'Vrindavan',
          state: 'Uttar Pradesh',
          category: 'Sweets & Restaurant',
          username: 'bankebiharipos',
          password: 'bihari@123',
          status: 'active',
          plan: 'premium',
          registered_on: '2024-01-15'
        },
        {
          id: 'a47ac10b-58cc-4372-a567-0e02b2c3d480',
          shop_name: 'Sharma General Store',
          name: 'Sharma General Store',
          owner_name: 'Ramesh Sharma',
          owner_phone: '+91 98888 54321',
          owner_email: 'sharma.store@gmail.com',
          address: 'Mathura, Uttar Pradesh',
          gst_no: '09BBCDE9501R1ZX',
          city: 'Mathura',
          state: 'Uttar Pradesh',
          category: 'Grocery & General',
          username: 'sharmastore',
          password: 'sharma@456',
          status: 'active',
          plan: 'standard',
          registered_on: '2024-02-20'
        }
      ], { onConflict: 'id' });
    
    if (insertError) {
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        console.log('⚠️  Columns not found - they need to be added in Supabase console');
        console.log('Error:', insertError.message);
        console.log('\nPlease run this SQL in your Supabase SQL Editor:');
        console.log(`
ALTER TABLE IF EXISTS public.shops
ADD COLUMN IF NOT EXISTS shop_name TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS registered_on TEXT;
        `);
        return;
      }
      console.error('❌ Error inserting seed shops:', insertError);
      return;
    }
    
    console.log('✅ Seed shops inserted/updated successfully');

    // Step 2: Verify data
    console.log('\n2. Verifying shops...');
    const { data: shops, error: selectError } = await supabase
      .from('shops')
      .select('id, shop_name, username, status, plan')
      .order('created_at', { ascending: false });
    
    if (selectError) {
      console.error('❌ Error fetching shops:', selectError);
      return;
    }
    
    console.log(`✅ Found ${shops.length} shops:`);
    shops.forEach((shop, i) => {
      console.log(`   ${i+1}. ${shop.shop_name} (${shop.username}) - ${shop.status}`);
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Reload http://localhost:5173');
    console.log('2. Log in as demo user (credentials in quick setup guide)');
    console.log('3. Test shop registration, inventory, and refunds');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

runMigration();
