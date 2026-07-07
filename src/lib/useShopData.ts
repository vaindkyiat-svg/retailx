import { useEffect, useState, useCallback } from 'react';
import { getAuthUser } from './auth';
import {
  fetchProducts,
  fetchBatches,
  fetchOrders,
  fetchRefunds,
  fetchWastage,
  fetchDrawerDay,
  addProduct as dbAddProduct,
  updateProduct as dbUpdateProduct,
  deleteProduct as dbDeleteProduct,
  addBatch as dbAddBatch,
  updateBatch as dbUpdateBatch,
  deleteBatch as dbDeleteBatch,
  addOrder as dbAddOrder,
  updateOrder as dbUpdateOrder,
  addRefund as dbAddRefund,
  addWastage as dbAddWastage,
  createDrawerDay as dbCreateDrawerDay,
  updateDrawerDay as dbUpdateDrawerDay,
  addDrawerTransaction,
  createOrderWithInventory,
  createRefundWithInventory,
  type Product,
  type Batch,
  type Order,
  type Refund,
  type WastageEntry,
  type DrawerDay,
  type DrawerTx,
  type CartItem,
} from './database';

interface ShopDataState {
  products: Product[];
  batches: Batch[];
  orders: Order[];
  refunds: Refund[];
  wastageLog: WastageEntry[];
  drawerDay: DrawerDay | null;
  batchMap: Record<number, Batch[]>;
  isLoading: boolean;
  error: string | null;
}

async function resolveShopId(shopId: string | null): Promise<string | null> {
  if (shopId) return shopId;
  const user = await getAuthUser();
  return user?.shop_id ?? null;
}

export function useShopData(shopId: string | null) {
  const [state, setState] = useState<ShopDataState>({
    products: [],
    batches: [],
    orders: [],
    refunds: [],
    wastageLog: [],
    drawerDay: null,
    batchMap: {},
    isLoading: true,
    error: null,
  });

  // Fetch all shop data
  useEffect(() => {
    if (!shopId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const loadData = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        const [products, batches, orders, refunds, wastageLog] = await Promise.all([
          fetchProducts(shopId),
          fetchBatches(shopId),
          fetchOrders(shopId),
          fetchRefunds(shopId),
          fetchWastage(shopId),
        ]);

        // Build batchMap from fetched batches
        const batchMap: Record<number, Batch[]> = {};
        batches.forEach(batch => {
          if (!batchMap[batch.product_id]) {
            batchMap[batch.product_id] = [];
          }
          batchMap[batch.product_id].push(batch);
        });

        // Fetch today's drawer
        const todayISO = new Date().toISOString().split('T')[0];
        const drawerDay = await fetchDrawerDay(shopId, todayISO);

        setState(prev => ({
          ...prev,
          products,
          batches,
          orders,
          refunds,
          wastageLog,
          batchMap,
          drawerDay,
          isLoading: false,
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load shop data';
        setState(prev => ({ ...prev, error: errorMsg, isLoading: false }));
        console.error('Error loading shop data:', err);
      }
    };

    loadData();
  }, [shopId]);

  // Product operations
  const addProduct = useCallback(async (data: Omit<Product, 'id' | 'shop_id'>): Promise<boolean> => {
    const effectiveShopId = await resolveShopId(shopId);
    if (!effectiveShopId) {
      throw new Error('Shop ID is missing. Please sign out, sign in again, and retry.');
    }
    const newProduct = await dbAddProduct(effectiveShopId, data);
    setState(prev => ({
      ...prev,
      products: [...prev.products, newProduct],
    }));
    return true;
  }, [shopId]);

  const updateProduct = useCallback(async (id: number, data: Omit<Product, 'id' | 'shop_id'>) => {
    if (!shopId) return;
    try {
      const success = await dbUpdateProduct(id, shopId, { ...data, id, shop_id: shopId });
      if (success) {
        setState(prev => ({
          ...prev,
          products: prev.products.map(p => p.id === id ? { ...data, id, shop_id: shopId } : p),
        }));
      }
    } catch (err) {
      console.error('Error updating product:', err);
    }
  }, [shopId]);

  const deleteProduct = useCallback(async (id: number) => {
    if (!shopId) return;
    try {
      const success = await dbDeleteProduct(id, shopId);
      if (success) {
        setState(prev => ({
          ...prev,
          products: prev.products.filter(p => p.id !== id),
          batchMap: {
            ...prev.batchMap,
            [id]: undefined,
          },
        }));
      }
    } catch (err) {
      console.error('Error deleting product:', err);
    }
  }, [shopId]);

  // Batch operations
  const addBatch = useCallback(async (productId: number, batch: Omit<Batch, 'id' | 'shop_id' | 'product_id'>): Promise<boolean> => {
    if (!shopId) {
      console.error('Cannot add batch without shopId');
      return false;
    }
    try {
      const newBatch = await dbAddBatch(shopId, productId, batch);
      if (newBatch) {
        setState(prev => ({
          ...prev,
          batches: [...prev.batches, newBatch],
          batchMap: {
            ...prev.batchMap,
            [productId]: [...(prev.batchMap[productId] || []), newBatch],
          },
        }));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error adding batch:', err);
      return false;
    }
  }, [shopId]);

  const updateBatch = useCallback(async (productId: number, batchId: string, changes: Partial<Batch>) => {
    if (!shopId) return;
    try {
      const success = await dbUpdateBatch(batchId, shopId, changes);
      if (success) {
        setState(prev => ({
          ...prev,
          batches: prev.batches.map(b => b.id === batchId ? { ...b, ...changes } : b),
          batchMap: {
            ...prev.batchMap,
            [productId]: prev.batchMap[productId].map(b => 
              b.id === batchId ? { ...b, ...changes } : b
            ),
          },
        }));
      }
    } catch (err) {
      console.error('Error updating batch:', err);
    }
  }, [shopId]);

  const deleteBatch = useCallback(async (productId: number, batchId: string) => {
    if (!shopId) return;
    try {
      const success = await dbDeleteBatch(batchId, shopId);
      if (success) {
        setState(prev => ({
          ...prev,
          batches: prev.batches.filter(b => b.id !== batchId),
          batchMap: {
            ...prev.batchMap,
            [productId]: prev.batchMap[productId].filter(b => b.id !== batchId),
          },
        }));
      }
    } catch (err) {
      console.error('Error deleting batch:', err);
    }
  }, [shopId]);

  // Order operations
  const addOrder = useCallback(async (order: Omit<Order, 'shop_id'>, items?: CartItem[]) => {
    if (!shopId) return null;
    try {
      // Use inventory-aware order creation if items provided
      const newOrder = items && items.length > 0 
        ? await createOrderWithInventory(shopId, order, items)
        : await dbAddOrder(shopId, order);
      
      if (newOrder) {
        setState(prev => ({
          ...prev,
          orders: [newOrder, ...prev.orders],
        }));

        // Refresh batch state so inventory changes after checkout reflect immediately in UI
        const updatedBatches = await fetchBatches(shopId);
        const updatedBatchMap: Record<number, Batch[]> = {};
        updatedBatches.forEach(batch => {
          if (!updatedBatchMap[batch.product_id]) {
            updatedBatchMap[batch.product_id] = [];
          }
          updatedBatchMap[batch.product_id].push(batch);
        });

        setState(prev => ({
          ...prev,
          batches: updatedBatches,
          batchMap: updatedBatchMap,
        }));
      }

      return newOrder;
    } catch (err) {
      console.error('Error adding order:', err);
      return null;
    }
  }, [shopId]);

  const updateOrder = useCallback(async (id: string, updates: Partial<Order>) => {
    if (!shopId) return;
    try {
      const success = await dbUpdateOrder(id, shopId, updates);
      if (success) {
        setState(prev => ({
          ...prev,
          orders: prev.orders.map(o => o.id === id ? { ...o, ...updates } : o),
        }));
      }
    } catch (err) {
      console.error('Error updating order:', err);
    }
  }, [shopId]);

  // Refund operations
  const addRefund = useCallback(async (refund: Omit<Refund, 'shop_id'>, items?: CartItem[]): Promise<boolean> => {
    const effectiveShopId = await resolveShopId(shopId);
    if (!effectiveShopId) {
      console.error('Cannot add refund without shopId');
      return false;
    }
    try {
      const refundWithItems = items?.length ? { ...refund, items } : refund;
      const newRefund = items && items.length > 0
        ? await createRefundWithInventory(effectiveShopId, refundWithItems, items)
        : await dbAddRefund(effectiveShopId, refundWithItems as Omit<Refund, 'shop_id'>);

      if (!newRefund) return false;

      const batches = items?.length ? await fetchBatches(effectiveShopId) : null;
      setState(prev => {
        const next: Partial<ShopDataState> = {
          refunds: [newRefund, ...prev.refunds],
        };
        if (batches) {
          const batchMap: Record<number, Batch[]> = {};
          batches.forEach(batch => {
            if (!batchMap[batch.product_id]) batchMap[batch.product_id] = [];
            batchMap[batch.product_id].push(batch);
          });
          next.batches = batches;
          next.batchMap = batchMap;
        }
        return { ...prev, ...next };
      });
      return true;
    } catch (err) {
      console.error('Error adding refund:', err);
      return false;
    }
  }, [shopId]);

  // Wastage: insert log entry first, then adjust batch quantity
  const recordWastage = useCallback(async (
    productId: number,
    batch: Batch,
    entry: Omit<WastageEntry, 'id' | 'shop_id'>,
  ): Promise<boolean> => {
    if (!shopId) return false;
    try {
      const newEntry = await dbAddWastage(shopId, entry);
      if (!newEntry) return false;

      setState(prev => ({
        ...prev,
        wastageLog: [newEntry, ...prev.wastageLog],
      }));

      const remaining = batch.quantity - entry.quantity;
      if (remaining <= 0) {
        const ok = await dbDeleteBatch(batch.id, shopId);
        if (ok) {
          setState(prev => ({
            ...prev,
            batches: prev.batches.filter(b => b.id !== batch.id),
            batchMap: {
              ...prev.batchMap,
              [productId]: (prev.batchMap[productId] ?? []).filter(b => b.id !== batch.id),
            },
          }));
        }
        return ok;
      }

      const ok = await dbUpdateBatch(batch.id, shopId, { quantity: remaining });
      if (ok) {
        setState(prev => ({
          ...prev,
          batches: prev.batches.map(b => b.id === batch.id ? { ...b, quantity: remaining } : b),
          batchMap: {
            ...prev.batchMap,
            [productId]: (prev.batchMap[productId] ?? []).map(b =>
              b.id === batch.id ? { ...b, quantity: remaining } : b
            ),
          },
        }));
      }
      return ok;
    } catch (err) {
      console.error('Error recording wastage:', err);
      return false;
    }
  }, [shopId]);

  // Drawer operations
  const openDrawer = useCallback(async (opening: number) => {
    if (!shopId) return;
    try {
      const todayISO = new Date().toISOString().split('T')[0];
      const nowTime = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
      
      const drawerDay = await dbCreateDrawerDay(shopId, {
        date: todayISO,
        openingBalance: opening,
        closingBalance: null,
      });

      if (drawerDay) {
        const initTx = {
          date: todayISO,
          time: nowTime(),
          type: 'opening' as const,
          description: 'Opening balance',
          amount: opening,
          balance: opening,
        };

        const createdTx = await addDrawerTransaction(shopId, drawerDay.id, initTx);

        setState(prev => ({
          ...prev,
          drawerDay: {
            ...drawerDay,
            transactions: createdTx ? [createdTx] : [],
          },
        }));
      }
    } catch (err) {
      console.error('Error opening drawer:', err);
    }
  }, [shopId]);

  const closeDrawer = useCallback(async () => {
    if (!shopId || !state.drawerDay) return;
    try {
      const closingBalance = state.drawerDay.transactions.reduce((s, t) => s + t.amount, 0);
      const success = await dbUpdateDrawerDay(state.drawerDay.id, shopId, {
        closingBalance,
      });

      if (success) {
        setState(prev => prev.drawerDay ? {
          ...prev,
          drawerDay: {
            ...prev.drawerDay,
            closingBalance,
          },
        } : prev);
      }
    } catch (err) {
      console.error('Error closing drawer:', err);
    }
  }, [shopId, state.drawerDay]);

  const addDrawerTx = useCallback(async (tx: { date: string; time: string; type: DrawerTx['type']; description: string; amount: number }) => {
    if (!shopId) return false;
    try {
      let drawerDay = state.drawerDay;
      if (!drawerDay) {
        drawerDay = await dbCreateDrawerDay(shopId, {
          date: tx.date,
          openingBalance: 0,
          closingBalance: null,
        });

        if (!drawerDay) {
          console.error('Error adding drawer transaction: could not create drawer day');
          return false;
        }

        setState(prev => ({
          ...prev,
          drawerDay: {
            ...drawerDay,
            transactions: [],
          },
        }));
      }

      const runningBal = (drawerDay.transactions || []).reduce((s, t) => s + t.amount, 0) + tx.amount;
      const newTx = {
        ...tx,
        balance: runningBal,
      } as Omit<DrawerTx, 'id'>;

      const createdTx = await addDrawerTransaction(shopId, drawerDay.id, newTx);
      if (!createdTx) {
        console.error('Error adding drawer transaction: insert returned null');
        return false;
      }

      setState(prev => {
        const currentDay = prev.drawerDay ?? drawerDay;
        return {
          ...prev,
          drawerDay: {
            ...currentDay,
            transactions: [...(currentDay.transactions || []), createdTx],
          },
        };
      });

      return true;
    } catch (err) {
      console.error('Error adding drawer transaction:', err);
      return false;
    }
  }, [shopId, state.drawerDay]);

  return {
    ...state,
    addProduct,
    updateProduct,
    deleteProduct,
    addBatch,
    updateBatch,
    deleteBatch,
    addOrder,
    updateOrder,
    addRefund,
    recordWastage,
    openDrawer,
    closeDrawer,
    addDrawerTx,
  };
}
