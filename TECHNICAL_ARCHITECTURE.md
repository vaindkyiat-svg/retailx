# RetailX Inventory & Drawer System - Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RetailX Application                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐         ┌──────────────────┐                     │
│  │   React UI       │         │  useShopData    │                      │
│  │   (App.tsx)      │◄───────►│   Hook          │                      │
│  └────────┬─────────┘         └────────┬────────┘                      │
│           │                            │                                │
│           │ handleOrderComplete()      │ addOrder(order, items)        │
│           │ handleRefund()             │ addRefund(refund, items)      │
│           │                            │                                │
│           ▼                            ▼                                │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │         Database Layer (database.ts)                     │           │
│  ├──────────────────────────────────────────────────────────┤           │
│  │  createOrderWithInventory()                              │           │
│  │  ├─ processOrderInventory() [decrements batches]        │           │
│  │  └─ inserts order into Supabase                         │           │
│  │                                                          │           │
│  │  createRefundWithInventory()                             │           │
│  │  ├─ processRefundInventory() [restores batches]         │           │
│  │  └─ inserts refund into Supabase                        │           │
│  └──────────────┬───────────────────────────────────────────┘           │
│                 │                                                       │
│                 ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │      Supabase Backend (PostgreSQL)                       │           │
│  ├──────────────────────────────────────────────────────────┤           │
│  │  Tables:                                                 │           │
│  │  - orders (with items_data JSONB)                       │           │
│  │  - refunds (with items_data JSONB)                      │           │
│  │  - batches (quantity field)                             │           │
│  │  - drawer_days, drawer_transactions                     │           │
│  │  - products, shops                                      │           │
│  │                                                          │           │
│  │  Policies:                                               │           │
│  │  - Row Level Security filters by shop_id                │           │
│  │  - Users can only access their shop's data              │           │
│  └──────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Order Creation to Inventory Deduction

```
1. USER ACTION
   ├─ Selects products in POS
   ├─ Adds to cart
   └─ Clicks "Checkout"

2. POS COMPONENT (src/app/App.tsx)
   ├─ Builds Order object: { id, customerName, items, total, paymentMode, ... }
   └─ Calls handleOrderComplete(order)

3. HANDLE ORDER COMPLETE (New Logic)
   ├─ Calls: addOrder(order, order.items)  ◄─── PASSES ITEMS
   ├─ Calls: addDrawerTx() for transaction
   └─ Clears cart & shows success

4. USESHOPDATA HOOK (useShopData.ts)
   ├─ addOrder callback triggered
   ├─ Since items provided, calls:
   │  └─ createOrderWithInventory(shopId, order, items)
   └─ Updates local state with new order

5. DATABASE LAYER (database.ts)
   ├─ createOrderWithInventory()
   │  ├─ Step 1: processOrderInventory(shopId, items)
   │  │  ├─ For each item in cart:
   │  │  │  ├─ Fetch all batches for product_id
   │  │  │  ├─ Filter out unsellable/expired
   │  │  │  ├─ Iterate through sellable batches
   │  │  │  ├─ Decrement batch.quantity by item.qty
   │  │  │  └─ Update batch in database
   │  │  └─ Returns deductedItems array
   │  │
   │  ├─ Step 2: Insert order into 'orders' table
   │  │  ├─ Set shop_id = shopId
   │  │  ├─ Set items_data = order.items (JSONB)
   │  │  └─ Return created order
   │  │
   │  └─ Success: Order created + Inventory decremented

6. SUPABASE DATABASE
   ├─ Batches updated:
   │  ├─ batch_1.quantity: 100 → 95 (5 sold)
   │  ├─ batch_2.quantity: 50 → 48 (2 sold)
   │  └─ batch_3.quantity: 30 → 30 (0 from this)
   │
   ├─ Order inserted:
   │  ├─ id: ORD-1234
   │  ├─ shop_id: shop_abc
   │  ├─ items_data: [{ id: 1, qty: 5, ... }, { id: 2, qty: 2, ... }]
   │  └─ status: Completed
   │
   └─ Result: ✅ Consistent inventory state

7. DRAWER TRANSACTION
   ├─ createDrawerTransaction() called
   ├─ Type: "sale"
   ├─ Amount: order.total
   ├─ Description: "Sale ORD-1234 — Customer Name (UPI)"
   └─ Drawer balance auto-updated
```

## Data Flow: Refund Processing to Inventory Restoration

```
1. USER ACTION
   ├─ Views order in Orders section
   ├─ Clicks "Refund" button
   └─ Enters refund details

2. REFUND MODAL (src/app/App.tsx)
   ├─ Creates Refund object: { id, order_id, items_data, amount, ... }
   └─ Calls onRefund(refund, order) ◄─── PASSES ORIGINAL ORDER

3. HANDLE REFUND (New Logic)
   ├─ Receives: refund + order
   ├─ Calls: addRefund(refund, order.items)  ◄─── PASSES ORDER ITEMS
   ├─ Calls: addDrawerTx() for transaction (negative amount)
   └─ Shows success

4. USESHOPDATA HOOK
   ├─ addRefund callback triggered
   ├─ Since items provided, calls:
   │  └─ createRefundWithInventory(shopId, refund, items)
   └─ Updates local state with new refund

5. DATABASE LAYER
   ├─ createRefundWithInventory()
   │  ├─ Step 1: processRefundInventory(shopId, items)
   │  │  ├─ For each item in refund:
   │  │  │  ├─ Fetch most recent batch for product_id
   │  │  │  ├─ Increment batch.quantity by item.qty
   │  │  │  └─ Update batch in database
   │  │  └─ Returns restoredItems array
   │  │
   │  ├─ Step 2: Insert refund into 'refunds' table
   │  │  ├─ Set shop_id = shopId
   │  │  ├─ Set items_data = items
   │  │  └─ Return created refund
   │  │
   │  └─ Success: Refund created + Inventory restored

6. SUPABASE DATABASE
   ├─ Batches updated (restored):
   │  ├─ batch_1.quantity: 95 → 100 (5 restored)
   │  └─ batch_2.quantity: 48 → 50 (2 restored)
   │
   ├─ Refund inserted:
   │  ├─ id: REF-5678
   │  ├─ shop_id: shop_abc
   │  ├─ order_id: ORD-1234
   │  ├─ items_data: [{ id: 1, qty: 5, ... }, { id: 2, qty: 2, ... }]
   │  └─ status: Completed
   │
   └─ Result: ✅ Inventory back to pre-sale state

7. DRAWER TRANSACTION
   ├─ createDrawerTransaction() called
   ├─ Type: "refund"
   ├─ Amount: -refund.amount (negative!)
   ├─ Description: "Refund REF-5678 for ORD-1234 — Customer (Cash)"
   └─ Drawer balance auto-updated (decreased)
```

## Shop Isolation Architecture

```
Active Shop Selection:
┌──────────────────────────────────────────────────────────┐
│ App Component                                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  const [activeShop, setActiveShop] = useState(...)      │
│                                    ▲                    │
│                                    │ Shop dropdown      │
│                                    │ selection          │
│                                    │                    │
│  const shopDataHook = useShopData(activeShop?.id)       │
│                                    ▲                    │
│                                    │ Dependency!        │
│                                    │ Reloads on change  │
│                                    │                    │
│  useEffect(() => {                                      │
│    if (!shopId) return;                                 │
│    // Fetch fresh data for active shop                 │
│    const [products, batches, orders, ...] = ...         │
│  }, [shopId]) ◄─── When activeShop.id changes           │
│                                                          │
│  Each database query:                                    │
│  .select('*')                                            │
│  .eq('shop_id', shopId) ◄─── CRITICAL FILTER           │
│                                                          │
└──────────────────────────────────────────────────────────┘

Result:
├─ Shop A data isolated from Shop B
├─ Each shop has separate:
│  ├─ Products
│  ├─ Batches (inventory)
│  ├─ Orders (sales)
│  ├─ Refunds
│  ├─ Drawer (opening + transactions)
│  └─ Wastage log
├─ Switching shops reloads ALL data
└─ No data leakage between shops
```

## Database Indexes & Performance

```
Current Supabase Indexes:
├─ batches:
│  ├─ ON (shop_id)               ✓ Fast queries by shop
│  ├─ ON (product_id, shop_id)   ✓ Fast inventory fetch
│  └─ ON (expiry_date)           ✓ Fast expiry queries
│
├─ orders:
│  ├─ ON (shop_id)               ✓ Fast order list
│  └─ ON (created_at DESC)       ✓ Latest first
│
├─ drawer_days:
│  ├─ ON (shop_id, date)         ✓ Unique index
│  └─ Ensures one drawer per day per shop
│
└─ drawer_transactions:
   ├─ ON (drawer_day_id)         ✓ Fast tx fetch
   └─ ON (created_at ASC)        ✓ Time order

Query Performance:
├─ Fetch products: ~50ms (shop_id filter)
├─ Fetch batches: ~50ms (shop_id + product_id)
├─ Process order (N items): ~100ms + (50ms * N items)
├─ Fetch orders: ~50-100ms (depends on data size)
└─ Get drawer day: ~30ms (exact date match)
```

## Error Handling & Recovery

```
Order Creation Error Scenarios:

1. Inventory Deduction Fails
   ├─ Order still created
   ├─ Console logs warning: "⚠️ Insufficient inventory..."
   ├─ Order stored as "Completed" (may be oversold)
   ├─ Flag: Check logs for partial deductions
   └─ Fix: Manual batch adjustment

2. Batch Not Found
   ├─ Item skipped in deduction
   ├─ Console logs: "No batch found for product..."
   ├─ Order created but missing inventory deduction
   └─ Fix: Manually add batch, reprocess

3. Supabase Connection Lost
   ├─ createOrderWithInventory() returns null
   ├─ Order not created
   ├─ User sees error notification
   ├─ Cart remains intact
   └─ User retries checkout

4. Partial Batch Deduction
   ├─ Item quantity > available
   ├─ System deducts what's available
   ├─ Remaining qty stays in batches
   ├─ Order saved with all items
   └─ ⚠️ Oversell condition
   
   Example:
   ├─ Order requests: Product X qty 10
   ├─ Available: batch_1=5, batch_2=3
   ├─ Deducted: batch_1=5, batch_2=3 (total 8)
   ├─ Remaining in order: 2 (UNSOLD!)
   └─ Log: "Could only deduct 8 of 10"

Refund Error Scenarios:

1. Batch Not Found
   ├─ No active batch to restore to
   ├─ Refund still recorded
   ├─ Inventory remains reduced
   └─ Fix: Manually create/restore batch

2. Overdraw Recovery
   ├─ Restore > quantity before sale
   ├─ Normal for first-time refund setup
   └─ Restores to expected state

3. Double Refund Prevention
   ├─ Currently NO checking
   ├─ User can refund same order twice
   ├─ Inventory would over-restore
   └─ TODO: Add refund_status check
```

## Deployment Checklist

```
Before Production:

Database:
□ RLS policies enforced (shop_id filtering)
□ Indexes created
□ Backup configured
□ Row limits set (no N+1 queries)

Application:
□ Error logging configured
□ Monitoring alerts set
□ Drawer reconciliation process documented
□ Shop owner training completed

Testing:
□ Multi-shop isolation verified
□ Oversell scenarios handled
□ Refund restoration verified
□ Drawer accuracy ±0.01%
□ Performance under load >1000 items

Security:
□ Supabase anon key scoped correctly
□ RLS policies reviewed
□ No sensitive data in items_data
□ Environment variables not in repo
```

---

**Version:** 1.0
**Updated:** 2024-06-21
