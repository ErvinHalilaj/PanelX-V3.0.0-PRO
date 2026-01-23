import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { Storage } from './storage';

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
    // Send updates every 5 seconds
    this.updateInterval = setInterval(() => {
      this.broadcastDashboardUpdate();
      this.broadcastConnectionsUpdate();
      this.broadcastBandwidthUpdate();
    }, 5000);
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
    const [streams, lines, activeConnections] = await Promise.all([
      this.storage.getStreams(),
      this.storage.getLines(),
      this.getActiveConnectionsCount()
    ]);

    const onlineStreams = streams.filter(s => s.monitorStatus === 'online').length;
    const activeLines = lines.filter(l => l.enabled && !this.isExpired(l.expirationDate)).length;
    const expiredLines = lines.filter(l => this.isExpired(l.expirationDate)).length;

    return {
      totalStreams: streams.length,
      onlineStreams,
      offlineStreams: streams.length - onlineStreams,
      totalLines: lines.length,
      activeLines,
      expiredLines,
      activeConnections,
      totalBandwidth: this.calculateTotalBandwidth(),
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
    const connections = await this.storage.getActiveConnections();
    
    // Calculate bandwidth per stream
    const streamBandwidth = new Map<number, number>();
    connections.forEach(conn => {
      if (conn.streamId) {
        const current = streamBandwidth.get(conn.streamId) || 0;
        streamBandwidth.set(conn.streamId, current + (conn.bytesTransferred || 0));
      }
    });

    // Get top 10 streams by bandwidth
    const topStreams = Array.from(streamBandwidth.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([streamId, bytes]) => ({
        streamId,
        bandwidth: this.formatBandwidth(bytes)
      }));

    return {
      total: this.formatBandwidth(this.calculateTotalBandwidth()),
      perStream: topStreams,
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
