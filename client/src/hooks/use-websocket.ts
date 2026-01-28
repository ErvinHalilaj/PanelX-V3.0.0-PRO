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
  perStream: Array<{
    streamId: number;
    bandwidth: string;
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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

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
      setDashboardStats(data);
    });

    // Listen for connections updates
    socketInstance.on('connections:update', (data: ActiveConnection[]) => {
      setActiveConnections(data);
    });

    // Listen for bandwidth updates
    socketInstance.on('bandwidth:update', (data: BandwidthData) => {
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
    requestDashboard,
    requestConnections,
    requestBandwidth
  };
}
