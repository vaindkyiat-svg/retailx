// Type conversion utilities for snake_case (DB) to camelCase (UI)

export function toUiOrder(dbOrder: any) {
  return {
    id: dbOrder.id,
    date: dbOrder.date,
    time: dbOrder.time,
    customerName: dbOrder.customer_name,
    items: dbOrder.items_data || [],
    subtotal: dbOrder.subtotal,
    discountType: dbOrder.discount_type,
    discountValue: dbOrder.discount_value,
    discountAmount: dbOrder.discount_amount,
    total: dbOrder.total,
    paymentMode: dbOrder.payment_mode,
    status: dbOrder.status,
  };
}

export function toDbOrder(uiOrder: any) {
  return {
    id: uiOrder.id,
    date: uiOrder.date,
    time: uiOrder.time,
    customer_name: uiOrder.customerName,
    items_data: uiOrder.items,
    subtotal: uiOrder.subtotal,
    discount_type: uiOrder.discountType,
    discount_value: uiOrder.discountValue,
    discount_amount: uiOrder.discountAmount,
    total: uiOrder.total,
    payment_mode: uiOrder.paymentMode,
    status: uiOrder.status,
  };
}

export function toUiRefund(dbRefund: any) {
  return {
    id: dbRefund.id,
    orderId: dbRefund.order_id,
    date: dbRefund.date,
    time: dbRefund.time,
    customerName: dbRefund.customer_name,
    reason: dbRefund.reason,
    amount: dbRefund.amount,
    refundMode: dbRefund.refund_mode,
    items: dbRefund.items_data || [],
  };
}

export function toDbRefund(uiRefund: any) {
  return {
    id: uiRefund.id,
    order_id: uiRefund.orderId,
    date: uiRefund.date,
    time: uiRefund.time,
    customer_name: uiRefund.customerName,
    reason: uiRefund.reason,
    amount: uiRefund.amount,
    refund_mode: uiRefund.refundMode,
    items_data: uiRefund.items,
  };
}

export function toUiProduct(dbProduct: any) {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    nameHi: dbProduct.nameHi,
    category: dbProduct.category,
    price: dbProduct.price,
    unit: dbProduct.unit,
    stock: dbProduct.stock,
    emoji: dbProduct.emoji,
    lowStockThreshold: dbProduct.low_stock_threshold,
  };
}

export function toDbProduct(uiProduct: any) {
  return {
    id: uiProduct.id,
    name: uiProduct.name,
    nameHi: uiProduct.nameHi,
    category: uiProduct.category,
    price: uiProduct.price,
    unit: uiProduct.unit,
    stock: uiProduct.stock,
    emoji: uiProduct.emoji,
    low_stock_threshold: uiProduct.lowStockThreshold,
  };
}

export function toUiBatch(dbBatch: any) {
  return {
    id: dbBatch.id,
    batchNo: dbBatch.batch_no,
    mfgDate: dbBatch.mfg_date,
    expiryDate: dbBatch.expiry_date,
    quantity: dbBatch.quantity,
    costPrice: dbBatch.cost_price,
    addedDate: dbBatch.added_date,
    status: dbBatch.status,
    manualUnsellable: dbBatch.manual_unsellable,
    notes: dbBatch.notes,
  };
}

export function toDbBatch(uiBatch: any) {
  return {
    id: uiBatch.id,
    batch_no: uiBatch.batchNo,
    mfg_date: uiBatch.mfgDate,
    expiry_date: uiBatch.expiryDate,
    quantity: uiBatch.quantity,
    cost_price: uiBatch.costPrice,
    added_date: uiBatch.addedDate,
    status: uiBatch.status,
    manual_unsellable: uiBatch.manualUnsellable,
    notes: uiBatch.notes,
  };
}

export function toUiDrawerTx(dbTx: any) {
  return {
    id: dbTx.id,
    date: dbTx.date,
    time: dbTx.time,
    type: dbTx.type,
    description: dbTx.description,
    amount: dbTx.amount,
    balance: dbTx.balance,
  };
}

export function toUiWastage(dbWastage: any) {
  return {
    id: dbWastage.id,
    date: dbWastage.date,
    time: dbWastage.time,
    productId: dbWastage.product_id,
    productName: dbWastage.product_name,
    productEmoji: dbWastage.product_emoji,
    category: dbWastage.category,
    batchNo: dbWastage.batch_no,
    batchId: dbWastage.batch_id,
    expiryDate: dbWastage.expiry_date,
    quantity: dbWastage.quantity,
    costPrice: dbWastage.cost_price,
    totalLoss: dbWastage.total_loss,
    reason: dbWastage.reason,
    notes: dbWastage.notes,
  };
}
