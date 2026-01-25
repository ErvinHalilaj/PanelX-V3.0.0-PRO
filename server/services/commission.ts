/**
 * Commission Management Service
 * 
 * Handles reseller commissions, calculations, and payments.
 */

import { db } from "../db";
import { 
  commissionRules,
  commissionPayments,
  invoices,
  users,
  creditTransactions
} from "@shared/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";

export interface CommissionRuleData {
  name: string;
  description?: string;
  resellerId?: number;
  packageId?: number;
  type: 'percentage' | 'fixed' | 'tiered';
  value: number;
  tiers?: Array<{ min: number; max: number; value: number }>;
  validFrom?: Date;
  validUntil?: Date;
}

/**
 * Create commission rule
 */
export async function createCommissionRule(data: CommissionRuleData): Promise<number> {
  try {
    const inserted = await db
      .insert(commissionRules)
      .values({
        name: data.name,
        description: data.description,
        resellerId: data.resellerId,
        packageId: data.packageId,
        type: data.type,
        value: data.value,
        tiers: data.tiers || [],
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        enabled: true,
      })
      .returning();

    return inserted[0].id;
  } catch (error) {
    console.error("Failed to create commission rule:", error);
    throw error;
  }
}

/**
 * Calculate commission amount
 */
export function calculateCommission(
  saleAmount: number,
  rule: any
): number {
  switch (rule.type) {
    case 'percentage':
      return Math.round(saleAmount * (rule.value / 100));
      
    case 'fixed':
      return rule.value;
      
    case 'tiered':
      // Find applicable tier
      if (rule.tiers && rule.tiers.length > 0) {
        for (const tier of rule.tiers) {
          if (saleAmount >= tier.min && saleAmount <= tier.max) {
            return Math.round(saleAmount * (tier.value / 100));
          }
        }
      }
      // Fallback to base value
      return Math.round(saleAmount * (rule.value / 100));
      
    default:
      return 0;
  }
}

/**
 * Get applicable commission rule
 */
export async function getApplicableCommissionRule(
  resellerId: number,
  packageId?: number
): Promise<any> {
  try {
    const now = new Date();
    
    // First, try to find specific rule for reseller and package
    if (packageId) {
      const specificRules = await db
        .select()
        .from(commissionRules)
        .where(
          and(
            eq(commissionRules.resellerId, resellerId),
            eq(commissionRules.packageId, packageId),
            eq(commissionRules.enabled, true),
            sql`(${commissionRules.validFrom} IS NULL OR ${commissionRules.validFrom} <= ${now})`,
            sql`(${commissionRules.validUntil} IS NULL OR ${commissionRules.validUntil} >= ${now})`
          )
        )
        .limit(1);

      if (specificRules.length > 0) {
        return specificRules[0];
      }
    }

    // Try reseller-specific rule
    const resellerRules = await db
      .select()
      .from(commissionRules)
      .where(
        and(
          eq(commissionRules.resellerId, resellerId),
          sql`${commissionRules.packageId} IS NULL`,
          eq(commissionRules.enabled, true),
          sql`(${commissionRules.validFrom} IS NULL OR ${commissionRules.validFrom} <= ${now})`,
          sql`(${commissionRules.validUntil} IS NULL OR ${commissionRules.validUntil} >= ${now})`
        )
      )
      .limit(1);

    if (resellerRules.length > 0) {
      return resellerRules[0];
    }

    // Try global rule
    const globalRules = await db
      .select()
      .from(commissionRules)
      .where(
        and(
          sql`${commissionRules.resellerId} IS NULL`,
          sql`${commissionRules.packageId} IS NULL`,
          eq(commissionRules.enabled, true),
          sql`(${commissionRules.validFrom} IS NULL OR ${commissionRules.validFrom} <= ${now})`,
          sql`(${commissionRules.validUntil} IS NULL OR ${commissionRules.validUntil} >= ${now})`
        )
      )
      .limit(1);

    return globalRules.length > 0 ? globalRules[0] : null;
  } catch (error) {
    console.error("Failed to get applicable commission rule:", error);
    return null;
  }
}

/**
 * Calculate reseller commissions for period
 */
export async function calculateResellerCommissions(
  resellerId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<{ totalSales: number; commissionAmount: number; transactions: any[] }> {
  try {
    // Get all paid invoices from reseller's customers in the period
    const query = `
      SELECT 
        i.id,
        i.total,
        i.paid_at,
        i.user_id
      FROM invoices i
      INNER JOIN users u ON i.user_id = u.id
      WHERE u.created_by = $1
        AND i.status = 'paid'
        AND i.paid_at >= $2
        AND i.paid_at <= $3
      ORDER BY i.paid_at DESC
    `;

    const result = await db.execute(sql.raw(query, [resellerId, periodStart, periodEnd]));
    const transactions = result.rows as any[];

    let totalSales = 0;
    let totalCommission = 0;

    for (const transaction of transactions) {
      totalSales += transaction.total;

      // Get applicable commission rule
      const rule = await getApplicableCommissionRule(resellerId);
      
      if (rule) {
        const commission = calculateCommission(transaction.total, rule);
        totalCommission += commission;
        transaction.commission = commission;
        transaction.commissionRule = rule.name;
      } else {
        transaction.commission = 0;
        transaction.commissionRule = 'None';
      }
    }

    return {
      totalSales,
      commissionAmount: totalCommission,
      transactions,
    };
  } catch (error) {
    console.error("Failed to calculate reseller commissions:", error);
    return { totalSales: 0, commissionAmount: 0, transactions: [] };
  }
}

/**
 * Create commission payment
 */
export async function createCommissionPayment(
  resellerId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  try {
    // Calculate commissions
    const { totalSales, commissionAmount } = await calculateResellerCommissions(
      resellerId,
      periodStart,
      periodEnd
    );

    if (commissionAmount === 0) {
      throw new Error("No commissions to pay for this period");
    }

    // Create payment record
    const inserted = await db
      .insert(commissionPayments)
      .values({
        resellerId,
        periodStart,
        periodEnd,
        totalSales,
        commissionAmount,
        status: 'pending',
      })
      .returning();

    return inserted[0].id;
  } catch (error) {
    console.error("Failed to create commission payment:", error);
    throw error;
  }
}

/**
 * Mark commission payment as paid
 */
export async function markCommissionPaid(
  paymentId: number,
  paymentData: {
    paymentMethod: string;
    paymentReference: string;
    notes?: string;
  }
): Promise<void> {
  try {
    // Get payment details
    const payments = await db
      .select()
      .from(commissionPayments)
      .where(eq(commissionPayments.id, paymentId))
      .limit(1);

    if (payments.length === 0) {
      throw new Error("Commission payment not found");
    }

    const payment = payments[0];

    // Update payment status
    await db
      .update(commissionPayments)
      .set({
        status: 'paid',
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentReference,
        notes: paymentData.notes,
        paidAt: new Date(),
      })
      .where(eq(commissionPayments.id, paymentId));

    // Add credits to reseller
    await db.insert(creditTransactions).values({
      userId: payment.resellerId,
      amount: Math.floor(payment.commissionAmount / 100), // Convert cents to credits (1 credit = 100 cents)
      reason: `Commission payment for period ${payment.periodStart.toISOString().split('T')[0]} to ${payment.periodEnd.toISOString().split('T')[0]}`,
      referenceId: paymentId,
    });

    await db
      .update(users)
      .set({ 
        credits: sql`${users.credits} + ${Math.floor(payment.commissionAmount / 100)}` 
      })
      .where(eq(users.id, payment.resellerId));

  } catch (error) {
    console.error("Failed to mark commission as paid:", error);
    throw error;
  }
}

/**
 * Get commission payments for reseller
 */
export async function getResellerCommissionPayments(
  resellerId: number,
  status?: string
): Promise<any[]> {
  try {
    const conditions: any[] = [eq(commissionPayments.resellerId, resellerId)];

    if (status) {
      conditions.push(eq(commissionPayments.status, status));
    }

    return await db
      .select()
      .from(commissionPayments)
      .where(and(...conditions))
      .orderBy(desc(commissionPayments.createdAt));
  } catch (error) {
    console.error("Failed to get commission payments:", error);
    return [];
  }
}

/**
 * Get commission statistics
 */
export async function getCommissionStatistics(
  resellerId?: number,
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  try {
    const conditions: any[] = [];

    if (resellerId) {
      conditions.push(sql`reseller_id = ${resellerId}`);
    }
    if (startDate) {
      conditions.push(sql`created_at >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`created_at <= ${endDate}`);
    }

    const whereClause = conditions.length > 0 
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_payments,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
        SUM(total_sales) as total_sales,
        SUM(commission_amount) as total_commissions,
        SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as paid_commissions,
        SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END) as pending_commissions,
        AVG(commission_amount) as average_commission
      FROM commission_payments
      ${whereClause}
    `);

    return stats.rows[0] || {};
  } catch (error) {
    console.error("Failed to get commission statistics:", error);
    return {};
  }
}
