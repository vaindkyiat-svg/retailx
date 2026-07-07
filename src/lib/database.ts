import { supabase, createServiceSupabase } from './supabase';

// Create a server-only service client when running in Node (server scripts / serverless).
// This ensures the Service Role key is never bundled into the browser build.
const supabaseService = (typeof window === 'undefined')
  ? createServiceSupabase(typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined)
  : null;

const dbClient = supabaseService ?? supabase;

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface Product {
  id: number;
  shop_id: string;
  name: string;
  nameHi: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  emoji: string;
  lowStockThreshold: number;
  created_at?: string;
  updated_at?: string;
}

export interface Batch {
  id: string;
  product_id: number;
  shop_id: string;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  addedDate: string;
  status: 'active' | 'near-expiry' | 'unsellable' | 'expired';
  manualUnsellable?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CartItem extends Product {
  qty: number;
}

export interface Order {
  id: string;
  shop_id: string;
  date: string;
  time: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  discountType: 'percent' | 'flat';
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentMode: 'Cash' | 'UPI' | 'Card';
  status: 'Completed' | 'Pending' | 'Cancelled';
  created_at?: string;
  updated_at?: string;
}

export interface Refund {
  id: string;
  shop_id: string;
  orderId: string;
  date: string;
  time: string;
  customerName: string;
  reason: string;
  amount: number;
  refundMode: 'Cash' | 'UPI' | 'Card';
  items: CartItem[];
  created_at?: string;
  updated_at?: string;
}

export type WastageReason = 'expired' | 'near-expiry-cutoff' | 'damaged' | 'quality-issue' | 'other';

export interface WastageEntry {
  id: string;
  shop_id: string;
  date: string;
  time: string;
  productId: number;
  productName: string;
  productEmoji: string;
  category: string;
  batchNo: string;
  batchId: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
  totalLoss: number;
  reason: WastageReason;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

export interface DrawerTx {
  id: string;
  shop_id: string;
  date: string;
  time: string;
  type: 'opening' | 'withdrawal' | 'deposit' | 'sale' | 'refund';
  description: string;
  amount: number;
  balance: number;
  created_at?: string;
}

export interface DrawerDay {
  id: string;
  shop_id: string;
  date: string;
  openingBalance: number;
  closingBalance: number | null;
  transactions: DrawerTx[];
  created_at?: string;
  updated_at?: string;
}

export interface RegisteredShop {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  city?: string;
  state?: string;
  category?: string;
  username?: string;
  password?: string;
  status?: string;
  plan?: string;
  registeredOn?: string;
  created_at?: string;
  updated_at?: string;
}

// Auth operations: import from src/lib/auth (Milestone D1.2).

// ─── Shop Operations ────────────────────────────────────────────────────────

export class ShopFetchError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ShopFetchError';
    this.code = code;
  }
}

export type ShopPlan = 'basic' | 'standard' | 'premium';

function normalizeShopPlan(plan: string | null | undefined): ShopPlan {
  switch ((plan ?? 'standard').toLowerCase()) {
    case 'free':
    case 'basic':
      return 'basic';
    case 'starter':
    case 'standard':
      return 'standard';
    case 'growth':
    case 'enterprise':
    case 'premium':
    case 'pro':
      return 'premium';
    default:
      return 'standard';
  }
}

function mapDbShopToRegisteredShop(row: any): RegisteredShop {
  return {
    id: row.id,
    shopName: row.shop_name || row.name || '',
    ownerName: row.owner_name || '',
    phone: row.owner_phone || '',
    email: row.owner_email || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    category: row.category || '',
    gstin: row.gst_no || '',
    username: row.username || '',
    password: row.password || '',
    status: row.status || 'active',
    plan: normalizeShopPlan(row.plan),
    registeredOn: row.registered_on || '',
  };
}

export async function fetchShops(): Promise<RegisteredShop[]> {
  const client = supabaseService || supabase;
  const { data, error } = await client
    .from('shops')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching shops:', error);
    throw new ShopFetchError(error.message, error.code);
  }

  return (data || []).map(mapDbShopToRegisteredShop);
}

export async function fetchShopById(id: string): Promise<RegisteredShop | null> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn(`Shop fetch returned no rows for id=${id}. This can happen when RLS blocks access.`);
      return null;
    }
    console.error('Error fetching shop by id:', error);
    return null;
  }
  return data ? mapDbShopToRegisteredShop(data) : null;
}

export async function addShop(shop: RegisteredShop): Promise<RegisteredShop | null> {
  const useV2 = await shouldUseV2Provisioning();

  if (useV2) {
    return addShopV2(shop);
  }

  return addShopLegacy(shop);
}

async function shouldUseV2Provisioning(): Promise<boolean> {
  try {
    const { isFeatureEnabled, FEATURE_FLAGS } = await import('./infrastructure/feature-flag-client');
    return await isFeatureEnabled(FEATURE_FLAGS.USE_V2_PROVISIONING);
  } catch {
    return false;
  }
}

async function addShopV2(shop: RegisteredShop): Promise<RegisteredShop | null> {
  try {
    const { provisionShop } = await import('./provisioning');
    const result = await provisionShop({
      shopName: shop.shopName,
      ownerName: shop.ownerName,
      ownerEmail: shop.email,
      phone: shop.phone,
      address: shop.address || `${shop.city ?? ''}, ${shop.state ?? ''}`,
      city: shop.city,
      state: shop.state,
      gst: shop.gstin,
      category: shop.category,
      plan: shop.plan,
      username: shop.username,
      temporaryPassword: shop.password,
    });

    return {
      ...shop,
      id: result.shopId,
      username: result.username ?? shop.username,
      password: result.temporaryPassword ?? shop.password,
      status: 'active',
    };
  } catch (err) {
    console.error('V2 provisioning failed:', err);
    return null;
  }
}

async function addShopLegacy(shop: RegisteredShop): Promise<RegisteredShop | null> {
  // Map RegisteredShop (camelCase) to Supabase schema (snake_case)
  const shopData = {
    id: shop.id,
    shop_name: shop.shopName,
    name: shop.shopName,
    owner_name: shop.ownerName,
    owner_phone: shop.phone,
    owner_email: shop.email,
    address: `${shop.city}, ${shop.state}`,
    gst_no: shop.gstin,
    city: shop.city,
    state: shop.state,
    category: shop.category,
    username: shop.username,
    password: shop.password,
    status: shop.status,
    plan: shop.plan,
    registered_on: shop.registeredOn,
  };

  const client = supabaseService || supabase;
  const { data, error } = await client
    .from('shops')
    .insert([shopData])
    .select();

  if (error) {
    console.error('Error adding shop:', error);
    return null;
  }

  if (supabaseService && shop.email && shop.password) {
    try {
      const { data: authData, error: authError } = await supabaseService.auth.admin.createUser({
        email: shop.email,
        password: shop.password,
        email_confirm: true,
      });

      if (authError) {
        console.warn('Could not create auth user for shop owner:', authError);
      } else {
        const userId = authData?.user?.id || authData?.id;
        if (userId) {
          const { error: profileError } = await supabaseService
            .from('user_profiles')
            .insert([{ id: userId, email: shop.email, full_name: shop.ownerName, role: 'shop_owner', shop_id: shop.id }]);

          if (profileError) {
            console.warn('Could not create shop owner profile:', profileError);
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error creating shop owner auth:', err);
    }
  }
  
  // Return the original RegisteredShop format
  return shop;
}

function mapShopUpdatesToDb(updates: Partial<RegisteredShop>) {
  const mapped: Record<string, unknown> = {};

  if (updates.shopName != null) {
    mapped.shop_name = updates.shopName;
    mapped.name = updates.shopName;
  }
  if (updates.ownerName != null) mapped.owner_name = updates.ownerName;
  if (updates.phone != null) mapped.owner_phone = updates.phone;
  if (updates.email != null) mapped.owner_email = updates.email;
  if (updates.address != null) mapped.address = updates.address;
  if (updates.gstin != null) mapped.gst_no = updates.gstin;
  if (updates.city != null) mapped.city = updates.city;
  if (updates.state != null) mapped.state = updates.state;
  if (updates.category != null) mapped.category = updates.category;
  if (updates.username != null) mapped.username = updates.username;
  if (updates.password != null) mapped.password = updates.password;
  if (updates.status != null) mapped.status = updates.status;
  if (updates.plan != null) mapped.plan = updates.plan;
  if (updates.registeredOn != null) mapped.registered_on = updates.registeredOn;

  return mapped;
}

function fromDbProduct(row: any): Product {
  return {
    id: row.id,
    shop_id: row.shop_id,
    name: row.name,
    nameHi: row.namehi ?? row.nameHi ?? '',
    category: row.category,
    price: Number(row.price),
    unit: row.unit,
    stock: Number(row.stock),
    emoji: row.emoji,
    lowStockThreshold: row.low_stock_threshold ?? row.lowStockThreshold ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toDbProduct(product: Omit<Product, 'id' | 'shop_id' | 'created_at' | 'updated_at'>) {
  return {
    name: product.name,
    namehi: product.nameHi,
    category: product.category,
    price: product.price,
    unit: product.unit,
    stock: product.stock,
    emoji: product.emoji,
    low_stock_threshold: product.lowStockThreshold,
  };
}

function mapProductUpdatesToDb(updates: Partial<Product>) {
  const mapped: Record<string, unknown> = { ...updates };
  if (updates.nameHi != null) {
    mapped.namehi = updates.nameHi;
    delete mapped.nameHi;
  }
  if (updates.lowStockThreshold != null) {
    mapped.low_stock_threshold = updates.lowStockThreshold;
    delete mapped.lowStockThreshold;
  }
  return mapped;
}

function fromDbBatch(row: any): Batch {
  return {
    id: row.id,
    product_id: row.product_id,
    shop_id: row.shop_id,
    batchNo: row.batch_no,
    mfgDate: row.mfg_date,
    expiryDate: row.expiry_date,
    quantity: Number(row.quantity),
    costPrice: Number(row.cost_price),
    addedDate: row.added_date,
    status: row.status,
    manualUnsellable: row.manual_unsellable,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toDbBatch(batch: Omit<Batch, 'id' | 'shop_id' | 'product_id' | 'created_at' | 'updated_at'>) {
  return {
    batch_no: batch.batchNo,
    mfg_date: batch.mfgDate,
    expiry_date: batch.expiryDate,
    quantity: batch.quantity,
    cost_price: batch.costPrice,
    added_date: batch.addedDate,
    status: batch.status,
    manual_unsellable: batch.manualUnsellable,
    notes: batch.notes,
  };
}

function mapBatchUpdatesToDb(updates: Partial<Batch>) {
  const mapped: Record<string, unknown> = { ...updates };
  if (updates.batchNo != null) {
    mapped.batch_no = updates.batchNo;
    delete mapped.batchNo;
  }
  if (updates.mfgDate != null) {
    mapped.mfg_date = updates.mfgDate;
    delete mapped.mfgDate;
  }
  if (updates.expiryDate != null) {
    mapped.expiry_date = updates.expiryDate;
    delete mapped.expiryDate;
  }
  if (updates.costPrice != null) {
    mapped.cost_price = updates.costPrice;
    delete mapped.costPrice;
  }
  if (updates.addedDate != null) {
    mapped.added_date = updates.addedDate;
    delete mapped.addedDate;
  }
  if (updates.manualUnsellable != null) {
    mapped.manual_unsellable = updates.manualUnsellable;
    delete mapped.manualUnsellable;
  }
  return mapped;
}

function fromDbOrder(row: any): Order {
  return {
    id: row.id,
    shop_id: row.shop_id,
    date: row.date,
    time: row.time,
    customerName: row.customer_name ?? row.customerName,
    items: typeof row.items_data === 'string' ? JSON.parse(row.items_data) : row.items_data || row.items || [],
    subtotal: row.subtotal,
    discountType: row.discount_type ?? row.discountType,
    discountValue: row.discount_value ?? row.discountValue,
    discountAmount: row.discount_amount ?? row.discountAmount,
    total: row.total,
    paymentMode: row.payment_mode ?? row.paymentMode,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toDbOrder(order: Omit<Order, 'shop_id' | 'created_at' | 'updated_at'>) {
  return {
    id: order.id,
    date: order.date,
    time: order.time,
    customer_name: order.customerName,
    items_data: order.items,
    subtotal: order.subtotal,
    discount_type: order.discountType,
    discount_value: order.discountValue,
    discount_amount: order.discountAmount,
    total: order.total,
    payment_mode: order.paymentMode,
    status: order.status,
  };
}

function mapOrderUpdatesToDb(updates: Partial<Order>) {
  const mapped: Record<string, unknown> = { ...updates };
  if (updates.customerName != null) {
    mapped.customer_name = updates.customerName;
    delete mapped.customerName;
  }
  if (updates.discountType != null) {
    mapped.discount_type = updates.discountType;
    delete mapped.discountType;
  }
  if (updates.discountValue != null) {
    mapped.discount_value = updates.discountValue;
    delete mapped.discountValue;
  }
  if (updates.discountAmount != null) {
    mapped.discount_amount = updates.discountAmount;
    delete mapped.discountAmount;
  }
  if (updates.paymentMode != null) {
    mapped.payment_mode = updates.paymentMode;
    delete mapped.paymentMode;
  }
  if (updates.items != null) {
    mapped.items_data = updates.items;
    delete mapped.items;
  }
  return mapped;
}

function fromDbRefund(row: any): Refund {
  return {
    id: row.id,
    shop_id: row.shop_id,
    orderId: row.order_id ?? row.orderId,
    date: row.date,
    time: row.time,
    customerName: row.customer_name ?? row.customerName,
    reason: row.reason,
    amount: row.amount,
    refundMode: row.refund_mode ?? row.refundMode,
    items: typeof row.items_data === 'string' ? JSON.parse(row.items_data) : row.items_data || row.items || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toDbRefund(refund: Omit<Refund, 'shop_id' | 'created_at' | 'updated_at'>) {
  return {
    id: refund.id,
    order_id: refund.orderId,
    date: refund.date,
    time: refund.time,
    customer_name: refund.customerName,
    reason: refund.reason,
    amount: refund.amount,
    refund_mode: refund.refundMode,
    items_data: refund.items,
  };
}

function mapRefundUpdatesToDb(updates: Partial<Refund>) {
  const mapped: Record<string, unknown> = { ...updates };
  if (updates.orderId != null) {
    mapped.order_id = updates.orderId;
    delete mapped.orderId;
  }
  if (updates.customerName != null) {
    mapped.customer_name = updates.customerName;
    delete mapped.customerName;
  }
  if (updates.refundMode != null) {
    mapped.refund_mode = updates.refundMode;
    delete mapped.refundMode;
  }
  if (updates.items != null) {
    mapped.items_data = updates.items;
    delete mapped.items;
  }
  return mapped;
}

function fromDbWastage(row: any): WastageEntry {
  return {
    id: row.id,
    shop_id: row.shop_id,
    date: row.date,
    time: row.time,
    productId: row.product_id,
    productName: row.product_name,
    productEmoji: row.product_emoji,
    category: row.category,
    batchNo: row.batch_no,
    batchId: row.batch_id,
    expiryDate: row.expiry_date,
    quantity: Number(row.quantity),
    costPrice: Number(row.cost_price),
    totalLoss: Number(row.total_loss),
    reason: row.reason,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toDbWastage(entry: Omit<WastageEntry, 'shop_id' | 'created_at' | 'updated_at' | 'id'>) {
  return {
    date: entry.date,
    time: entry.time,
    product_id: entry.productId,
    product_name: entry.productName,
    product_emoji: entry.productEmoji,
    category: entry.category,
    batch_no: entry.batchNo,
    batch_id: entry.batchId,
    expiry_date: entry.expiryDate,
    quantity: entry.quantity,
    cost_price: entry.costPrice,
    total_loss: entry.totalLoss,
    reason: entry.reason,
    notes: entry.notes,
  };
}

export async function updateShop(id: string, updates: Partial<RegisteredShop>): Promise<boolean> {
  const mappedUpdates = mapShopUpdatesToDb(updates);
  if (Object.keys(mappedUpdates).length === 0) {
    return true;
  }

  const { error } = await supabase
    .from('shops')
    .update(mappedUpdates)
    .eq('id', id);

  if (error) {
    console.error('Error updating shop:', error);
    return false;
  }
  return true;
}

// ─── Product Operations ────────────────────────────────────────────────────

export async function fetchProducts(shopId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('shop_id', shopId)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  return (data || []).map(fromDbProduct);
}

function formatProductInsertError(error: { code?: string; message?: string }): string {
  if (error.code === '42501') {
    return 'Permission denied: this account cannot add products to this shop.';
  }
  return error.message || 'Failed to add product.';
}

export async function addProduct(shopId: string, product: Omit<Product, 'id' | 'shop_id' | 'created_at'>): Promise<Product | null> {
  const dbProduct = toDbProduct({ ...product });
  const { data, error } = await supabase
    .from('products')
    .insert([{ ...dbProduct, shop_id: shopId }])
    .select();

  if (error) {
    console.error('Error adding product:', error);
    throw new Error(formatProductInsertError(error));
  }
  if (!data?.[0]) {
    throw new Error('Product was created but could not be read back. Please refresh inventory.');
  }
  return fromDbProduct(data[0]);
}

export async function updateProduct(id: number, shopId: string, updates: Partial<Product>): Promise<boolean> {
  const mappedUpdates = mapProductUpdatesToDb(updates);
  const { error } = await supabase
    .from('products')
    .update(mappedUpdates)
    .eq('id', id)
    .eq('shop_id', shopId);

  if (error) {
    console.error('Error updating product:', error);
    return false;
  }
  return true;
}

export async function deleteProduct(id: number, shopId: string): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('shop_id', shopId);

  if (error) {
    console.error('Error deleting product:', error);
    return false;
  }
  return true;
}

// ─── Batch Operations ──────────────────────────────────────────────────────

export async function fetchBatches(shopId: string): Promise<Batch[]> {
  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .eq('shop_id', shopId)
    .order('added_date', { ascending: false });

  if (error) {
    console.error('Error fetching batches:', error);
    return [];
  }
  return (data || []).map(fromDbBatch);
}

export async function addBatch(shopId: string, productId: number, batch: Omit<Batch, 'id' | 'shop_id' | 'product_id' | 'created_at'>): Promise<Batch | null> {
  const dbBatch = toDbBatch({ ...batch });
  const { data, error } = await supabase
    .from('batches')
    .insert([{ ...dbBatch, shop_id: shopId, product_id: productId }])
    .select();

  if (error) {
    console.error('Error adding batch:', error);
    return null;
  }
  return data?.[0] ? fromDbBatch(data[0]) : null;
}

export async function updateBatch(id: string, shopId: string, updates: Partial<Batch>): Promise<boolean> {
  const mappedUpdates = mapBatchUpdatesToDb(updates);
  const { error } = await supabase
    .from('batches')
    .update(mappedUpdates)
    .eq('id', id)
    .eq('shop_id', shopId);

  if (error) {
    console.error('Error updating batch:', error);
    return false;
  }
  return true;
}

export async function deleteBatch(id: string, shopId: string): Promise<boolean> {
  const { error } = await supabase
    .from('batches')
    .delete()
    .eq('id', id)
    .eq('shop_id', shopId);

  if (error) {
    console.error('Error deleting batch:', error);
    return false;
  }
  return true;
}

// ─── Order Operations ──────────────────────────────────────────────────────

export async function fetchOrders(shopId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
  return (data || []).map(fromDbOrder);
}

export async function addOrder(shopId: string, order: Omit<Order, 'shop_id' | 'created_at'>): Promise<Order | null> {
  const dbOrder = toDbOrder(order);
  const { data, error } = await supabase
    .from('orders')
    .insert([{ ...dbOrder, shop_id: shopId }])
    .select();

  if (error) {
    console.error('Error adding order:', error);
    return null;
  }
  return data?.[0] ? fromDbOrder(data[0]) : null;
}

export async function updateOrder(id: string, shopId: string, updates: Partial<Order>): Promise<boolean> {
  const mappedUpdates = mapOrderUpdatesToDb(updates);
  const { error } = await supabase
    .from('orders')
    .update(mappedUpdates)
    .eq('id', id)
    .eq('shop_id', shopId);

  if (error) {
    console.error('Error updating order:', error);
    return false;
  }
  return true;
}

// ─── Refund Operations ─────────────────────────────────────────────────────

export async function fetchRefunds(shopId: string): Promise<Refund[]> {
  const { data, error } = await supabase
    .from('refunds')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching refunds:', error);
    return [];
  }
  return (data || []).map(fromDbRefund);
}

export async function addRefund(shopId: string, refund: Omit<Refund, 'shop_id' | 'created_at'>): Promise<Refund | null> {
  const dbRefund = toDbRefund(refund);
  const { data, error } = await supabase
    .from('refunds')
    .insert([{ ...dbRefund, shop_id: shopId }])
    .select();

  if (error) {
    console.error('Error adding refund:', error);
    return null;
  }
  return data?.[0] ? fromDbRefund(data[0]) : null;
}

// ─── Wastage Operations ────────────────────────────────────────────────────

export async function fetchWastage(shopId: string): Promise<WastageEntry[]> {
  const { data, error } = await supabase
    .from('wastage_entries')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching wastage:', error);
    return [];
  }
  return (data || []).map(fromDbWastage);
}

export async function addWastage(shopId: string, entry: Omit<WastageEntry, 'shop_id' | 'created_at' | 'id'>): Promise<WastageEntry | null> {
  const dbEntry = toDbWastage(entry);
  const { data, error } = await supabase
    .from('wastage_entries')
    .insert([{ ...dbEntry, shop_id: shopId }])
    .select();

  if (error) {
    console.error('Error adding wastage entry:', error);
    return null;
  }
  return data?.[0] ? fromDbWastage(data[0]) : null;
}

// ─── Drawer Operations ─────────────────────────────────────────────────────

export async function fetchDrawerDay(shopId: string, date: string): Promise<DrawerDay | null> {
  const { data, error } = await supabase
    .from('drawer_days')
    .select('*')
    .eq('shop_id', shopId)
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching drawer day:', error);
    return null;
  }
  if (!data) return null;

  const transactions = await fetchDrawerTransactions(data.id);
  return fromDbDrawerDay(data, transactions);
}

export async function createDrawerDay(shopId: string, drawerDay: Omit<DrawerDay, 'id' | 'created_at' | 'transactions'>): Promise<DrawerDay | null> {
  const d = drawerDay as Record<string, unknown>;
  const { data, error } = await supabase
    .from('drawer_days')
    .insert([{
      shop_id: shopId,
      date: d.date,
      opening_balance: (d.openingBalance ?? d.opening_balance ?? 0) as number,
      closing_balance: (d.closingBalance ?? d.closing_balance ?? null) as number | null,
      transactions: [],
    }])
    .select();

  if (error) {
    console.error('Error creating drawer day:', error);
    return null;
  }
  return data?.[0] ? fromDbDrawerDay(data[0]) : null;
}

export async function updateDrawerDay(id: string, shopId: string, updates: Partial<DrawerDay>): Promise<boolean> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.openingBalance !== undefined) dbUpdates.opening_balance = updates.openingBalance;
  if (updates.closingBalance !== undefined) dbUpdates.closing_balance = updates.closingBalance;
  if (updates.date !== undefined) dbUpdates.date = updates.date;

  if (Object.keys(dbUpdates).length === 0) {
    return true;
  }

  const { error } = await supabase
    .from('drawer_days')
    .update(dbUpdates)
    .eq('id', id)
    .eq('shop_id', shopId);

  if (error) {
    console.error('Error updating drawer day:', error);
    return false;
  }
  return true;
}

export async function addDrawerTransaction(shopId: string, drawerDayId: string, tx: Omit<DrawerTx, 'id' | 'created_at'>): Promise<DrawerTx | null> {
  const dbTx = {
    ...tx,
    id: `DTX-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  } as any;
  const { data, error } = await supabase
    .from('drawer_transactions')
    .insert([{ ...dbTx, shop_id: shopId, drawer_day_id: drawerDayId }])
    .select();

  if (error) {
    console.error('Error adding drawer transaction:', error);
    return null;
  }
  return data?.[0] ? fromDbDrawerTx(data[0]) : null;
}

function fromDbDrawerTx(row: any): DrawerTx {
  return {
    id: row.id,
    shop_id: row.shop_id,
    date: row.date,
    time: row.time,
    type: row.type,
    description: row.description,
    amount: Number(row.amount),
    balance: Number(row.balance),
    created_at: row.created_at,
  };
}

function fromDbDrawerDay(row: any, transactions?: DrawerTx[]): DrawerDay {
  const legacyTx = Array.isArray(row.transactions)
    ? row.transactions.map(fromDbDrawerTx)
    : [];

  return {
    id: row.id,
    shop_id: row.shop_id,
    date: row.date,
    openingBalance: Number(row.opening_balance ?? row.openingBalance ?? 0),
    closingBalance: (row.closing_balance ?? row.closingBalance) ?? null,
    transactions: transactions ?? legacyTx,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchDrawerTransactions(drawerDayId: string): Promise<DrawerTx[]> {
  const { data, error } = await supabase
    .from('drawer_transactions')
    .select('*')
    .eq('drawer_day_id', drawerDayId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching drawer transactions:', error);
    return [];
  }
  return (data || []).map(fromDbDrawerTx);
}

// ─── Inventory Management ──────────────────────────────────────────────────

/**
 * Process order inventory - decrements batch quantities for each item sold.
 * Prioritizes selling from sellable batches first.
 */
export async function processOrderInventory(
  shopId: string,
  items: CartItem[],
  orderId: string
): Promise<{ success: boolean; deductedItems: Array<{ productId: number; quantity: number }> }> {
  const deductedItems: Array<{ productId: number; quantity: number }> = [];
  
  try {
    for (const item of items) {
      let remainingQty = item.qty;
      
      // Fetch all batches for this product
      const { data: batches, error } = await supabase
        .from('batches')
        .select('*')
        .eq('shop_id', shopId)
        .eq('product_id', item.id)
        .order('added_date', { ascending: true });

      if (error) {
        console.error(`Error fetching batches for product ${item.id}:`, error);
        continue;
      }

      // Prioritize selling from sellable batches
      for (const batch of batches || []) {
        if (remainingQty <= 0) break;
        
        // Skip unsellable/expired batches
        if (batch.status === 'unsellable' || batch.status === 'expired') continue;
        
        const qtyToDeduct = Math.min(remainingQty, batch.quantity);
        const newQuantity = batch.quantity - qtyToDeduct;
        
        // Update batch quantity
        const { error: updateError } = await supabase
          .from('batches')
          .update({ quantity: newQuantity })
          .eq('id', batch.id)
          .eq('shop_id', shopId);

        if (updateError) {
          console.error(`Error updating batch ${batch.id}:`, updateError);
          continue;
        }

        remainingQty -= qtyToDeduct;
      }

      if (remainingQty > 0) {
        console.warn(`⚠️ Insufficient inventory for product ${item.id}: needed ${item.qty}, could only deduct ${item.qty - remainingQty}`);
      }

      deductedItems.push({ productId: item.id, quantity: item.qty - remainingQty });
    }

    return { success: true, deductedItems };
  } catch (err) {
    console.error('Error processing order inventory:', err);
    return { success: false, deductedItems };
  }
}

/**
 * Process refund inventory - restores batch quantities for refunded items.
 * Restores to the most recent batch of each product.
 */
export async function processRefundInventory(
  shopId: string,
  items: CartItem[],
  refundId: string
): Promise<{ success: boolean; restoredItems: Array<{ productId: number; quantity: number }> }> {
  const restoredItems: Array<{ productId: number; quantity: number }> = [];
  
  try {
    for (const item of items) {
      // Fetch the most recent batch for this product
      const { data: batches, error } = await supabase
        .from('batches')
        .select('*')
        .eq('shop_id', shopId)
        .eq('product_id', item.id)
        .order('added_date', { ascending: false })
        .limit(1);

      if (error) {
        console.error(`Error fetching batch for product ${item.id}:`, error);
        continue;
      }

      const batch = batches?.[0];
      if (!batch) {
        console.warn(`No batch found for product ${item.id} during refund processing`);
        continue;
      }

      const newQuantity = batch.quantity + item.qty;

      const { error: updateError } = await supabase
        .from('batches')
        .update({ quantity: newQuantity })
        .eq('id', batch.id)
        .eq('shop_id', shopId);

      if (updateError) {
        console.error(`Error updating batch ${batch.id}:`, updateError);
        continue;
      }

      restoredItems.push({ productId: item.id, quantity: item.qty });
    }

    return { success: true, restoredItems };
  } catch (err) {
    console.error('Error processing refund inventory:', err);
    return { success: false, restoredItems };
  }
}

/**
 * Create order with automatic inventory deduction
 */
export async function createOrderWithInventory(
  shopId: string,
  order: Omit<Order, 'shop_id' | 'created_at'>,
  items: CartItem[]
): Promise<Order | null> {
  try {
    const dbOrder = toDbOrder(order);

    // Insert order first, then deduct inventory using created record id
    const { data, error } = await supabase
      .from('orders')
      .insert([{ ...dbOrder, shop_id: shopId }])
      .select();

    if (error) {
      console.error('Error creating order:', error);
      return null;
    }

    const createdOrder = data?.[0] ? fromDbOrder(data[0]) : null;
    if (!createdOrder) return null;

    const inventoryResult = await processOrderInventory(shopId, items, createdOrder.id);
    if (!inventoryResult.success) {
      console.warn('Order created but inventory deduction failed.', inventoryResult);
    }

    return createdOrder;
  } catch (err) {
    console.error('Error in createOrderWithInventory:', err);
    return null;
  }
}

/**
 * Create refund with automatic inventory restoration
 */
export async function createRefundWithInventory(
  shopId: string,
  refund: Omit<Refund, 'shop_id' | 'created_at'>,
  items: CartItem[]
): Promise<Refund | null> {
  try {
    const dbRefund = toDbRefund({ ...refund, items });

    const { data, error } = await supabase
      .from('refunds')
      .insert([{ ...dbRefund, shop_id: shopId }])
      .select();

    if (error) {
      console.error('Error creating refund:', error);
      return null;
    }

    const createdRefund = data?.[0] ? fromDbRefund(data[0]) : null;
    if (!createdRefund) return null;

    const inventoryResult = await processRefundInventory(shopId, items, createdRefund.id);
    if (!inventoryResult.success) {
      console.warn('Refund created but inventory restoration failed.', inventoryResult);
    }

    return createdRefund;
  } catch (err) {
    console.error('Error in createRefundWithInventory:', err);
    return null;
  }
}
