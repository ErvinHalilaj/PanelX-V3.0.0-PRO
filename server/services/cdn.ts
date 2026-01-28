/**
 * CDN Integration Service
 * Multi-CDN support with intelligent selection, caching, analytics, and cost optimization
 */

import { db } from '../db';
import { 
  cdnProviders, 
  cdnConfigs, 
  cdnUsage, 
  cdnCosts,
  InsertCdnProvider,
  InsertCdnConfig,
  InsertCdnUsage,
  InsertCdnCost
} from '@shared/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';

export interface CdnProvider {
  id: number;
  name: string;
  type: 'cloudflare' | 'cloudfront' | 'akamai' | 'fastly' | 'bunnycdn' | 'custom';
  endpoint: string;
  apiKey?: string;
  enabled: boolean;
  priority: number;
  costPerGb: number;
}

export interface CdnSelectionCriteria {
  geography?: string;
  contentType?: 'live' | 'vod' | 'catchup';
  priority?: 'cost' | 'performance' | 'reliability';
  maxCost?: number;
}

export interface CdnAnalytics {
  providerId: number;
  providerName: string;
  bandwidth: number;
  requests: number;
  cacheHitRate: number;
  avgLatency: number;
  cost: number;
  uptime: number;
}

/**
 * CDN Selection Algorithm
 * Intelligently selects best CDN based on criteria
 */
export async function selectOptimalCdn(criteria: CdnSelectionCriteria): Promise<CdnProvider | null> {
  const providers = await db.select()
    .from(cdnProviders)
    .where(eq(cdnProviders.enabled, true))
    .orderBy(desc(cdnProviders.priority));

  if (providers.length === 0) return null;

  // Apply selection logic based on priority
  switch (criteria.priority) {
    case 'cost':
      return providers.reduce((min, curr) => 
        curr.costPerGb < min.costPerGb ? curr : min
      );
    
    case 'performance':
      // Get recent performance metrics
      const perfMetrics = await Promise.all(
        providers.map(async (p) => {
          const metrics = await db.select({
            avgLatency: sql<number>`AVG(${cdnUsage.avgLatency})`,
            cacheHitRate: sql<number>`AVG(${cdnUsage.cacheHitRate})`
          })
          .from(cdnUsage)
          .where(and(
            eq(cdnUsage.providerId, p.id),
            gte(cdnUsage.timestamp, sql`NOW() - INTERVAL '1 hour'`)
          ));
          
          return {
            provider: p,
            score: (metrics[0]?.cacheHitRate || 0) * 0.7 + 
                   (100 - (metrics[0]?.avgLatency || 100)) * 0.3
          };
        })
      );
      
      return perfMetrics.reduce((max, curr) => 
        curr.score > max.score ? curr : max
      ).provider;
    
    case 'reliability':
      // Get uptime metrics
      const uptimeMetrics = await Promise.all(
        providers.map(async (p) => {
          const uptime = await db.select({
            uptime: sql<number>`AVG(CASE WHEN ${cdnUsage.errorRate} < 0.01 THEN 100 ELSE 0 END)`
          })
          .from(cdnUsage)
          .where(and(
            eq(cdnUsage.providerId, p.id),
            gte(cdnUsage.timestamp, sql`NOW() - INTERVAL '24 hours'`)
          ));
          
          return { provider: p, uptime: uptime[0]?.uptime || 0 };
        })
      );
      
      return uptimeMetrics.reduce((max, curr) => 
        curr.uptime > max.uptime ? curr : max
      ).provider;
    
    default:
      // Round-robin by priority
      return providers[0];
  }
}

/**
 * Track CDN Usage
 */
export async function trackCdnUsage(data: {
  providerId: number;
  bandwidth: number;
  requests: number;
  cacheHitRate: number;
  avgLatency: number;
  errorRate: number;
}): Promise<void> {
  await db.insert(cdnUsage).values({
    providerId: data.providerId,
    bandwidth: data.bandwidth,
    requests: data.requests,
    cacheHitRate: data.cacheHitRate,
    avgLatency: data.avgLatency,
    errorRate: data.errorRate,
    timestamp: new Date()
  });

  // Calculate and record cost
  const provider = await db.select()
    .from(cdnProviders)
    .where(eq(cdnProviders.id, data.providerId))
    .limit(1);

  if (provider[0]) {
    const cost = (data.bandwidth / 1024 / 1024 / 1024) * provider[0].costPerGb; // Convert to GB
    
    await db.insert(cdnCosts).values({
      providerId: data.providerId,
      bandwidth: data.bandwidth,
      cost: cost,
      period: new Date().toISOString().substring(0, 7) // YYYY-MM format
    });
  }
}

/**
 * Get CDN Analytics
 */
export async function getCdnAnalytics(
  startDate: Date,
  endDate: Date
): Promise<CdnAnalytics[]> {
  const analytics = await db.select({
    providerId: cdnProviders.id,
    providerName: cdnProviders.name,
    bandwidth: sql<number>`SUM(${cdnUsage.bandwidth})`,
    requests: sql<number>`SUM(${cdnUsage.requests})`,
    cacheHitRate: sql<number>`AVG(${cdnUsage.cacheHitRate})`,
    avgLatency: sql<number>`AVG(${cdnUsage.avgLatency})`,
    cost: sql<number>`SUM(${cdnCosts.cost})`,
    uptime: sql<number>`AVG(CASE WHEN ${cdnUsage.errorRate} < 0.01 THEN 100 ELSE 0 END)`
  })
  .from(cdnProviders)
  .leftJoin(cdnUsage, eq(cdnUsage.providerId, cdnProviders.id))
  .leftJoin(cdnCosts, eq(cdnCosts.providerId, cdnProviders.id))
  .where(and(
    gte(cdnUsage.timestamp, startDate),
    lte(cdnUsage.timestamp, endDate)
  ))
  .groupBy(cdnProviders.id, cdnProviders.name);

  return analytics;
}

/**
 * CDN Failover Logic
 */
export async function handleCdnFailover(failedProviderId: number): Promise<CdnProvider | null> {
  // Disable failed provider temporarily
  await db.update(cdnProviders)
    .set({ enabled: false })
    .where(eq(cdnProviders.id, failedProviderId));

  // Select next best provider
  const backup = await selectOptimalCdn({ priority: 'reliability' });
  
  if (backup) {
    console.log(`CDN Failover: Switched from provider ${failedProviderId} to ${backup.id} (${backup.name})`);
  }

  return backup;
}

/**
 * Purge CDN Cache
 */
export async function purgeCdnCache(providerId: number, paths: string[]): Promise<boolean> {
  const provider = await db.select()
    .from(cdnProviders)
    .where(eq(cdnProviders.id, providerId))
    .limit(1);

  if (!provider[0]) return false;

  // Implementation depends on CDN provider
  // This is a placeholder for actual CDN API calls
  console.log(`Purging cache for provider ${provider[0].name}:`, paths);
  
  return true;
}

/**
 * Cost Optimization Report
 */
export async function getCostOptimizationReport(period: string): Promise<{
  totalCost: number;
  costByProvider: Array<{ provider: string; cost: number; bandwidth: number }>;
  recommendations: string[];
}> {
  const costs = await db.select({
    providerName: cdnProviders.name,
    cost: sql<number>`SUM(${cdnCosts.cost})`,
    bandwidth: sql<number>`SUM(${cdnCosts.bandwidth})`
  })
  .from(cdnProviders)
  .leftJoin(cdnCosts, eq(cdnCosts.providerId, cdnProviders.id))
  .where(eq(cdnCosts.period, period))
  .groupBy(cdnProviders.name);

  const totalCost = costs.reduce((sum, c) => sum + c.cost, 0);

  // Generate recommendations
  const recommendations: string[] = [];
  
  const highCostProviders = costs.filter(c => c.cost > totalCost * 0.4);
  if (highCostProviders.length > 0) {
    recommendations.push(
      `Consider reducing usage of ${highCostProviders[0].providerName} (${((highCostProviders[0].cost / totalCost) * 100).toFixed(1)}% of total cost)`
    );
  }

  const avgCostPerGb = totalCost / (costs.reduce((sum, c) => sum + c.bandwidth, 0) / 1024 / 1024 / 1024);
  if (avgCostPerGb > 0.05) {
    recommendations.push(`Average cost per GB ($${avgCostPerGb.toFixed(3)}) is above industry standard. Consider negotiating rates or switching providers.`);
  }

  return {
    totalCost,
    costByProvider: costs.map(c => ({
      provider: c.providerName,
      cost: c.cost,
      bandwidth: c.bandwidth
    })),
    recommendations
  };
}

/**
 * Get CDN Provider by ID
 */
export async function getCdnProvider(id: number) {
  return await db.select()
    .from(cdnProviders)
    .where(eq(cdnProviders.id, id))
    .limit(1)
    .then(rows => rows[0] || null);
}

/**
 * Create CDN Provider
 */
export async function createCdnProvider(data: InsertCdnProvider) {
  const result = await db.insert(cdnProviders)
    .values(data)
    .returning();
  return result[0];
}

/**
 * Update CDN Provider
 */
export async function updateCdnProvider(id: number, data: Partial<InsertCdnProvider>) {
  const result = await db.update(cdnProviders)
    .set(data)
    .where(eq(cdnProviders.id, id))
    .returning();
  return result[0];
}

/**
 * Delete CDN Provider
 */
export async function deleteCdnProvider(id: number) {
  await db.delete(cdnProviders)
    .where(eq(cdnProviders.id, id));
}

/**
 * List All CDN Providers
 */
export async function listCdnProviders() {
  return await db.select()
    .from(cdnProviders)
    .orderBy(desc(cdnProviders.priority));
}
