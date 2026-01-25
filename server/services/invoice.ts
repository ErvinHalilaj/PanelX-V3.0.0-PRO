/**
 * Invoice Management Service
 * 
 * Handles invoice creation, payments, and financial transactions.
 */

import { db } from "../db";
import { 
  invoices,
  invoiceItems,
  paymentTransactions,
  users,
  creditTransactions
} from "@shared/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";

export interface InvoiceData {
  userId: number;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number; // cents
    referenceType?: string;
    referenceId?: number;
  }>;
  tax?: number; // cents
  discount?: number; // cents
  dueDate?: Date;
  notes?: string;
}

/**
 * Generate unique invoice number
 */
function generateInvoiceNumber(): string {
  const prefix = "INV";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Create new invoice
 */
export async function createInvoice(data: InvoiceData): Promise<number> {
  try {
    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const tax = data.tax || 0;
    const discount = data.discount || 0;
    const total = subtotal + tax - discount;

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create invoice
    const inserted = await db
      .insert(invoices)
      .values({
        invoiceNumber,
        userId: data.userId,
        subtotal,
        tax,
        discount,
        total,
        status: "pending",
        dueDate: data.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
        notes: data.notes,
      })
      .returning();

    const invoiceId = inserted[0].id;

    // Create invoice items
    for (const item of data.items) {
      await db.insert(invoiceItems).values({
        invoiceId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.unitPrice * item.quantity,
        referenceType: item.referenceType,
        referenceId: item.referenceId,
      });
    }

    return invoiceId;
  } catch (error) {
    console.error("Failed to create invoice:", error);
    throw error;
  }
}

/**
 * Get invoice by ID with items
 */
export async function getInvoice(invoiceId: number): Promise<any> {
  try {
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (invoice.length === 0) {
      return null;
    }

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId));

    return {
      ...invoice[0],
      items,
    };
  } catch (error) {
    console.error("Failed to get invoice:", error);
    return null;
  }
}

/**
 * Get invoices for user
 */
export async function getUserInvoices(
  userId: number,
  status?: string
): Promise<any[]> {
  try {
    const conditions: any[] = [eq(invoices.userId, userId)];

    if (status) {
      conditions.push(eq(invoices.status, status));
    }

    return await db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt));
  } catch (error) {
    console.error("Failed to get user invoices:", error);
    return [];
  }
}

/**
 * Mark invoice as paid
 */
export async function markInvoicePaid(
  invoiceId: number,
  paymentData: {
    paymentMethod: string;
    paymentReference?: string;
    transactionId?: string;
  }
): Promise<void> {
  try {
    await db
      .update(invoices)
      .set({
        status: "paid",
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentReference || paymentData.transactionId,
        paidAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    // Add credits to user if invoice is for credits
    const invoice = await getInvoice(invoiceId);
    if (invoice) {
      for (const item of invoice.items) {
        if (item.referenceType === 'credit') {
          await db.insert(creditTransactions).values({
            userId: invoice.userId,
            amount: item.quantity, // quantity = credit amount
            reason: `Credit purchase - Invoice ${invoice.invoiceNumber}`,
            referenceId: invoiceId,
          });

          // Update user credits
          await db
            .update(users)
            .set({ credits: sql`${users.credits} + ${item.quantity}` })
            .where(eq(users.id, invoice.userId));
        }
      }
    }
  } catch (error) {
    console.error("Failed to mark invoice as paid:", error);
    throw error;
  }
}

/**
 * Cancel invoice
 */
export async function cancelInvoice(invoiceId: number): Promise<void> {
  try {
    await db
      .update(invoices)
      .set({ status: "cancelled" })
      .where(eq(invoices.id, invoiceId));
  } catch (error) {
    console.error("Failed to cancel invoice:", error);
    throw error;
  }
}

/**
 * Get invoice statistics
 */
export async function getInvoiceStatistics(
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  try {
    const conditions: any[] = [];

    if (startDate) {
      conditions.push(gte(invoices.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(invoices.createdAt, endDate));
    }

    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invoices,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_invoices,
        SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as total_revenue,
        AVG(CASE WHEN status = 'paid' THEN total ELSE NULL END) as average_invoice,
        SUM(CASE WHEN status = 'pending' THEN total ELSE 0 END) as pending_revenue
      FROM invoices
      ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
    `);

    return stats.rows[0] || {};
  } catch (error) {
    console.error("Failed to get invoice statistics:", error);
    return {};
  }
}

/**
 * Get overdue invoices
 */
export async function getOverdueInvoices(): Promise<any[]> {
  try {
    return await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.status, "pending"),
          sql`${invoices.dueDate} < NOW()`
        )
      )
      .orderBy(invoices.dueDate);
  } catch (error) {
    console.error("Failed to get overdue invoices:", error);
    return [];
  }
}

/**
 * Create invoice from package purchase
 */
export async function createPackageInvoice(
  userId: number,
  packageData: {
    packageName: string;
    credits: number;
    price: number; // cents
    packageId: number;
  }
): Promise<number> {
  return await createInvoice({
    userId,
    items: [
      {
        description: `${packageData.packageName} - ${packageData.credits} Credits`,
        quantity: 1,
        unitPrice: packageData.price,
        referenceType: 'package',
        referenceId: packageData.packageId,
      },
    ],
    notes: `Package purchase: ${packageData.packageName}`,
  });
}

/**
 * Create invoice for credit purchase
 */
export async function createCreditInvoice(
  userId: number,
  credits: number,
  pricePerCredit: number // cents
): Promise<number> {
  return await createInvoice({
    userId,
    items: [
      {
        description: `${credits} Credits`,
        quantity: credits,
        unitPrice: pricePerCredit,
        referenceType: 'credit',
      },
    ],
    notes: `Credit purchase: ${credits} credits`,
  });
}
