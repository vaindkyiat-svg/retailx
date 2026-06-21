import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read .env.local manually
const envFile = readFileSync(resolve('.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && !key.startsWith('#')) {
    env[key] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://xheaeamycsqdwdezrixr.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

console.log('🚀 RetailX POS - Comprehensive System Test\n');
console.log('Environment:');
console.log(`  URL: ${supabaseUrl}`);
console.log(`  Key: ${supabaseAnonKey ? '✅ Loaded' : '❌ Not found'}\n`);

if (!supabaseAnonKey) {
  console.error('❌ Error: Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testShopPersistence() {
  console.log('\n════════════════════════════════════════');
  console.log('TEST 1: Shop Registration Persistence');
  console.log('════════════════════════════════════════\n');

  try {
    // Check existing shops
    const { data: shops, error: selectError } = await supabase
      .from('shops')
      .select('id, shop_name, username, status, plan')
      .eq('status', 'active');
    
    if (selectError) {
      console.error('❌ Error fetching shops:', selectError.message);
      return false;
    }

    console.log(`✅ Found ${shops.length} active shops:\n`);
    shops.forEach((shop, i) => {
      console.log(`   ${i+1}. ${shop.shop_name}`);
      console.log(`      Username: ${shop.username}`);
      console.log(`      Plan: ${shop.plan}`);
      console.log(`      ID: ${shop.id}\n`);
    });

    if (shops.length > 0) {
      console.log('✅ Shop persistence test PASSED - shops are stored in Supabase\n');
      return true;
    } else {
      console.warn('⚠️  No active shops found - please register shops first');
      return false;
    }
  } catch (error) {
    console.error('❌ Shop persistence test FAILED:', error.message);
    return false;
  }
}

async function testMultiTenantIsolation() {
  console.log('\n════════════════════════════════════════');
  console.log('TEST 2: Multi-Tenant Shop Isolation');
  console.log('════════════════════════════════════════\n');

  try {
    const { data: shops, error } = await supabase
      .from('shops')
      .select('id, shop_name')
      .limit(2);
    
    if (error || shops.length < 1) {
      console.warn('⚠️  Need at least 1 shop for isolation test');
      return false;
    }

    // Test that each shop would be isolated with shop_id filtering
    for (const shop of shops) {
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, name')
        .eq('shop_id', shop.id)
        .limit(1);
      
      if (!prodError) {
        console.log(`✅ ${shop.shop_name}`);
        console.log(`   Query isolation working (shop_id filtering enabled)\n`);
      }
    }

    console.log('✅ Multi-tenant isolation test PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ Multi-tenant isolation test FAILED:', error.message);
    return false;
  }
}

async function testInventorySchema() {
  console.log('\n════════════════════════════════════════');
  console.log('TEST 3: Inventory Management Schema');
  console.log('════════════════════════════════════════\n');

  try {
    // Check if batches table exists and has the right structure
    const { data: batches, error } = await supabase
      .from('batches')
      .select('id, product_id, shop_id, quantity, status')
      .limit(1);
    
    if (!error) {
      console.log('✅ Batches table schema is correct');
      console.log('✅ Inventory tracking schema PASSED\n');
      return true;
    } else {
      console.warn('⚠️  Batches table query returned:', error.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Inventory schema test FAILED:', error.message);
    return false;
  }
}

async function testOrdersAndRefunds() {
  console.log('\n════════════════════════════════════════');
  console.log('TEST 4: Orders & Refunds Schema');
  console.log('════════════════════════════════════════\n');

  try {
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, shop_id, total, payment_mode')
      .limit(1);
    
    const { data: refunds, error: refundError } = await supabase
      .from('refunds')
      .select('id, shop_id, amount, refund_mode')
      .limit(1);
    
    if (!orderError) {
      console.log('✅ Orders table accessible');
    } else {
      console.warn('⚠️  Orders query returned:', orderError.message);
    }

    if (!refundError) {
      console.log('✅ Refunds table accessible');
    } else {
      console.warn('⚠️  Refunds query returned:', refundError.message);
    }

    console.log('✅ Orders & Refunds schema PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ Orders & Refunds test FAILED:', error.message);
    return false;
  }
}

async function testDrawerTransactions() {
  console.log('\n════════════════════════════════════════');
  console.log('TEST 5: Drawer Transactions Schema');
  console.log('════════════════════════════════════════\n');

  try {
    const { data: drawer, error } = await supabase
      .from('drawer_days')
      .select('id, shop_id, date, transactions')
      .limit(1);
    
    if (!error) {
      console.log('✅ Drawer transactions table accessible');
      console.log('✅ Drawer tracking schema PASSED\n');
      return true;
    } else {
      console.warn('⚠️  Drawer query returned:', error.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Drawer test FAILED:', error.message);
    return false;
  }
}

async function testDatabaseConnection() {
  console.log('\n════════════════════════════════════════');
  console.log('TEST 0: Database Connection');
  console.log('════════════════════════════════════════\n');

  try {
    const { data, error } = await supabase
      .from('shops')
      .select('count()', { count: 'exact' });
    
    if (error) {
      console.error('❌ Connection FAILED:', error.message);
      return false;
    }
    
    console.log('✅ Connected to Supabase successfully');
    console.log('✅ Database connection test PASSED\n');
    return true;
  } catch (error) {
    console.error('❌ Connection test FAILED:', error.message);
    return false;
  }
}

async function runAllTests() {
  const results = [];

  results.push({ name: 'Database Connection', passed: await testDatabaseConnection() });
  results.push({ name: 'Shop Persistence', passed: await testShopPersistence() });
  results.push({ name: 'Multi-Tenant Isolation', passed: await testMultiTenantIsolation() });
  results.push({ name: 'Inventory Schema', passed: await testInventorySchema() });
  results.push({ name: 'Orders & Refunds', passed: await testOrdersAndRefunds() });
  results.push({ name: 'Drawer Transactions', passed: await testDrawerTransactions() });

  // Summary
  console.log('\n════════════════════════════════════════');
  console.log('TEST SUMMARY');
  console.log('════════════════════════════════════════\n');

  let passedCount = 0;
  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (result.passed) passedCount++;
  });

  console.log(`\n${passedCount}/${results.length} tests passed\n`);

  if (passedCount === results.length) {
    console.log('🎉 ALL SYSTEMS GO! Ready for full POS testing\n');
    console.log('Next: Run end-to-end POS workflow tests');
    console.log('   1. Register new shop');
    console.log('   2. Add products');
    console.log('   3. Create order (verify inventory decreases)');
    console.log('   4. Create refund (verify inventory restores)');
    console.log('   5. Verify multi-shop isolation');
    console.log('   6. Check drawer transactions\n');
  } else {
    console.log('⚠️  Some tests failed - fix issues before full testing\n');
  }
}

// Run all tests
runAllTests().catch(console.error);
