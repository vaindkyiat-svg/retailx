import { useEffect, useState, useCallback } from 'react';
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
  const addProduct = useCallback(async (data: Omit<Product, 'id' | 'shop_id'>) => {
    if (!shopId) return;
    try {
      const newProduct = await dbAddProduct(shopId, data);
      if (newProduct) {
        setState(prev => ({
          ...prev,
          products: [...prev.products, newProduct],
        }));
      }
    } catch (err) {
      console.error('Error adding product:', err);
    }
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
  const addBatch = useCallback(async (productId: number, batch: Omit<Batch, 'id' | 'shop_id' | 'product_id'>) => {
    if (!shopId) return;
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
      }
    } catch (err) {
      console.error('Error adding batch:', err);
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
  const addRefund = useCallback(async (refund: Omit<Refund, 'shop_id'>, items?: CartItem[]) => {
    if (!shopId) return;
    try {
      // Use inventory-aware refund creation if items provided
      const newRefund = items && items.length > 0 
        ? await createRefundWithInventory(shopId, refund, items)
        : await dbAddRefund(shopId, refund);
      
      if (newRefund) {
        setState(prev => ({
          ...prev,
          refunds: [newRefund, ...prev.refunds],
        }));
      }
    } catch (err) {
      console.error('Error adding refund:', err);
    }
  }, [shopId]);

  // Wastage operations
  const addWastage = useCallback(async (entry: Omit<WastageEntry, 'shop_id'>) => {
    if (!shopId) return;
    try {
      const newEntry = await dbAddWastage(shopId, entry);
      if (newEntry) {
        setState(prev => ({
          ...prev,
          wastageLog: [newEntry, ...prev.wastageLog],
        }));
      }
    } catch (err) {
      console.error('Error adding wastage:', err);
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
        opening_balance: opening,
        closing_balance: null,
        transactions: [],
      });

      if (drawerDay) {
        // Add opening transaction
        const initTx = {
          date: todayISO,
          time: nowTime(),
          type: 'opening' as const,
          description: 'Opening balance',
          amount: opening,
          balance: opening,
        };

        await addDrawerTransaction(shopId, drawerDay.id, initTx);

        setState(prev => ({
          ...prev,
          drawerDay: {
            ...drawerDay,
            transactions: [{ ...initTx, id: `DTX-${Date.now()}` }],
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
      const success = await dbUpdateDrawerDay(state.drawerDay.id, shopId, {
        closing_balance: state.drawerDay.transactions.reduce((s, t) => s + t.amount, 0),
      });

      if (success) {
        setState(prev => prev.drawerDay ? {
          ...prev,
          drawerDay: {
            ...prev.drawerDay,
            closing_balance: prev.drawerDay.transactions.reduce((s, t) => s + t.amount, 0),
          },
        } : prev);
      }
    } catch (err) {
      console.error('Error closing drawer:', err);
    }
  }, [shopId, state.drawerDay]);

  const addDrawerTx = useCallback(async (tx: Omit<DrawerTx, 'id'>) => {
    if (!shopId) return false;
    try {
      let drawerDay = state.drawerDay;
      if (!drawerDay) {
        drawerDay = await dbCreateDrawerDay(shopId, {
          date: tx.date,
          opening_balance: 0,
          closing_balance: null,
          transactions: [],
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
      };

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
    addWastage,
    openDrawer,
    closeDrawer,
    addDrawerTx,
  };
}
