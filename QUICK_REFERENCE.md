# Quick Reference: Supabase + RetailX

## 🚀 Get Started in 5 Minutes

### Step 1: Create Supabase Project (2 min)
1. Go to https://supabase.com
2. Click "New Project"
3. Fill in project name, password, region
4. Copy Project URL and Anon Key

### Step 2: Configure App (1 min)
Create `.env.local`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-key-here
```

### Step 3: Create Database (1 min)
1. Open Supabase SQL Editor
2. Paste contents of `src/lib/schema.sql`
3. Click Run

### Step 4: Start App (1 min)
```bash
pnpm install
pnpm dev
```

**✅ Done! Your app is now using Supabase**

---

## 📋 Key Files

| File | Purpose |
|------|---------|
| `.env.local` | Your Supabase credentials |
| `src/lib/supabase.ts` | Supabase client |
| `src/lib/database.ts` | All API functions |
| `src/lib/useShopData.ts` | React hook for data |
| `src/lib/schema.sql` | Database schema |
| `src/app/App.tsx` | Main app (updated) |

---

## 🔄 Data Operations

### Add/Update/Delete
```javascript
import { useShopData } from '@/lib/useShopData';

const { 
  products, 
  addProduct, 
  updateProduct, 
  deleteProduct 
} = useShopData(shopId);

// Add
await addProduct({ name: "Tea", price: 50, ... });

// Update
await updateProduct(productId, { price: 55 });

// Delete
await deleteProduct(productId);
```

### Fetch Data
```javascript
import { 
  fetchProducts, 
  fetchOrders, 
  fetchRefunds 
} from '@/lib/database';

const products = await fetchProducts(shopId);
const orders = await fetchOrders(shopId);
const refunds = await fetchRefunds(shopId);
```

---

## 🗄️ Database Tables

```
shops                    (Store locations)
├── id (UUID)
├── name
├── owner_name
└── ...

products                (Inventory)
├── id (auto)
├── shop_id (FK)
├── name
├── price
├── stock
└── ...

batches                 (Batch tracking)
├── id (UUID)
├── product_id (FK)
├── batch_no
├── expiry_date
└── ...

orders                  (Sales)
├── id (text)
├── shop_id (FK)
├── date
├── total
└── items_data (JSON)

refunds                 (Refunds)
├── id (text)
├── order_id (FK)
├── amount
└── ...

wastage_entries        (Loss tracking)
├── id (UUID)
├── product_id (FK)
├── reason
├── quantity
└── ...

drawer_days           (Cash drawer)
├── id (UUID)
├── shop_id (FK)
├── date
├── opening_balance
└── closing_balance

drawer_transactions   (Drawer entries)
├── id (text)
├── drawer_day_id (FK)
├── type
├── amount
└── balance
```

---

## 🛠️ Common Tasks

### Load All Data for a Shop
```javascript
const {
  products,
  orders,
  refunds,
  batchMap,
  wastageLog,
  drawerDay,
  isLoading
} = useShopData(shopId);
```

### Handle Loading/Error
```javascript
if (isLoading) return <Loader />;
if (error) return <Error message={error} />;
```

### Add Product to Inventory
```javascript
await addProduct({
  name: "Chai",
  category: "Beverages",
  price: 20,
  unit: "cups",
  stock: 100,
  emoji: "☕",
  lowStockThreshold: 20
});
```

### Record a Sale
```javascript
await addOrder({
  id: `ORD-${Date.now()}`,
  date: todayISO,
  time: nowTime(),
  customer_name: "Rajesh",
  items: cartItems,
  subtotal: 500,
  discount_type: "percent",
  discount_value: 10,
  discount_amount: 50,
  total: 450,
  payment_mode: "Cash",
  status: "Completed"
});
```

### Track Wastage
```javascript
await addWastage({
  product_id: 5,
  product_name: "Milk",
  reason: "expired",
  quantity: 2,
  cost_price: 50,
  total_loss: 100,
  // ... other fields
});
```

### Manage Drawer
```javascript
// Open drawer
await openDrawer(5000);  // Opening balance: ₹5000

// Add transaction
await addDrawerTx({
  type: "sale",
  description: "Sale ORD-1234",
  amount: 450
});

// Close drawer
await closeDrawer();
```

---

## 🔍 Field Name Mapping

| Code | Database |
|------|----------|
| `order.customerName` | `customer_name` |
| `order.paymentMode` | `payment_mode` |
| `batch.batchNo` | `batch_no` |
| `batch.mfgDate` | `mfg_date` |
| `batch.expiryDate` | `expiry_date` |
| `batch.costPrice` | `cost_price` |
| `product.lowStockThreshold` | `low_stock_threshold` |
| `drawer.closingBalance` | `closing_balance` |
| `wastage.productId` | `product_id` |
| `wastage.totalLoss` | `total_loss` |

---

## ⚠️ Important

### Security
- 🔒 Never commit `.env.local` 
- 🔒 Keep Anon Key confidential
- 🔒 Enable RLS before production

### Development
- ✅ Test thoroughly before production
- ✅ Disable RLS only for development
- ✅ Monitor Supabase usage
- ✅ Set up backups

---

## 🆘 Troubleshooting

### "Missing environment variables"
```
→ Create .env.local with your Supabase credentials
```

### "Connection error"
```
→ Check VITE_SUPABASE_URL is correct
→ Verify Supabase project is running
```

### "Table does not exist"
```
→ Run SQL from src/lib/schema.sql in Supabase
```

### "Permission denied"
```
→ Disable RLS: see INTEGRATION_STEPS.md
```

### Data not persisting
```
→ Check browser DevTools → Network tab
→ Look for failed API requests
→ Check Supabase dashboard → Logs
```

---

## 📚 Documentation Files

| Document | When to Read |
|----------|--------------|
| `SUPABASE_SETUP.md` | Initial setup |
| `INTEGRATION_STEPS.md` | Field name updates |
| `MIGRATION_GUIDE.md` | Complete reference |
| `SUPABASE_MIGRATION_SUMMARY.md` | Overall summary |
| This file | Quick reference |

---

## 🎯 API Reference Summary

```javascript
// All functions in src/lib/database.ts

// Shops
fetchShops()
addShop(shop)
updateShop(id, updates)

// Products
fetchProducts(shopId)
addProduct(shopId, data)
updateProduct(id, shopId, data)
deleteProduct(id, shopId)

// Batches
fetchBatches(shopId)
addBatch(shopId, productId, batch)
updateBatch(id, shopId, changes)
deleteBatch(id, shopId)

// Orders
fetchOrders(shopId)
addOrder(shopId, order)
updateOrder(id, shopId, updates)

// Refunds
fetchRefunds(shopId)
addRefund(shopId, refund)

// Wastage
fetchWastage(shopId)
addWastage(shopId, entry)

// Drawer
fetchDrawerDay(shopId, date)
createDrawerDay(shopId, data)
updateDrawerDay(id, shopId, updates)
addDrawerTransaction(shopId, drawerDayId, tx)
fetchDrawerTransactions(drawerDayId)

// Auth
getAuthUser()
```

---

## 🚀 Next Steps

1. ✅ Set up Supabase project
2. ✅ Configure `.env.local`
3. ✅ Create database schema
4. ✅ Test the app
5. 📋 Read INTEGRATION_STEPS.md for field updates
6. 🔐 Enable RLS for production
7. 🔑 Implement authentication
8. 📊 Set up monitoring

---

## 📞 Help

- Supabase Docs: https://supabase.com/docs
- Check `.env.local` configuration
- Look in browser DevTools Console
- Check Supabase Dashboard → Logs

**You're ready to go! 🎉**
