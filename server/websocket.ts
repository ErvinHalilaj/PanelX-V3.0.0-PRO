import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { Storage } from './storage';
import * as si from 'systeminformation';
import { getStreamProxyManager } from './streamProxy';

interface ConnectionInfo {
  lineId: number;
  streamId: number;
  username: string;
  ip: string;
  userAgent: string;
  connectedAt: Date;
  bytesTransferred: number;
  country?: string;
  city?: string;
  isp?: string;
}

export class WebSocketManager {
  private io: SocketIOServer;
  private storage: Storage;
  private activeConnections: Map<string, ConnectionInfo> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(httpServer: HTTPServer, storage: Storage) {
    this.storage = storage;
    
    // Initialize Socket.IO with CORS
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*", // In production, specify your domain
        methods: ["GET", "POST"]
      },
      path: '/socket.io/'
    });

    this.setupEventHandlers();
    this.startPeriodicUpdates();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`WebSocket client connected: ${socket.id}`);

      // Send initial data on connection
      this.sendDashboardUpdate(socket);
      this.sendConnectionsUpdate(socket);

      // Handle client requesting data
      socket.on('request:dashboard', () => {
        this.sendDashboardUpdate(socket);
      });

      socket.on('request:connections', () => {
        this.sendConnectionsUpdate(socket);
      });

      socket.on('request:bandwidth', () => {
        this.sendBandwidthUpdate(socket);
      });

      socket.on('disconnect', () => {
        console.log(`WebSocket client disconnected: ${socket.id}`);
      });
    });
  }

  private startPeriodicUpdates() {
    // Send updates every 2 seconds for real-time feel
    this.updateInterval = setInterval(() => {
      this.broadcastDashboardUpdate();
      this.broadcastConnectionsUpdate();
      this.broadcastBandwidthUpdate();
      this.broadcastSystemMetrics();
    }, 2000);
  }

  // System metrics (CPU, Memory, Disk)
  private async broadcastSystemMetrics() {
    try {
      const metrics = await this.getSystemMetrics();
      this.io.emit('system:metrics', metrics);
    } catch (error) {
      console.error('Error broadcasting system metrics:', error);
    }
  }

  private async getSystemMetrics() {
    const [cpu, mem, disk, networkStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats()
    ]);

    const primaryDisk = disk[0] || { size: 0, used: 0, available: 0 };
    const totalNetIn = networkStats.reduce((acc, iface) => acc + (iface.rx_bytes || 0), 0);
    const totalNetOut = networkStats.reduce((acc, iface) => acc + (iface.tx_bytes || 0), 0);

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        usage: cpu.currentLoad,
        cores: cpu.cpus.length
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        usagePercent: (mem.used / mem.total) * 100
      },
      disk: {
        total: primaryDisk.size,
        used: primaryDisk.used,
        free: primaryDisk.available,
        usagePercent: primaryDisk.use || 0
      },
      network: {
        bytesIn: totalNetIn,
        bytesOut: totalNetOut
      }
    };
  }

  // Dashboard statistics
  private async sendDashboardUpdate(socket: any) {
    try {
      const stats = await this.getDashboardStats();
      socket.emit('dashboard:update', stats);
    } catch (error) {
      console.error('Error sending dashboard update:', error);
    }
  }

  private async broadcastDashboardUpdate() {
    try {
      const stats = await this.getDashboardStats();
      this.io.emit('dashboard:update', stats);
    } catch (error) {
      console.error('Error broadcasting dashboard update:', error);
    }
  }

  private async getDashboardStats() {
    const [streams, lines] = await Promise.all([
      this.storage.getStreams(),
      this.storage.getLines()
    ]);

    const onlineStreams = streams.filter(s => s.monitorStatus === 'online').length;
    const activeLines = lines.filter(l => l.enabled && !this.isExpired(l.expirationDate)).length;
    const expiredLines = lines.filter(l => this.isExpired(l.expirationDate)).length;

    // Get real stats from stream proxy
    const proxyManager = getStreamProxyManager();
    const proxyStats = proxyManager?.getStats();
    const realActiveConnections = proxyStats?.activeConnections || 0;
    const realBandwidth = proxyStats?.bandwidthPerSecond || 0;

    return {
      totalStreams: streams.length,
      onlineStreams,
      offlineStreams: streams.length - onlineStreams,
      totalLines: lines.length,
      activeLines,
      expiredLines,
      activeConnections: realActiveConnections,
      totalBandwidth: this.formatBandwidth(realBandwidth),
      bandwidthPerSecond: realBandwidth,
      timestamp: new Date().toISOString()
    };
  }

  // Active connections tracking
  private async sendConnectionsUpdate(socket: any) {
    try {
      const connections = await this.getActiveConnections();
      socket.emit('connections:update', connections);
    } catch (error) {
      console.error('Error sending connections update:', error);
    }
  }

  private async broadcastConnectionsUpdate() {
    try {
      const connections = await this.getActiveConnections();
      this.io.emit('connections:update', connections);
    } catch (error) {
      console.error('Error broadcasting connections update:', error);
    }
  }

  private async getActiveConnections() {
    // Get connections from storage (you'll need to track these in connection_history table)
    const connections = await this.storage.getActiveConnections();
    
    return connections.map(conn => ({
      id: conn.id,
      username: conn.username,
      streamName: conn.streamName,
      streamType: conn.streamType,
      ip: conn.ip,
      country: conn.country,
      city: conn.city,
      isp: conn.isp,
      userAgent: conn.userAgent,
      connectedAt: conn.connectedAt,
      duration: Math.floor((Date.now() - new Date(conn.connectedAt).getTime()) / 1000),
      bytesTransferred: conn.bytesTransferred || 0
    }));
  }

  private async getActiveConnectionsCount(): Promise<number> {
    const connections = await this.storage.getActiveConnections();
    return connections.length;
  }

  // Bandwidth monitoring
  private async sendBandwidthUpdate(socket: any) {
    try {
      const bandwidth = await this.getBandwidthData();
      socket.emit('bandwidth:update', bandwidth);
    } catch (error) {
      console.error('Error sending bandwidth update:', error);
    }
  }

  private async broadcastBandwidthUpdate() {
    try {
      const bandwidth = await this.getBandwidthData();
      this.io.emit('bandwidth:update', bandwidth);
    } catch (error) {
      console.error('Error broadcasting bandwidth update:', error);
    }
  }

  private async getBandwidthData() {
    // Get real bandwidth data from stream proxy
    const proxyManager = getStreamProxyManager();
    const proxyStats = proxyManager?.getStats();
    
    const bandwidthPerSecond = proxyStats?.bandwidthPerSecond || 0;
    const bandwidthHistory = proxyStats?.bandwidthHistory || [];
    const bandwidthByStream = proxyStats?.bandwidthByStream || {};
    const connectionsByStream = proxyStats?.connectionsByStream || {};

    // Use actual bandwidth per stream (bytes/sec)
    const topStreams = Object.entries(bandwidthByStream)
      .map(([streamId, bps]) => ({
        streamId: parseInt(streamId),
        bandwidth: this.formatBandwidth(bps as number),
        bytesPerSecond: bps as number,
        viewers: (connectionsByStream[streamId] as number) || 0
      }))
      .sort((a, b) => b.bytesPerSecond - a.bytesPerSecond)
      .slice(0, 10);

    return {
      total: this.formatBandwidth(bandwidthPerSecond),
      totalBytes: proxyStats?.totalBandwidth || 0,
      perSecond: bandwidthPerSecond,
      perStream: topStreams,
      history: bandwidthHistory.slice(0, 60).map(h => ({
        ...h,
        bandwidth: this.formatBandwidth(h.bytesPerSecond || 0)
      })),
      timestamp: new Date().toISOString()
    };
  }

  // Connection tracking methods
  public trackConnection(connectionInfo: ConnectionInfo) {
    const key = `${connectionInfo.lineId}-${connectionInfo.streamId}`;
    this.activeConnections.set(key, connectionInfo);
    this.broadcastConnectionsUpdate();
  }

  public removeConnection(lineId: number, streamId: number) {
    const key = `${lineId}-${streamId}`;
    this.activeConnections.delete(key);
    this.broadcastConnectionsUpdate();
  }

  public updateConnectionBandwidth(lineId: number, streamId: number, bytes: number) {
    const key = `${lineId}-${streamId}`;
    const conn = this.activeConnections.get(key);
    if (conn) {
      conn.bytesTransferred += bytes;
      this.activeConnections.set(key, conn);
    }
  }

  // Stream status updates
  public broadcastStreamStatus(streamId: number, status: string, viewerCount?: number) {
    this.io.emit('stream:status', {
      streamId,
      status,
      viewerCount,
      timestamp: new Date().toISOString()
    });
  }

  // Utility methods
  private calculateTotalBandwidth(): number {
    let total = 0;
    this.activeConnections.forEach(conn => {
      total += conn.bytesTransferred;
    });
    return total;
  }

  private formatBandwidth(bytes: number): string {
    if (bytes < 1024) return `${bytes} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB/s`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB/s`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
  }

  private isExpired(date: Date | null): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  // Cleanup
  public destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.io.close();
  }
}

// Singleton instance
let wsManager: WebSocketManager | null = null;

export function initializeWebSocket(httpServer: HTTPServer, storage: Storage): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager(httpServer, storage);
  }
  return wsManager;
}

export function getWebSocketManager(): WebSocketManager | null {
  return wsManager;
}
