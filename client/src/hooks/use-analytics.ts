import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface StreamAnalytics {
  streamId: number;
  streamName: string;
  totalViews: number;
  uniqueViewers: number;
  totalWatchTime: number;
  avgWatchTime: number;
  peakViewers: number;
  currentViewers: number;
  revenue: number;
  bandwidth: number;
}

interface ViewerAnalytics {
  userId?: number;
  lineId?: number;
  username?: string;
  totalWatchTime: number;
  streamsWatched: number;
  lastActive: Date;
  favoriteStream?: string;
  averageSessionDuration: number;
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
  totalBandwidth: number;
  avgStreamHealth: number;
  uptime: number;
}

interface TimeSeriesData {
  timestamp: string;
  value: number;
}

interface PopularContent {
  streamId: number;
  streamName: string;
  views: number;
  watchTime: number;
  uniqueViewers: number;
}

/**
 * Get stream analytics
 */
export function useStreamAnalytics(streamId?: number, days: number = 7) {
  return useQuery({
    queryKey: ['analytics', 'streams', streamId, days],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (streamId) params.append('streamId', streamId.toString());
      params.append('days', days.toString());

      const { data } = await axios.get<{ analytics: StreamAnalytics[] }>(
        `/api/analytics/streams?${params.toString()}`
      );
      return data.analytics;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Get viewer analytics
 */
export function useViewerAnalytics(days: number = 7) {
  return useQuery({
    queryKey: ['analytics', 'viewers', days],
    queryFn: async () => {
      const { data } = await axios.get<{ analytics: ViewerAnalytics[] }>(
        `/api/analytics/viewers?days=${days}`
      );
      return data.analytics;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Get revenue analytics
 */
export function useRevenueAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ['analytics', 'revenue', days],
    queryFn: async () => {
      const { data } = await axios.get<RevenueAnalytics>(
        `/api/analytics/revenue?days=${days}`
      );
      return data;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

/**
 * Get system analytics
 */
export function useSystemAnalytics() {
  return useQuery({
    queryKey: ['analytics', 'system'],
    queryFn: async () => {
      const { data } = await axios.get<SystemAnalytics>('/api/analytics/system');
      return data;
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
}

/**
 * Get time series data
 */
export function useTimeSeriesData(
  metric: 'viewers' | 'bandwidth' | 'revenue',
  hours: number = 24
) {
  return useQuery({
    queryKey: ['analytics', 'timeseries', metric, hours],
    queryFn: async () => {
      const { data } = await axios.get<{ data: TimeSeriesData[] }>(
        `/api/analytics/timeseries?metric=${metric}&hours=${hours}`
      );
      return data.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Get popular content
 */
export function usePopularContent(limit: number = 10, days: number = 7) {
  return useQuery({
    queryKey: ['analytics', 'popular', limit, days],
    queryFn: async () => {
      const { data } = await axios.get<{ content: PopularContent[] }>(
        `/api/analytics/popular?limit=${limit}&days=${days}`
      );
      return data.content;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}
