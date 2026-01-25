/**
 * Dashboard Page
 * Main admin dashboard with real-time stats and charts
 */

import React, { useEffect, useState } from 'react';
import {
  Users,
  Activity,
  TrendingUp,
  Server,
  Play,
  Clock,
} from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { LineChartCard, BarChartCard, PieChartCard } from '../components/Charts';
import { DataTable, Column } from '../components/DataTable';
import { useWebSocket } from '../hooks/useWebSocket';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalUsers: number;
  activeStreams: number;
  totalBandwidth: number;
  serverHealth: number;
  usersChange: number;
  streamsChange: number;
  bandwidthChange: number;
}

interface BandwidthData {
  name: string;
  bandwidth: number;
}

interface TopContent {
  id: number;
  title: string;
  views: number;
  bandwidth: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeStreams: 0,
    totalBandwidth: 0,
    serverHealth: 100,
    usersChange: 0,
    streamsChange: 0,
    bandwidthChange: 0,
  });

  const [bandwidthHistory, setBandwidthHistory] = useState<BandwidthData[]>([]);
  const [topContent, setTopContent] = useState<TopContent[]>([]);
  const [userDistribution, setUserDistribution] = useState<any[]>([]);

  const { connected, on } = useWebSocket({ autoConnect: true });

  useEffect(() => {
    // Fetch initial data
    fetchDashboardData();

    // Set up real-time updates
    const unsubBandwidth = on('bandwidth-update', (data: any) => {
      setBandwidthHistory((prev) => [...prev.slice(-23), data]);
      toast.success('Bandwidth updated', { duration: 1000 });
    });

    const unsubStats = on('stats-update', (data: DashboardStats) => {
      setStats(data);
    });

    return () => {
      unsubBandwidth();
      unsubStats();
    };
  }, [on]);

  const fetchDashboardData = async () => {
    try {
      // Fetch dashboard stats
      const statsResponse = await fetch('/api/analytics/dashboard?period=7d');
      const statsData = await statsResponse.json();

      setStats({
        totalUsers: statsData.totalUsers || 0,
        activeStreams: statsData.activeStreams || 0,
        totalBandwidth: statsData.totalBandwidth || 0,
        serverHealth: statsData.serverHealth || 100,
        usersChange: statsData.usersChange || 0,
        streamsChange: statsData.streamsChange || 0,
        bandwidthChange: statsData.bandwidthChange || 0,
      });

      // Fetch bandwidth history
      const bandwidthResponse = await fetch(
        '/api/bandwidth/stats?granularity=1hour&limit=24'
      );
      const bandwidthData = await bandwidthResponse.json();

      setBandwidthHistory(
        bandwidthData.stats?.map((stat: any) => ({
          name: new Date(stat.periodStart).toLocaleTimeString('en-US', {
            hour: '2-digit',
          }),
          bandwidth: stat.bytesTotal / 1024 / 1024 / 1024, // Convert to GB
        })) || []
      );

      // Fetch top content
      const contentResponse = await fetch('/api/analytics/top-content?limit=10');
      const contentData = await contentResponse.json();
      setTopContent(contentData.content || []);

      // Fetch user distribution
      const segmentsResponse = await fetch('/api/analytics/segments');
      const segmentsData = await segmentsResponse.json();
      setUserDistribution(
        segmentsData.segments?.map((segment: any) => ({
          name: segment.name,
          value: segment.count,
        })) || []
      );
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load dashboard data');
    }
  };

  const contentColumns: Column<TopContent>[] = [
    {
      key: 'title',
      label: 'Content',
      sortable: true,
    },
    {
      key: 'views',
      label: 'Views',
      sortable: true,
      render: (value) => value.toLocaleString(),
    },
    {
      key: 'bandwidth',
      label: 'Bandwidth',
      sortable: true,
      render: (value) => `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Real-time analytics and system overview
            {connected && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <span className="w-2 h-2 mr-1 bg-green-500 rounded-full animate-pulse"></span>
                Live
              </span>
            )}
          </p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            change={stats.usersChange}
            icon={<Users className="w-6 h-6" />}
            format="number"
          />
          <StatCard
            title="Active Streams"
            value={stats.activeStreams}
            change={stats.streamsChange}
            icon={<Activity className="w-6 h-6" />}
            format="number"
          />
          <StatCard
            title="Bandwidth (24h)"
            value={`${stats.totalBandwidth.toFixed(2)} GB`}
            change={stats.bandwidthChange}
            icon={<TrendingUp className="w-6 h-6" />}
            format="custom"
          />
          <StatCard
            title="Server Health"
            value={stats.serverHealth}
            icon={<Server className="w-6 h-6" />}
            format="percentage"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <LineChartCard
            title="Bandwidth Usage (24h)"
            data={bandwidthHistory}
            dataKey="bandwidth"
            xAxisKey="name"
            color="#3b82f6"
          />
          <PieChartCard
            title="User Distribution"
            data={userDistribution}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444']}
          />
        </div>

        {/* Top Content Table */}
        <DataTable
          title="Top Content"
          data={topContent}
          columns={contentColumns}
          searchable
          searchPlaceholder="Search content..."
          pageSize={5}
        />
      </div>
    </div>
  );
}
