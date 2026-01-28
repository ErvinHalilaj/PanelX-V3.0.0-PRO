/**
 * Multi-Server Management Service
 * 
 * Handles server health monitoring, load balancing, and failover.
 */

import { db } from "../db";
import { 
  servers,
  serverHealthLogs,
  loadBalancingRules,
  serverSyncJobs,
  serverFailoverHistory,
  activeConnections,
  streams
} from "@shared/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";

export interface ServerHealth {
  serverId: number;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  bandwidth: number;
  activeConnections: number;
  activeStreams: number;
  responseTime: number;
  lastCheck: Date;
}

/**
 * Check server health and return current status
 */
export async function checkServerHealth(serverId: number): Promise<ServerHealth> {
  try {
    // Get latest health log
    const [latestHealth] = await db
      .select()
      .from(serverHealthLogs)
      .where(eq(serverHealthLogs.serverId, serverId))
      .orderBy(desc(serverHealthLogs.createdAt))
      .limit(1);

    // Get active stream count for this server
    const [streamCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(streams)
      .where(and(
        eq(streams.serverId, serverId),
        eq(streams.monitorStatus, 'online')
      ));

    if (!latestHealth) {
      return {
        serverId,
        status: 'offline',
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        bandwidth: 0,
        activeConnections: 0,
        activeStreams: streamCount?.count || 0,
        responseTime: 0,
        lastCheck: new Date(),
      };
    }

    return {
      serverId,
      status: (latestHealth.status as 'healthy' | 'warning' | 'critical' | 'offline') || 'healthy',
      cpuUsage: latestHealth.cpuUsage || 0,
      memoryUsage: latestHealth.memoryUsage || 0,
      diskUsage: latestHealth.diskUsage || 0,
      bandwidth: latestHealth.bandwidth || 0,
      activeConnections: latestHealth.activeConnections || 0,
      activeStreams: streamCount?.count || 0,
      responseTime: latestHealth.responseTime || 0,
      lastCheck: latestHealth.createdAt || new Date(),
    };
  } catch (error) {
    console.error("Failed to check server health:", error);
    return {
      serverId,
      status: 'offline',
      cpuUsage: 0,
      memoryUsage: 0,
      diskUsage: 0,
      bandwidth: 0,
      activeConnections: 0,
      activeStreams: 0,
      responseTime: 0,
      lastCheck: new Date(),
    };
  }
}

/**
 * Record server health metrics
 */
export async function recordServerHealth(
  serverId: number,
  metrics: {
    cpuUsage?: number;
    memoryUsage?: number;
    memoryTotal?: number;
    memoryUsed?: number;
    diskUsage?: number;
    diskTotal?: number;
    diskUsed?: number;
    networkIn?: number;
    networkOut?: number;
    bandwidth?: number;
    nginxStatus?: string;
    ffmpegProcesses?: number;
    activeStreams?: number;
    activeConnections?: number;
    responseTime?: number;
    lastError?: string;
  }
): Promise<void> {
  try {
    // Determine health status
    let status: 'healthy' | 'warning' | 'critical' | 'offline' = 'healthy';
    
    if (metrics.cpuUsage && metrics.cpuUsage > 90) status = 'critical';
    else if (metrics.cpuUsage && metrics.cpuUsage > 75) status = 'warning';
    
    if (metrics.memoryUsage && metrics.memoryUsage > 90) status = 'critical';
    else if (metrics.memoryUsage && metrics.memoryUsage > 80) status = 'warning';
    
    if (metrics.diskUsage && metrics.diskUsage > 95) status = 'critical';
    else if (metrics.diskUsage && metrics.diskUsage > 85) status = 'warning';

    // Record health log
    await db.insert(serverHealthLogs).values({
      serverId,
      cpuUsage: metrics.cpuUsage,
      memoryUsage: metrics.memoryUsage,
      memoryTotal: metrics.memoryTotal,
      memoryUsed: metrics.memoryUsed,
      diskUsage: metrics.diskUsage,
      diskTotal: metrics.diskTotal,
      diskUsed: metrics.diskUsed,
      networkIn: metrics.networkIn,
      networkOut: metrics.networkOut,
      bandwidth: metrics.bandwidth,
      nginxStatus: metrics.nginxStatus,
      ffmpegProcesses: metrics.ffmpegProcesses,
      activeStreams: metrics.activeStreams,
      activeConnections: metrics.activeConnections,
      status,
      responseTime: metrics.responseTime,
      lastError: metrics.lastError,
    });

    // Update server status
    await db
      .update(servers)
      .set({
        status: (status as string) === 'offline' ? 'offline' : 'online',
        cpuUsage: metrics.cpuUsage,
        memoryUsage: metrics.memoryUsage,
        bandwidth: metrics.bandwidth,
        currentClients: metrics.activeConnections,
        lastChecked: new Date(),
      })
      .where(eq(servers.id, serverId));

  } catch (error) {
    console.error("Failed to record server health:", error);
    throw error;
  }
}

/**
 * Get server health overview
 */
export async function getServerHealthOverview(): Promise<ServerHealth[]> {
  try {
    const query = `
      SELECT 
        s.id as "serverId",
        s.server_name as "serverName",
        s.status,
        s.cpu_usage as "cpuUsage",
        s.memory_usage as "memoryUsage",
        s.bandwidth,
        s.current_clients as "activeConnections",
        s.last_checked as "lastCheck",
        shl.disk_usage as "diskUsage",
        shl.active_streams as "activeStreams",
        shl.response_time as "responseTime"
      FROM servers s
      LEFT JOIN LATERAL (
        SELECT * FROM server_health_logs
        WHERE server_id = s.id
        ORDER BY created_at DESC
        LIMIT 1
      ) shl ON true
      WHERE s.enabled = true
      ORDER BY s.id
    `;

    const result = await db.execute(sql.raw(query));
    return result.rows as any[];
  } catch (error) {
    console.error("Failed to get server health overview:", error);
    return [];
  }
}

/**
 * Get server health history
 */
export async function getServerHealthHistory(
  serverId: number,
  hours: number = 24
): Promise<any[]> {
  try {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const logs = await db
      .select()
      .from(serverHealthLogs)
      .where(
        and(
          eq(serverHealthLogs.serverId, serverId),
          gte(serverHealthLogs.createdAt, startTime)
        )
      )
      .orderBy(serverHealthLogs.createdAt);

    return logs;
  } catch (error) {
    console.error("Failed to get server health history:", error);
    return [];
  }
}

/**
 * Select best server using load balancing strategy
 */
export async function selectServer(
  strategy: 'round_robin' | 'least_connections' | 'weighted' | 'geographic' = 'least_connections',
  options?: {
    geoLocation?: { country?: string; latitude?: number; longitude?: number };
    streamId?: number;
  }
): Promise<number | null> {
  try {
    // Get healthy servers
    const healthyServers = await db
      .select()
      .from(servers)
      .where(
        and(
          eq(servers.enabled, true),
          eq(servers.status, 'online')
        )
      );

    if (healthyServers.length === 0) {
      return null;
    }

    switch (strategy) {
      case 'least_connections': {
        // Sort by current clients (ascending)
        healthyServers.sort((a, b) => (a.currentClients || 0) - (b.currentClients || 0));
        return healthyServers[0].id;
      }

      case 'weighted': {
        // Use maxClients as weight
        const totalWeight = healthyServers.reduce((sum, s) => sum + (s.maxClients || 1000), 0);
        const random = Math.random() * totalWeight;
        
        let cumulative = 0;
        for (const server of healthyServers) {
          cumulative += server.maxClients || 1000;
          if (random <= cumulative) {
            return server.id;
          }
        }
        return healthyServers[0].id;
      }

      case 'geographic': {
        // TODO: Implement geographic selection based on user location
        // For now, fallback to least connections
        healthyServers.sort((a, b) => (a.currentClients || 0) - (b.currentClients || 0));
        return healthyServers[0].id;
      }

      case 'round_robin':
      default: {
        // Simple round robin (use server with lowest ID that hasn't been used recently)
        return healthyServers[0].id;
      }
    }
  } catch (error) {
    console.error("Failed to select server:", error);
    return null;
  }
}

/**
 * Trigger server failover
 */
export async function triggerFailover(
  fromServerId: number,
  toServerId: number,
  reason: string,
  userId?: number
): Promise<void> {
  try {
    // Count affected connections
    const affectedConns = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(activeConnections)
      .where(sql`${activeConnections.id}::text LIKE '%server_${fromServerId}%'`);

    const affectedCount = Number(affectedConns[0]?.count || 0);

    // Record failover
    await db.insert(serverFailoverHistory).values({
      fromServerId,
      toServerId,
      reason,
      triggeredBy: userId ? 'admin' : 'system',
      userId,
      affectedConnections: affectedCount,
      affectedStreams: 0, // TODO: Calculate affected streams
      status: 'completed',
    });

    // Update server status
    await db
      .update(servers)
      .set({ status: 'offline' })
      .where(eq(servers.id, fromServerId));

    console.log(`Failover completed: Server ${fromServerId} -> ${toServerId}, ${affectedCount} connections affected`);
  } catch (error) {
    console.error("Failed to trigger failover:", error);
    throw error;
  }
}

/**
 * Create server sync job
 */
export async function createSyncJob(
  jobType: 'streams' | 'lines' | 'settings' | 'full',
  sourceServerId: number | null,
  targetServerId: number
): Promise<number> {
  try {
    const inserted = await db
      .insert(serverSyncJobs)
      .values({
        jobType,
        sourceServerId,
        targetServerId,
        status: 'pending',
      })
      .returning();

    return inserted[0].id;
  } catch (error) {
    console.error("Failed to create sync job:", error);
    throw error;
  }
}

/**
 * Update sync job progress
 */
export async function updateSyncJobProgress(
  jobId: number,
  updates: {
    status?: string;
    progress?: number;
    itemsSynced?: number;
    itemsFailed?: number;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    await db
      .update(serverSyncJobs)
      .set(updates)
      .where(eq(serverSyncJobs.id, jobId));
  } catch (error) {
    console.error("Failed to update sync job:", error);
  }
}

/**
 * Get load balancing rules
 */
export async function getLoadBalancingRules(): Promise<any[]> {
  try {
    return await db
      .select()
      .from(loadBalancingRules)
      .where(eq(loadBalancingRules.enabled, true))
      .orderBy(desc(loadBalancingRules.priority));
  } catch (error) {
    console.error("Failed to get load balancing rules:", error);
    return [];
  }
}

/**
 * Check server health and trigger failover if needed
 */
export async function checkServersHealth(): Promise<void> {
  try {
    const allServers = await db
      .select()
      .from(servers)
      .where(eq(servers.enabled, true));

    for (const server of allServers) {
      // Get latest health log
      const healthLogs = await db
        .select()
        .from(serverHealthLogs)
        .where(eq(serverHealthLogs.serverId, server.id))
        .orderBy(desc(serverHealthLogs.createdAt))
        .limit(1);

      if (healthLogs.length === 0) continue;

      const health = healthLogs[0];

      // Check if server is unhealthy
      if (health.status === 'critical' || health.status === 'offline') {
        console.warn(`Server ${server.id} is ${health.status}, considering failover...`);

        // Find healthy alternative server
        const alternativeServer = await selectServer('least_connections');
        
        if (alternativeServer && alternativeServer !== server.id) {
          await triggerFailover(
            server.id,
            alternativeServer,
            `Automatic failover: Server ${health.status}`,
            undefined
          );
        }
      }
    }
  } catch (error) {
    console.error("Failed to check servers health:", error);
  }
}

/**
 * Get server statistics
 */
export async function getServerStatistics(): Promise<any> {
  try {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_servers,
        COUNT(CASE WHEN status = 'online' THEN 1 END) as online_servers,
        COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_servers,
        SUM(current_clients) as total_connections,
        AVG(cpu_usage) as avg_cpu_usage,
        AVG(memory_usage) as avg_memory_usage,
        SUM(bandwidth) as total_bandwidth
      FROM servers
      WHERE enabled = true
    `);

    return stats.rows[0] || {};
  } catch (error) {
    console.error("Failed to get server statistics:", error);
    return {};
  }
}
