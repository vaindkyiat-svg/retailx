# RetailX: Local Database to Supabase Migration Guide

## Overview

Your RetailX application has been upgraded to use **Supabase** as the backend database instead of local state management. This provides:

✅ **Cloud-based persistence** - Data survives browser refresh and app restarts
✅ **Multi-device sync** - Access your data from any device
✅ **Real-time updates** - Live data synchronization
✅ **Scalability** - Handle more data and users
✅ **Security** - Enterprise-grade data protection with Row Level Security

## What Changed

### Before (Local State)
```javascript
const [products, setProducts] = useState([]);
// Data only exists in memory
```

### After (Supabase)
```javascript
const { products, addProduct, updateProduct } = useShopData(shopId);
// Data persists in cloud database
```

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Create Supabase Project
- Visit [supabase.com](https://supabase.com)
- Create a new project
- Note your Project URL and Anon Public Key

### 3. Configure Environment
Create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Create Database Schema
- Open Supabase SQL Editor
- Copy contents of `src/lib/schema.sql`
- Run the SQL

### 5. Start Your App
```bash
pnpm dev
```

## File Structure

### New Files Added
- `src/lib/supabase.ts` - Supabase client configuration
- `src/lib/database.ts` - Database API functions
- `src/lib/useShopData.ts` - React hook for data management
- `src/lib/schema.sql` - Database schema
- `.env.local` - Environment variables (local only, not in git)

### Modified Files
- `src/app/App.tsx` - Integrated Supabase hooks
- `package.json` - Added `supabase` dependency

## API Functions Reference

### Products
```javascript
import { fetchProducts, addProduct, updateProduct, deleteProduct } from '@/lib/database';

// Fetch all products for a shop
const products = await fetchProducts(shopId);

// Add a new product
const newProduct = await addProduct(shopId, productData);

// Update existing product
await updateProduct(productId, shopId, updatedData);

// Delete a product
await deleteProduct(productId, shopId);
```

### Batches
```javascript
import { fetchBatches, addBatch, updateBatch, deleteBatch } from '@/lib/database';

// Similar pattern as products
const batches = await fetchBatches(shopId);
const newBatch = await addBatch(shopId, productId, batchData);
```

### Orders & Refunds
```javascript
import { fetchOrders, addOrder, fetchRefunds, addRefund } from '@/lib/database';

const orders = await fetchOrders(shopId);
await addOrder(shopId, orderData);

const refunds = await fetchRefunds(shopId);
await addRefund(shopId, refundData);
```

### Wastage
```javascript
import { fetchWastage, addWastage } from '@/lib/database';

const wastageLog = await fetchWastage(shopId);
await addWastage(shopId, wastageEntry);
```

### Drawer Operations
```javascript
import { fetchDrawerDay, createDrawerDay, addDrawerTransaction } from '@/lib/database';

const drawerDay = await fetchDrawerDay(shopId, dateISO);
const newDrawer = await createDrawerDay(shopId, drawerData);
await addDrawerTransaction(shopId, drawerDayId, txData);
```

## React Hook: useShopData

The `useShopData` hook handles all data operations for a shop:

```javascript
import { useShopData } from '@/lib/useShopData';

function MyComponent({ shopId }) {
  const {
    // Data
    products,
    batches,
    orders,
    refunds,
    wastageLog,
    drawerDay,
    batchMap,
    
    // States
    isLoading,
    error,
    
    // Methods
    addProduct,
    updateProduct,
    deleteProduct,
    addBatch,
    updateBatch,
    deleteBatch,
    addOrder,
    updateOrder,
    addRefund,
    addWastage,
    openDrawer,
    closeDrawer,
    addDrawerTx,
  } = useShopData(shopId);

  // Use in your component
  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
```

## Database Schema

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `shops` | Store locations | id, name, owner_name, address, gst_no |
| `products` | Inventory | id, shop_id, name, price, stock, emoji |
| `batches` | Batch tracking | id, product_id, batch_no, expiry_date, status |
| `orders` | Sales records | id, shop_id, date, total, payment_mode, items_data |
| `refunds` | Refund records | id, order_id, amount, refund_mode |
| `wastage_entries` | Loss tracking | id, product_id, reason, quantity, total_loss |
| `drawer_days` | Cash drawer | id, shop_id, date, opening_balance, closing_balance |
| `drawer_transactions` | Drawer entries | id, drawer_day_id, type, amount, balance |

## Field Name Mapping

The database uses snake_case, while your code may use camelCase. Key mappings:

| Code (camelCase) | Database (snake_case) |
|-------------------|----------------------|
| shopId | shop_id |
| productId | product_id |
| batchNo | batch_no |
| mfgDate | mfg_date |
| expiryDate | expiry_date |
| costPrice | cost_price |
| customerId | customer_id |
| customerName | customer_name |
| paymentMode | payment_mode |
| discountType | discount_type |
| refundMode | refund_mode |
| lowStockThreshold | low_stock_threshold |

The database functions handle this conversion automatically.

## Troubleshooting

### Error: "Missing Supabase environment variables"
**Cause:** `.env.local` file not configured
**Solution:** 
1. Create `.env.local` in project root
2. Add your Supabase credentials
3. Restart dev server

### Error: "Connection refused"
**Cause:** Supabase URL or key is incorrect
**Solution:**
1. Verify URLs in `.env.local`
2. Check for typos
3. Ensure no extra spaces

### Error: "relation 'products' does not exist"
**Cause:** Database schema not created
**Solution:**
1. Go to Supabase → SQL Editor
2. Run the contents of `src/lib/schema.sql`
3. Check for error messages

### Slow performance
**Cause:** Too many requests or missing indexes
**Solution:**
1. Check browser network tab for request waterfalls
2. Verify indexes are created (they are in the schema)
3. Add caching if needed
4. Contact Supabase support for slow query analysis

## Security Considerations

### In Development
For testing, RLS is disabled. This is fine locally.

### Before Production
1. Enable Row Level Security (RLS) for all tables
2. Create proper RLS policies based on your auth model
3. Use service role key only for admin operations
4. Implement proper authentication with Supabase Auth
5. Set up backups in Supabase dashboard

### Environment Variables
- **Never commit `.env.local` to git** - Add to `.gitignore`
- **Keep your Anon Key safe** - It's public but tied to your rules
- **Use Service Key only on backend** - Never expose in frontend code

## Performance Tips

1. **Batch Operations** - Use Promise.all() for multiple fetches
2. **Pagination** - Implement for large datasets
3. **Caching** - Store frequently accessed data locally
4. **Indexing** - Already included in schema.sql
5. **Real-time** - Consider Supabase subscriptions for live updates

## Monitoring

### Check Request Usage
- Supabase Dashboard → API
- Monitor request counts and latency

### View Logs
- Supabase Dashboard → Logs
- Check for errors and slow queries

### Database Backups
- Supabase Dashboard → Database → Backups
- Set up automatic backups

## Next Steps

1. **Test Thoroughly** - Verify all features work with Supabase
2. **Implement Auth** - Add Supabase authentication
3. **Add Real-time** - Use Supabase subscriptions
4. **Set up RLS** - Implement security policies
5. **Monitor Usage** - Track API calls and storage
6. **Plan Scaling** - Consider upgrade paths as you grow

## Common Tasks

### Export Data
```sql
-- In Supabase SQL Editor
SELECT * FROM products WHERE shop_id = 'shop-uuid' 
  LIMIT 1000
```

### Migrate Data
```javascript
// Export from old system, import to Supabase
const data = await legacyDatabase.getProducts();
await Promise.all(data.map(p => addProduct(shopId, p)));
```

### Backup Data
```bash
# Using Supabase CLI
supabase db pull > backup.sql
```

## Getting Help

- **Supabase Docs:** https://supabase.com/docs
- **Database Errors:** Check Supabase → Logs
- **Application Errors:** Check browser console
- **API Issues:** Check network tab in DevTools

## Cost Considerations

Supabase free tier includes:
- Up to 500 MB database
- Up to 2 GB file storage
- 50,000 monthly active users
- Generous API rate limits

Monitor your usage in the Supabase dashboard and upgrade if needed.
