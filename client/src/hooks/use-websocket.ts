import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface DashboardStats {
  totalStreams: number;
  onlineStreams: number;
  offlineStreams: number;
  totalLines: number;
  activeLines: number;
  expiredLines: number;
  activeConnections: number;
  totalBandwidth: string;
  timestamp: string;
}

interface ActiveConnection {
  id: number;
  username: string;
  streamName: string;
  streamType: string;
  ip: string;
  country?: string;
  city?: string;
  isp?: string;
  userAgent: string;
  connectedAt: string;
  duration: number;
  bytesTransferred: number;
}

interface BandwidthData {
  total: string;
  totalBytes?: number;
  perSecond?: number;
  perStream: Array<{
    streamId: number;
    bandwidth: string;
    bytesPerSecond?: number;
    viewers?: number;
  }>;
  history?: Array<{
    timestamp: string;
    bytes: number;
    bytesPerSecond: number;
    bandwidth?: string;
  }>;
  timestamp: string;
}

interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [activeConnections, setActiveConnections] = useState<ActiveConnection[]>([]);
  const [bandwidthData, setBandwidthData] = useState<BandwidthData | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [bandwidthHistory, setBandwidthHistory] = useState<Array<{ time: string; bandwidth: number; connections: number }>>([]);
  const [connectionHistory, setConnectionHistory] = useState<Array<{ time: string; connections: number }>>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Track bandwidth and connection history when data updates
  useEffect(() => {
    if (bandwidthData || dashboardStats) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      // Parse bandwidth to MB/s
      const bwValue = bandwidthData?.perSecond ? bandwidthData.perSecond / (1024 * 1024) : 0;
      const connCount = dashboardStats?.activeConnections || 0;
      
      setBandwidthHistory(prev => {
        const newData = [...prev, { time: timeStr, bandwidth: bwValue, connections: connCount }];
        return newData.slice(-30); // Keep last 30 data points (1 minute at 2s intervals)
      });
      
      setConnectionHistory(prev => {
        const newData = [...prev, { time: timeStr, connections: connCount }];
        return newData.slice(-30);
      });
    }
  }, [bandwidthData?.timestamp, dashboardStats?.timestamp]);

  useEffect(() => {
    // Connect to WebSocket server
    const socketInstance = io({
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      
      // Request initial data
      socketInstance.emit('request:dashboard');
      socketInstance.emit('request:connections');
      socketInstance.emit('request:bandwidth');
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    // Listen for dashboard updates
    socketInstance.on('dashboard:update', (data: DashboardStats) => {
      console.log('[WebSocket] Dashboard update:', data.activeConnections, 'connections,', data.totalBandwidth);
      setDashboardStats(data);
    });

    // Listen for connections updates
    socketInstance.on('connections:update', (data: ActiveConnection[]) => {
      console.log('[WebSocket] Connections update:', data.length, 'active connections');
      setActiveConnections(data);
    });

    // Listen for bandwidth updates
    socketInstance.on('bandwidth:update', (data: BandwidthData) => {
      console.log('[WebSocket] Bandwidth update:', data.total, 'perSecond:', data.perSecond);
      setBandwidthData(data);
    });

    // Listen for stream status updates
    socketInstance.on('stream:status', (data: { streamId: number; status: string; viewerCount?: number }) => {
      console.log('Stream status update:', data);
    });

    // Listen for system metrics updates (CPU, Memory, Disk)
    socketInstance.on('system:metrics', (data: SystemMetrics) => {
      setSystemMetrics(data);
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socketInstance.close();
    };
  }, []);

  // Request specific data
  const requestDashboard = () => {
    socket?.emit('request:dashboard');
  };

  const requestConnections = () => {
    socket?.emit('request:connections');
  };

  const requestBandwidth = () => {
    socket?.emit('request:bandwidth');
  };

  return {
    socket,
    connected,
    dashboardStats,
    activeConnections,
    bandwidthData,
    systemMetrics,
    bandwidthHistory,
    connectionHistory,
    requestDashboard,
    requestConnections,
    requestBandwidth
  };
}
