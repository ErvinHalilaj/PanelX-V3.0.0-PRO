/**
 * Machine Learning Analytics Service
 * 
 * Predictive analytics including churn prediction, user segmentation,
 * and behavioral analysis.
 */

import { db } from "../db";
import { 
  churnPredictions,
  userSegments,
  userSegmentMembership,
  analyticsEvents,
  watchHistory,
  users,
  creditTransactions
} from "@shared/schema";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";

/**
 * Calculate churn risk for user
 */
export async function calculateChurnRisk(userId: number): Promise<{
  churnProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors: Array<{ factor: string; impact: number; description: string }>;
}> {
  try {
    const factors: Array<{ factor: string; impact: number; description: string }> = [];
    let churnScore = 0;

    // Factor 1: Recent activity (40% weight)
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActivity = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.userId, userId),
          gte(watchHistory.startedAt, last7Days)
        )
      );

    const activityCount = Number(recentActivity[0]?.count || 0);
    if (activityCount === 0) {
      churnScore += 40;
      factors.push({ 
        factor: 'no_recent_activity', 
        impact: 40,
        description: 'No activity in the last 7 days'
      });
    } else if (activityCount < 3) {
      churnScore += 20;
      factors.push({ 
        factor: 'low_activity', 
        impact: 20,
        description: 'Low activity in the last 7 days'
      });
    }

    // Factor 2: Watch completion rate (25% weight)
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const completionRate = await db.execute(sql`
      SELECT AVG(watch_percentage) as avg_completion
      FROM watch_history
      WHERE user_id = ${userId}
        AND started_at >= ${last30Days}
    `);

    const avgCompletion = Number(completionRate.rows[0]?.avg_completion || 0);
    if (avgCompletion < 30) {
      churnScore += 25;
      factors.push({ 
        factor: 'low_completion_rate', 
        impact: 25,
        description: `Average completion rate: ${avgCompletion.toFixed(0)}%`
      });
    } else if (avgCompletion < 60) {
      churnScore += 10;
      factors.push({ 
        factor: 'moderate_completion_rate', 
        impact: 10,
        description: `Average completion rate: ${avgCompletion.toFixed(0)}%`
      });
    }

    // Factor 3: Credit balance (20% weight)
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const credits = user[0]?.credits || 0;
    if (credits <= 0) {
      churnScore += 20;
      factors.push({ 
        factor: 'no_credits', 
        impact: 20,
        description: 'User has no credits remaining'
      });
    } else if (credits < 10) {
      churnScore += 10;
      factors.push({ 
        factor: 'low_credits', 
        impact: 10,
        description: `Only ${credits} credits remaining`
      });
    }

    // Factor 4: Account age (15% weight)
    const accountAge = Date.now() - (user[0]?.createdAt?.getTime() || Date.now());
    const ageDays = accountAge / (24 * 60 * 60 * 1000);
    
    if (ageDays < 7) {
      churnScore += 15;
      factors.push({ 
        factor: 'new_user', 
        impact: 15,
        description: 'New user (less than 7 days old)'
      });
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (churnScore >= 60) {
      riskLevel = 'high';
    } else if (churnScore >= 30) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Store prediction
    await db.insert(churnPredictions).values({
      userId,
      churnProbability: churnScore,
      riskLevel,
      factors,
      modelVersion: 'v1.0',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    return {
      churnProbability: churnScore,
      riskLevel,
      factors,
    };
  } catch (error) {
    console.error("Failed to calculate churn risk:", error);
    return {
      churnProbability: 0,
      riskLevel: 'low',
      factors: [],
    };
  }
}

/**
 * Get users at risk of churning
 */
export async function getUsersAtRisk(limit: number = 50): Promise<any[]> {
  try {
    return await db
      .select()
      .from(churnPredictions)
      .where(
        and(
          sql`${churnPredictions.riskLevel} IN ('medium', 'high')`,
          gte(churnPredictions.expiresAt, new Date())
        )
      )
      .orderBy(desc(churnPredictions.churnProbability))
      .limit(limit);
  } catch (error) {
    console.error("Failed to get users at risk:", error);
    return [];
  }
}

/**
 * Segment users based on behavior
 */
export async function segmentUsers(): Promise<{
  segments: Array<{ name: string; count: number; criteria: any }>;
}> {
  try {
    const segments = [];

    // Segment 1: Power Users (high activity)
    const powerUsers = await db.execute(sql`
      SELECT user_id, COUNT(*) as watch_count
      FROM watch_history
      WHERE started_at >= NOW() - INTERVAL '30 days'
      GROUP BY user_id
      HAVING COUNT(*) >= 50
    `);

    segments.push({
      name: 'Power Users',
      count: powerUsers.rows.length,
      criteria: { min_watches_30d: 50 },
    });

    // Segment 2: Casual Viewers (moderate activity)
    const casualViewers = await db.execute(sql`
      SELECT user_id, COUNT(*) as watch_count
      FROM watch_history
      WHERE started_at >= NOW() - INTERVAL '30 days'
      GROUP BY user_id
      HAVING COUNT(*) >= 10 AND COUNT(*) < 50
    `);

    segments.push({
      name: 'Casual Viewers',
      count: casualViewers.rows.length,
      criteria: { min_watches_30d: 10, max_watches_30d: 49 },
    });

    // Segment 3: Inactive Users (no recent activity)
    const inactiveUsers = await db.execute(sql`
      SELECT u.id as user_id
      FROM users u
      LEFT JOIN watch_history wh ON u.id = wh.user_id 
        AND wh.started_at >= NOW() - INTERVAL '30 days'
      WHERE wh.id IS NULL
    `);

    segments.push({
      name: 'Inactive Users',
      count: inactiveUsers.rows.length,
      criteria: { no_activity_30d: true },
    });

    // Segment 4: New Users (less than 7 days old)
    const newUsers = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    segments.push({
      name: 'New Users',
      count: Number(newUsers.rows[0]?.count || 0),
      criteria: { account_age_days: '<= 7' },
    });

    return { segments };
  } catch (error) {
    console.error("Failed to segment users:", error);
    return { segments: [] };
  }
}

/**
 * Track analytics event
 */
export async function trackEvent(data: {
  eventType: string;
  eventCategory?: string;
  userId?: number;
  sessionId?: string;
  page?: string;
  referrer?: string;
  properties?: any;
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
}): Promise<void> {
  try {
    await db.insert(analyticsEvents).values(data);
  } catch (error) {
    console.error("Failed to track event:", error);
  }
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary(
  startDate: Date,
  endDate: Date
): Promise<any> {
  try {
    // User engagement
    const engagement = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        COUNT(*) as total_events,
        COUNT(DISTINCT session_id) as total_sessions,
        AVG(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as avg_page_views
      FROM analytics_events
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
    `);

    // Content consumption
    const consumption = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT user_id) as viewers,
        COUNT(*) as total_watches,
        AVG(watch_percentage) as avg_completion,
        SUM(watched_duration) as total_watch_time
      FROM watch_history
      WHERE started_at >= ${startDate} AND started_at <= ${endDate}
    `);

    // Device breakdown
    const devices = await db.execute(sql`
      SELECT 
        device_type,
        COUNT(*) as count
      FROM analytics_events
      WHERE created_at >= ${startDate} 
        AND created_at <= ${endDate}
        AND device_type IS NOT NULL
      GROUP BY device_type
    `);

    return {
      engagement: engagement.rows[0],
      consumption: consumption.rows[0],
      devices: devices.rows,
    };
  } catch (error) {
    console.error("Failed to get analytics summary:", error);
    return {};
  }
}

/**
 * Get usage patterns (peak hours)
 */
export async function getUsagePatterns(): Promise<any> {
  try {
    const hourlyPattern = await db.execute(sql`
      SELECT 
        EXTRACT(HOUR FROM started_at) as hour,
        COUNT(*) as watch_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM watch_history
      WHERE started_at >= NOW() - INTERVAL '7 days'
      GROUP BY EXTRACT(HOUR FROM started_at)
      ORDER BY hour
    `);

    const dailyPattern = await db.execute(sql`
      SELECT 
        EXTRACT(DOW FROM started_at) as day_of_week,
        COUNT(*) as watch_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM watch_history
      WHERE started_at >= NOW() - INTERVAL '30 days'
      GROUP BY EXTRACT(DOW FROM started_at)
      ORDER BY day_of_week
    `);

    return {
      hourly: hourlyPattern.rows,
      daily: dailyPattern.rows,
      peakHour: hourlyPattern.rows.reduce((max, row) => 
        Number(row.watch_count) > Number(max.watch_count) ? row : max
      , hourlyPattern.rows[0]),
    };
  } catch (error) {
    console.error("Failed to get usage patterns:", error);
    return {};
  }
}

/**
 * Revenue forecasting
 */
export async function forecastRevenue(months: number = 3): Promise<any> {
  try {
    // Get historical revenue data
    const historicalRevenue = await db.execute(sql`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(amount) as revenue
      FROM credit_transactions
      WHERE amount > 0
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month
    `);

    const revenues = historicalRevenue.rows.map(r => Number(r.revenue));
    
    // Simple linear regression
    const n = revenues.length;
    if (n < 3) {
      return { forecast: [], method: 'insufficient_data' };
    }

    const avgRevenue = revenues.reduce((a, b) => a + b, 0) / n;
    const trend = (revenues[n - 1] - revenues[0]) / n;

    // Forecast next N months
    const forecast = [];
    for (let i = 1; i <= months; i++) {
      const projected = avgRevenue + (trend * i);
      forecast.push({
        month: i,
        projected_revenue: Math.max(0, Math.round(projected)),
        confidence: Math.max(0, 100 - (i * 10)), // Confidence decreases over time
      });
    }

    return {
      historical: historicalRevenue.rows,
      forecast,
      average_monthly_revenue: Math.round(avgRevenue),
      trend: trend > 0 ? 'growing' : trend < 0 ? 'declining' : 'stable',
      method: 'linear_regression',
    };
  } catch (error) {
    console.error("Failed to forecast revenue:", error);
    return { forecast: [] };
  }
}
