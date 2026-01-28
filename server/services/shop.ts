import { db } from "../db";
import { shopProducts, shopOrders, shopPaymentMethods, shopSettings, lines, bouquets } from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import crypto from "crypto";

function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

function generateUsername(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getProducts(enabledOnly = true) {
  if (enabledOnly) {
    return await db.select().from(shopProducts)
      .where(eq(shopProducts.enabled, true))
      .orderBy(shopProducts.displayOrder);
  }
  return await db.select().from(shopProducts).orderBy(shopProducts.displayOrder);
}

export async function getProduct(id: number) {
  const [product] = await db.select().from(shopProducts).where(eq(shopProducts.id, id));
  return product;
}

export async function createProduct(data: typeof shopProducts.$inferInsert) {
  const [product] = await db.insert(shopProducts).values(data).returning();
  return product;
}

export async function updateProduct(id: number, data: Partial<typeof shopProducts.$inferInsert>) {
  const [product] = await db.update(shopProducts)
    .set(data)
    .where(eq(shopProducts.id, id))
    .returning();
  return product;
}

export async function deleteProduct(id: number) {
  await db.delete(shopProducts).where(eq(shopProducts.id, id));
}

export async function getPaymentMethods(enabledOnly = true) {
  if (enabledOnly) {
    return await db.select().from(shopPaymentMethods)
      .where(eq(shopPaymentMethods.enabled, true))
      .orderBy(shopPaymentMethods.displayOrder);
  }
  return await db.select().from(shopPaymentMethods).orderBy(shopPaymentMethods.displayOrder);
}

export async function getPaymentMethod(id: number) {
  const [method] = await db.select().from(shopPaymentMethods).where(eq(shopPaymentMethods.id, id));
  return method;
}

export async function createPaymentMethod(data: typeof shopPaymentMethods.$inferInsert) {
  const [method] = await db.insert(shopPaymentMethods).values(data).returning();
  return method;
}

export async function updatePaymentMethod(id: number, data: Partial<typeof shopPaymentMethods.$inferInsert>) {
  const [method] = await db.update(shopPaymentMethods)
    .set(data)
    .where(eq(shopPaymentMethods.id, id))
    .returning();
  return method;
}

export async function deletePaymentMethod(id: number) {
  await db.delete(shopPaymentMethods).where(eq(shopPaymentMethods.id, id));
}

export async function getOrders(filters?: { status?: string; limit?: number; offset?: number }) {
  let query = db.select().from(shopOrders).orderBy(desc(shopOrders.createdAt));
  
  if (filters?.status) {
    query = query.where(eq(shopOrders.paymentStatus, filters.status)) as any;
  }
  
  if (filters?.limit) {
    query = query.limit(filters.limit) as any;
  }
  
  if (filters?.offset) {
    query = query.offset(filters.offset) as any;
  }
  
  return await query;
}

export async function getOrder(id: number) {
  const [order] = await db.select().from(shopOrders).where(eq(shopOrders.id, id));
  return order;
}

export async function getOrderByNumber(orderNumber: string) {
  const [order] = await db.select().from(shopOrders).where(eq(shopOrders.orderNumber, orderNumber));
  return order;
}

export async function createOrder(data: {
  productId: number;
  guestEmail?: string;
  guestName?: string;
  customerId?: number;
  paymentMethodId?: number;
  customerNotes?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const product = await getProduct(data.productId);
  if (!product) throw new Error('Product not found');
  if (!product.enabled) throw new Error('Product not available');
  
  if (product.stockLimit !== null && (product.soldCount || 0) >= product.stockLimit) {
    throw new Error('Product out of stock');
  }
  
  const discount = product.price * ((product.discountPercent || 0) / 100);
  const totalPrice = product.price - discount;
  
  const [order] = await db.insert(shopOrders).values({
    orderNumber: generateOrderNumber(),
    productId: data.productId,
    productName: product.name,
    customerId: data.customerId,
    guestEmail: data.guestEmail,
    guestName: data.guestName,
    unitPrice: product.price,
    discount,
    totalPrice,
    currency: product.currency,
    paymentMethodId: data.paymentMethodId,
    customerNotes: data.customerNotes,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  }).returning();
  
  return order;
}

export async function updateOrderPayment(orderId: number, transactionId: string, status: 'paid' | 'failed') {
  const [order] = await db.update(shopOrders)
    .set({
      paymentStatus: status,
      paymentTransactionId: transactionId,
      paidAt: status === 'paid' ? new Date() : undefined,
      updatedAt: new Date(),
    })
    .where(eq(shopOrders.id, orderId))
    .returning();
  
  if (status === 'paid' && order) {
    await fulfillOrder(orderId);
  }
  
  return order;
}

export async function fulfillOrder(orderId: number) {
  const order = await getOrder(orderId);
  if (!order) throw new Error('Order not found');
  if (order.fulfilled) throw new Error('Order already fulfilled');
  
  const product = await getProduct(order.productId);
  if (!product) throw new Error('Product not found');
  
  let generatedLineId: number | undefined;
  let generatedUsername: string | undefined;
  let generatedPassword: string | undefined;
  
  if (product.productType === 'subscription') {
    generatedUsername = generateUsername();
    generatedPassword = generatePassword();
    
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + (product.durationDays || 30));
    
    const [newLine] = await db.insert(lines).values({
      username: generatedUsername,
      password: generatedPassword,
      memberId: 1,
      expDate,
      maxConnections: product.maxConnections || 1,
      bouquets: (product.bouquetIds as number[]) || [],
      enabled: true,
      adminEnabled: true,
    }).returning();
    
    generatedLineId = newLine.id;
    
    await db.update(shopProducts)
      .set({ soldCount: (product.soldCount || 0) + 1 })
      .where(eq(shopProducts.id, product.id));
  }
  
  const [updated] = await db.update(shopOrders)
    .set({
      fulfilled: true,
      fulfilledAt: new Date(),
      generatedLineId,
      generatedUsername,
      generatedPassword,
      updatedAt: new Date(),
    })
    .where(eq(shopOrders.id, orderId))
    .returning();
  
  return updated;
}

export async function getShopStats() {
  const orders = await db.select().from(shopOrders);
  
  const totalOrders = orders.length;
  const paidOrders = orders.filter(o => o.paymentStatus === 'paid');
  const pendingOrders = orders.filter(o => o.paymentStatus === 'pending');
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalPrice, 0);
  const fulfilledOrders = orders.filter(o => o.fulfilled);
  
  return {
    totalOrders,
    paidOrders: paidOrders.length,
    pendingOrders: pendingOrders.length,
    fulfilledOrders: fulfilledOrders.length,
    totalRevenue,
    averageOrderValue: paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0,
  };
}

export async function getSetting(key: string): Promise<string | null> {
  const [setting] = await db.select().from(shopSettings).where(eq(shopSettings.settingKey, key));
  return setting?.settingValue || null;
}

export async function setSetting(key: string, value: string, type = 'string', description?: string) {
  await db.insert(shopSettings).values({
    settingKey: key,
    settingValue: value,
    settingType: type,
    description,
  }).onConflictDoUpdate({
    target: shopSettings.settingKey,
    set: { settingValue: value, updatedAt: new Date() }
  });
}

export async function getAllSettings() {
  return await db.select().from(shopSettings);
}

export async function cancelOrder(orderId: number, reason?: string) {
  const [order] = await db.update(shopOrders)
    .set({
      paymentStatus: 'cancelled',
      adminNotes: reason,
      updatedAt: new Date(),
    })
    .where(eq(shopOrders.id, orderId))
    .returning();
  return order;
}

export async function refundOrder(orderId: number, reason?: string) {
  const order = await getOrder(orderId);
  if (!order) throw new Error('Order not found');
  
  if (order.generatedLineId) {
    await db.update(lines)
      .set({ enabled: false, adminEnabled: false })
      .where(eq(lines.id, order.generatedLineId));
  }
  
  const [updated] = await db.update(shopOrders)
    .set({
      paymentStatus: 'refunded',
      adminNotes: reason || order.adminNotes,
      updatedAt: new Date(),
    })
    .where(eq(shopOrders.id, orderId))
    .returning();
  
  return updated;
}
