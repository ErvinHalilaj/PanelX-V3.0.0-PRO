/**
 * Analytics Service
 * Handles analytics data collection, aggregation, and reporting
 */

import { storage } from './storage';

interface StreamAnalytics {
  streamId: number;
  streamName: string;
  totalViews: number;
  uniqueViewers: number;
  totalWatchTime: number; // minutes
  avgWatchTime: number; // minutes
  peakViewers: number;
  currentViewers: number;
  revenue: number;
  bandwidth: number; // GB
}

interface ViewerAnalytics {
  userId?: number;
  lineId?: number;
  username?: string;
  totalWatchTime: number; // minutes
  streamsWatched: number;
  lastActive: Date;
  favoriteStream?: string;
  averageSessionDuration: number; // minutes
}

interface RevenueAnalytics {
  totalRevenue: number;
  subscriptionRevenue: number;
  resellerRevenue: number;
  dailyRevenue: Array<{ date: string; amount: number }>;
  monthlyRevenue: Array<{ month: string; amount: number }>;
  topResellersByRevenue: Array<{ resellerId: number; username: string; revenue: number }>;
}

interface SystemAnalytics {
  totalStreams: number;
  activeStreams: number;
  totalUsers: number;
  activeUsers: number;
  totalLines: number;
  activeLines: number;
  totalConnections: number;
  totalBandwidth: number; // GB
  avgStreamHealth: number;
  uptime: number; // percentage
}

interface TimeSeriesData {
  timestamp: Date;
  value: number;
}

class AnalyticsService {
  private analyticsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 60000; // 1 minute cache

  /**
   * Get cached data or fetch fresh
   */
  private async getCached<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const cached = this.analyticsCache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }

    const data = await fetchFn();
    this.analyticsCache.set(key, { data, timestamp: now });
    return data;
  }

  /**
   * Get stream analytics
   */
  async getStreamAnalytics(streamId?: number, days: number = 7): Promise<StreamAnalytics[]> {
    return this.getCached(`stream-analytics-${streamId}-${days}`, async () => {
      const streams = streamId 
        ? [await storage.getStream(streamId)].filter(Boolean)
        : await storage.getStreams();

      const analytics: StreamAnalytics[] = [];

      for (const stream of streams) {
        if (!stream) continue;

        // Get connection history for this stream
        const connections = await storage.getConnectionHistory();
        const streamConnections = connections.filter(
          c => c.streamId === stream.id && this.isWithinDays(new Date(c.connectedAt), days)
        );

        // Calculate metrics
        const totalViews = streamConnections.length;
        const uniqueViewers = new Set(streamConnections.map(c => c.lineId)).size;
        const totalWatchTime = streamConnections.reduce((sum, c) => sum + (c.duration || 0), 0) / 60; // to minutes
        const avgWatchTime = totalViews > 0 ? totalWatchTime / totalViews : 0;

        // Get current viewers from active connections
        const activeConnections = await storage.getActiveConnections();
        const currentViewers = activeConnections.filter(c => c.streamId === stream.id).length;

        // Calculate peak viewers (simplified - max concurrent)
        const peakViewers = this.calculatePeakViewers(streamConnections);

        // Calculate bandwidth (simplified estimate: avg 2Mbps per viewer)
        const bandwidth = (totalWatchTime * 2 * 60) / (8 * 1024); // GB

        // Calculate revenue (simplified: $0.001 per minute watched)
        const revenue = totalWatchTime * 0.001;

        analytics.push({
          streamId: stream.id,
          streamName: stream.streamName,
          totalViews,
          uniqueViewers,
          totalWatchTime,
          avgWatchTime,
          peakViewers,
          currentViewers,
          revenue,
          bandwidth,
        });
      }

      // Sort by total views descending
      return analytics.sort((a, b) => b.totalViews - a.totalViews);
    });
  }

  /**
   * Get viewer analytics
   */
  async getViewerAnalytics(days: number = 7): Promise<ViewerAnalytics[]> {
    return this.getCached(`viewer-analytics-${days}`, async () => {
      const connections = await storage.getConnectionHistory();
      const recentConnections = connections.filter(
        c => this.isWithinDays(new Date(c.connectedAt), days)
      );

      // Group by line ID
      const viewerMap = new Map<number, ViewerAnalytics>();

      for (const conn of recentConnections) {
        if (!conn.lineId) continue;

        const existing = viewerMap.get(conn.lineId) || {
          lineId: conn.lineId,
          username: conn.username,
          totalWatchTime: 0,
          streamsWatched: 0,
          lastActive: new Date(conn.connectedAt),
          averageSessionDuration: 0,
        };

        existing.totalWatchTime += (conn.duration || 0) / 60; // to minutes
        existing.streamsWatched = new Set([...Array(existing.streamsWatched), conn.streamId]).size;
        
        const connDate = new Date(conn.connectedAt);
        if (connDate > existing.lastActive) {
          existing.lastActive = connDate;
        }

        viewerMap.set(conn.lineId, existing);
      }

      // Calculate average session duration
      const analytics = Array.from(viewerMap.values()).map(viewer => {
        const sessions = recentConnections.filter(c => c.lineId === viewer.lineId);
        viewer.averageSessionDuration = sessions.length > 0 
          ? viewer.totalWatchTime / sessions.length 
          : 0;

        // Find favorite stream (most watched)
        const streamCounts = new Map<number, number>();
        sessions.forEach(s => {
          streamCounts.set(s.streamId, (streamCounts.get(s.streamId) || 0) + 1);
        });
        const favoriteStreamId = Array.from(streamCounts.entries())
          .sort((a, b) => b[1] - a[1])[0]?.[0];
        
        if (favoriteStreamId) {
          const stream = sessions.find(s => s.streamId === favoriteStreamId);
          viewer.favoriteStream = stream?.streamName;
        }

        return viewer;
      });

      // Sort by total watch time descending
      return analytics.sort((a, b) => b.totalWatchTime - a.totalWatchTime);
    });
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(days: number = 30): Promise<RevenueAnalytics> {
    return this.getCached(`revenue-analytics-${days}`, async () => {
      const transactions = await storage.getCreditTransactions();
      const recentTransactions = transactions.filter(
        t => this.isWithinDays(new Date(t.createdAt), days)
      );

      // Calculate total revenue (credits as revenue)
      const totalRevenue = recentTransactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

      // Separate subscription vs reseller revenue
      const subscriptionRevenue = recentTransactions
        .filter(t => t.amount > 0 && t.reason?.includes('line_'))
        .reduce((sum, t) => sum + t.amount, 0);
      
      const resellerRevenue = totalRevenue - subscriptionRevenue;

      // Daily revenue
      const dailyMap = new Map<string, number>();
      recentTransactions.forEach(t => {
        if (t.amount > 0) {
          const date = new Date(t.createdAt).toISOString().split('T')[0];
          dailyMap.set(date, (dailyMap.get(date) || 0) + t.amount);
        }
      });
      const dailyRevenue = Array.from(dailyMap.entries())
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Monthly revenue (aggregate daily)
      const monthlyMap = new Map<string, number>();
      dailyRevenue.forEach(({ date, amount }) => {
        const month = date.substring(0, 7); // YYYY-MM
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + amount);
      });
      const monthlyRevenue = Array.from(monthlyMap.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => a.month.localeCompare(b.month));

      // Top resellers by revenue
      const resellerMap = new Map<number, { username: string; revenue: number }>();
      const users = await storage.getUsers();
      
      for (const t of recentTransactions.filter(t => t.amount > 0)) {
        const user = users.find(u => u.id === t.userId);
        if (user?.role === 'reseller') {
          const existing = resellerMap.get(t.userId) || { username: user.username, revenue: 0 };
          existing.revenue += t.amount;
          resellerMap.set(t.userId, existing);
        }
      }

      const topResellersByRevenue = Array.from(resellerMap.entries())
        .map(([resellerId, data]) => ({ resellerId, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      return {
        totalRevenue,
        subscriptionRevenue,
        resellerRevenue,
        dailyRevenue,
        monthlyRevenue,
        topResellersByRevenue,
      };
    });
  }

  /**
   * Get system analytics
   */
  async getSystemAnalytics(): Promise<SystemAnalytics> {
    return this.getCached('system-analytics', async () => {
      const streams = await storage.getStreams();
      const users = await storage.getUsers();
      const lines = await storage.getLines();
      const connections = await storage.getActiveConnections();

      // Calculate active streams (those with connections)
      const activeStreamIds = new Set(connections.map(c => c.streamId));
      const activeStreams = streams.filter(s => activeStreamIds.has(s.id)).length;

      // Calculate active users/lines (those with active connections)
      const activeLineIds = new Set(connections.map(c => c.lineId));
      const activeLines = lines.filter(l => activeLineIds.has(l.id)).length;
      const activeUsers = users.filter(u => 
        lines.some(l => l.userId === u.id && activeLineIds.has(l.id))
      ).length;

      // Calculate total bandwidth (estimate: 2Mbps per connection)
      const totalBandwidth = (connections.length * 2 * 60) / (8 * 1024); // GB per hour

      // Calculate average stream health
      const streamErrors = await storage.getStreamErrors();
      const recentErrors = streamErrors.filter(e => 
        this.isWithinDays(new Date(e.occurredAt), 1)
      );
      const avgStreamHealth = Math.max(0, 100 - (recentErrors.length / streams.length) * 10);

      // Uptime (simplified: 99.9% if no major errors)
      const uptime = recentErrors.length < 10 ? 99.9 : 95.0;

      return {
        totalStreams: streams.length,
        activeStreams,
        totalUsers: users.length,
        activeUsers,
        totalLines: lines.length,
        activeLines,
        totalConnections: connections.length,
        totalBandwidth,
        avgStreamHealth,
        uptime,
      };
    });
  }

  /**
   * Get time series data for a metric
   */
  async getTimeSeriesData(
    metric: 'viewers' | 'bandwidth' | 'revenue',
    hours: number = 24
  ): Promise<TimeSeriesData[]> {
    const key = `timeseries-${metric}-${hours}`;
    return this.getCached(key, async () => {
      const now = new Date();
      const data: TimeSeriesData[] = [];

      // Generate hourly data points
      for (let i = hours; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
        let value = 0;

        if (metric === 'viewers') {
          // Simulate viewer count (replace with real data)
          const connections = await storage.getConnectionHistory();
          value = connections.filter(c => {
            const connTime = new Date(c.connectedAt);
            return connTime >= timestamp && connTime < new Date(timestamp.getTime() + 60 * 60 * 1000);
          }).length;
        } else if (metric === 'bandwidth') {
          // Estimate bandwidth
          value = Math.random() * 100; // GB (replace with real data)
        } else if (metric === 'revenue') {
          // Calculate revenue for this hour
          const transactions = await storage.getCreditTransactions();
          value = transactions.filter(t => {
            const txTime = new Date(t.createdAt);
            return txTime >= timestamp && txTime < new Date(timestamp.getTime() + 60 * 60 * 1000) && t.amount > 0;
          }).reduce((sum, t) => sum + t.amount, 0);
        }

        data.push({ timestamp, value });
      }

      return data;
    });
  }

  /**
   * Get popular content (most watched streams)
   */
  async getPopularContent(limit: number = 10, days: number = 7): Promise<Array<{
    streamId: number;
    streamName: string;
    views: number;
    watchTime: number;
    uniqueViewers: number;
  }>> {
    const analytics = await this.getStreamAnalytics(undefined, days);
    return analytics.slice(0, limit).map(a => ({
      streamId: a.streamId,
      streamName: a.streamName,
      views: a.totalViews,
      watchTime: a.totalWatchTime,
      uniqueViewers: a.uniqueViewers,
    }));
  }

  /**
   * Clear analytics cache
   */
  clearCache(): void {
    this.analyticsCache.clear();
  }

  /**
   * Helper: Check if date is within N days
   */
  private isWithinDays(date: Date, days: number): boolean {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff <= days * 24 * 60 * 60 * 1000;
  }

  /**
   * Helper: Calculate peak concurrent viewers
   */
  private calculatePeakViewers(connections: Array<{ connectedAt: string; duration?: number }>): number {
    // Simplified: assume max concurrent is 10% of total unique sessions
    return Math.ceil(connections.length * 0.1);
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService();
