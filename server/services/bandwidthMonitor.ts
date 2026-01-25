/**
 * Bandwidth Monitoring Service
 * 
 * Provides real-time bandwidth tracking and statistics aggregation.
 * Tracks active connections, calculates bandwidth usage, and stores
 * historical data for analytics.
 */

import { db } from "../db";
import { 
  bandwidthStats, 
  bandwidthAlerts,
  activeConnections,
  servers,
  lines,
  streams
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";

export interface BandwidthSnapshot {
  serverId?: number;
  lineId?: number;
  streamId?: number;
  bytesIn: number;
  bytesOut: number;
  bytesTotal: number;
  rateIn: number; // bytes/sec
  rateOut: number; // bytes/sec
  activeConnections: number;
  timestamp: Date;
}

export interface ConnectionMetrics {
  connectionId: string;
  lineId: number;
  streamId?: number;
  ipAddress?: string;
  bytesIn: number;
  bytesOut: number;
  currentBitrate: number; // kbps
  connectedAt: Date;
  lastSeenAt: Date;
}

/**
 * Record a bandwidth snapshot for aggregation
 */
export async function recordBandwidthSnapshot(snapshot: BandwidthSnapshot): Promise<void> {
  try {
    const periodStart = new Date(Math.floor(snapshot.timestamp.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000));
    const periodEnd = new Date(periodStart.getTime() + 5 * 60 * 1000);

    // Check if a record already exists for this period
    const existing = await db
      .select()
      .from(bandwidthStats)
      .where(
        and(
          eq(bandwidthStats.periodStart, periodStart),
          snapshot.serverId ? eq(bandwidthStats.serverId, snapshot.serverId) : sql`true`,
          snapshot.lineId ? eq(bandwidthStats.lineId, snapshot.lineId) : sql`true`,
          snapshot.streamId ? eq(bandwidthStats.streamId, snapshot.streamId) : sql`true`
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(bandwidthStats)
        .set({
          bytesIn: sql`${bandwidthStats.bytesIn} + ${snapshot.bytesIn}`,
          bytesOut: sql`${bandwidthStats.bytesOut} + ${snapshot.bytesOut}`,
          bytesTotal: sql`${bandwidthStats.bytesTotal} + ${snapshot.bytesTotal}`,
          rateIn: snapshot.rateIn,
          rateOut: snapshot.rateOut,
          activeConnections: snapshot.activeConnections,
          peakConnections: sql`GREATEST(${bandwidthStats.peakConnections}, ${snapshot.activeConnections})`,
        })
        .where(eq(bandwidthStats.id, existing[0].id));
    } else {
      // Insert new record
      await db.insert(bandwidthStats).values({
        serverId: snapshot.serverId,
        lineId: snapshot.lineId,
        streamId: snapshot.streamId,
        bytesIn: snapshot.bytesIn,
        bytesOut: snapshot.bytesOut,
        bytesTotal: snapshot.bytesTotal,
        rateIn: snapshot.rateIn,
        rateOut: snapshot.rateOut,
        activeConnections: snapshot.activeConnections,
        peakConnections: snapshot.activeConnections,
        periodStart,
        periodEnd,
        granularity: "5min",
      });
    }
  } catch (error) {
    console.error("Failed to record bandwidth snapshot:", error);
    throw error;
  }
}

/**
 * Get bandwidth statistics for a time range
 */
export async function getBandwidthStats(
  startTime: Date,
  endTime: Date,
  filters?: {
    serverId?: number;
    lineId?: number;
    streamId?: number;
    granularity?: string;
  }
): Promise<any[]> {
  try {
    const conditions = [
      gte(bandwidthStats.periodStart, startTime),
      lte(bandwidthStats.periodEnd, endTime),
    ];

    if (filters?.serverId) {
      conditions.push(eq(bandwidthStats.serverId, filters.serverId));
    }
    if (filters?.lineId) {
      conditions.push(eq(bandwidthStats.lineId, filters.lineId));
    }
    if (filters?.streamId) {
      conditions.push(eq(bandwidthStats.streamId, filters.streamId));
    }
    if (filters?.granularity) {
      conditions.push(eq(bandwidthStats.granularity, filters.granularity));
    }

    const stats = await db
      .select()
      .from(bandwidthStats)
      .where(and(...conditions))
      .orderBy(bandwidthStats.periodStart);

    return stats;
  } catch (error) {
    console.error("Failed to get bandwidth stats:", error);
    throw error;
  }
}

/**
 * Get real-time bandwidth overview
 */
export async function getRealTimeBandwidthOverview(): Promise<{
  totalBytesIn: number;
  totalBytesOut: number;
  totalConnections: number;
  serversOnline: number;
  topStreams: any[];
  topLines: any[];
}> {
  try {
    // Get last 5 minutes of data
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const recentStats = await db
      .select()
      .from(bandwidthStats)
      .where(gte(bandwidthStats.periodStart, fiveMinutesAgo));

    // Aggregate totals
    const totalBytesIn = recentStats.reduce((sum, stat) => sum + (stat.bytesIn || 0), 0);
    const totalBytesOut = recentStats.reduce((sum, stat) => sum + (stat.bytesOut || 0), 0);
    const totalConnections = recentStats.reduce((sum, stat) => sum + (stat.activeConnections || 0), 0);

    // Get active servers
    const onlineServers = await db
      .select()
      .from(servers)
      .where(eq(servers.status, "online"));

    // Get top streams by bandwidth
    const topStreams = await db
      .select({
        streamId: bandwidthStats.streamId,
        totalBytes: sql<number>`SUM(${bandwidthStats.bytesTotal})`.as('total_bytes'),
        connections: sql<number>`MAX(${bandwidthStats.activeConnections})`.as('connections'),
      })
      .from(bandwidthStats)
      .where(
        and(
          gte(bandwidthStats.periodStart, fiveMinutesAgo),
          sql`${bandwidthStats.streamId} IS NOT NULL`
        )
      )
      .groupBy(bandwidthStats.streamId)
      .orderBy(desc(sql`SUM(${bandwidthStats.bytesTotal})`))
      .limit(10);

    // Get top lines by bandwidth
    const topLines = await db
      .select({
        lineId: bandwidthStats.lineId,
        totalBytes: sql<number>`SUM(${bandwidthStats.bytesTotal})`.as('total_bytes'),
        connections: sql<number>`MAX(${bandwidthStats.activeConnections})`.as('connections'),
      })
      .from(bandwidthStats)
      .where(
        and(
          gte(bandwidthStats.periodStart, fiveMinutesAgo),
          sql`${bandwidthStats.lineId} IS NOT NULL`
        )
      )
      .groupBy(bandwidthStats.lineId)
      .orderBy(desc(sql`SUM(${bandwidthStats.bytesTotal})`))
      .limit(10);

    return {
      totalBytesIn,
      totalBytesOut,
      totalConnections,
      serversOnline: onlineServers.length,
      topStreams: topStreams.map(s => ({
        streamId: s.streamId,
        totalBytes: Number(s.totalBytes),
        connections: Number(s.connections),
      })),
      topLines: topLines.map(l => ({
        lineId: l.lineId,
        totalBytes: Number(l.totalBytes),
        connections: Number(l.connections),
      })),
    };
  } catch (error) {
    console.error("Failed to get real-time bandwidth overview:", error);
    throw error;
  }
}

/**
 * Update active connection metrics
 */
export async function updateConnectionMetrics(
  connectionId: string,
  metrics: Partial<ConnectionMetrics>
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(activeConnections)
      .where(sql`${activeConnections.id} = ${connectionId}`)
      .limit(1);

    if (existing.length > 0) {
      // Update existing connection
      await db
        .update(activeConnections)
        .set({
          lastPing: new Date(),
          // Add more fields as needed based on schema
        })
        .where(sql`${activeConnections.id} = ${connectionId}`);
    }
  } catch (error) {
    console.error("Failed to update connection metrics:", error);
    throw error;
  }
}

/**
 * Clean up old bandwidth stats (retention policy)
 */
export async function cleanupOldStats(daysToKeep: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const result = await db
      .delete(bandwidthStats)
      .where(lte(bandwidthStats.createdAt, cutoffDate));

    return result.rowCount || 0;
  } catch (error) {
    console.error("Failed to cleanup old bandwidth stats:", error);
    throw error;
  }
}

/**
 * Check bandwidth alerts and trigger actions
 */
export async function checkBandwidthAlerts(): Promise<void> {
  try {
    const alerts = await db
      .select()
      .from(bandwidthAlerts)
      .where(eq(bandwidthAlerts.enabled, true));

    for (const alert of alerts) {
      // Get recent stats based on alert scope
      const conditions: any[] = [];
      
      if (alert.serverId) {
        conditions.push(eq(bandwidthStats.serverId, alert.serverId));
      }
      if (alert.lineId) {
        conditions.push(eq(bandwidthStats.lineId, alert.lineId));
      }
      if (alert.streamId) {
        conditions.push(eq(bandwidthStats.streamId, alert.streamId));
      }

      const durationAgo = new Date(Date.now() - (alert.duration || 300) * 1000);
      conditions.push(gte(bandwidthStats.periodStart, durationAgo));

      const recentStats = await db
        .select()
        .from(bandwidthStats)
        .where(and(...conditions));

      // Evaluate alert condition
      let shouldTrigger = false;
      const metricValue = calculateMetricValue(recentStats, alert.metric);

      switch (alert.operator) {
        case 'greater_than':
          shouldTrigger = metricValue > alert.threshold;
          break;
        case 'less_than':
          shouldTrigger = metricValue < alert.threshold;
          break;
        case 'equal_to':
          shouldTrigger = metricValue === alert.threshold;
          break;
      }

      if (shouldTrigger) {
        // Trigger alert actions
        await triggerAlertActions(alert, metricValue);
        
        // Update alert metadata
        await db
          .update(bandwidthAlerts)
          .set({
            lastTriggered: new Date(),
            triggerCount: sql`${bandwidthAlerts.triggerCount} + 1`,
          })
          .where(eq(bandwidthAlerts.id, alert.id));
      }
    }
  } catch (error) {
    console.error("Failed to check bandwidth alerts:", error);
  }
}

function calculateMetricValue(stats: any[], metric: string): number {
  switch (metric) {
    case 'bandwidth':
      return stats.reduce((sum, s) => sum + (s.bytesTotal || 0), 0);
    case 'connections':
      return Math.max(...stats.map(s => s.activeConnections || 0), 0);
    case 'bitrate':
      return Math.max(...stats.map(s => (s.rateIn || 0) + (s.rateOut || 0)), 0);
    default:
      return 0;
  }
}

async function triggerAlertActions(alert: any, metricValue: number): Promise<void> {
  console.log(`Alert triggered: ${alert.name}, metric value: ${metricValue}`);
  
  // TODO: Implement webhook/email/SMS notifications
  if (alert.webhookUrl) {
    // Send webhook
  }
  
  if (alert.emailRecipients && alert.emailRecipients.length > 0) {
    // Send email
  }
}
