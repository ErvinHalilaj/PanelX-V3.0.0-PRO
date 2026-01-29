import { Request, Response } from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import type { IStorage } from './storage';
import { getWebSocketManager } from './websocket';

interface ActiveConnection {
  id: string;
  lineId: number;
  streamId: number;
  username: string;
  ip: string;
  userAgent: string;
  streamName: string;
  streamType: 'live' | 'movie' | 'series';
  startTime: Date;
  bytesTransferred: number;
  lastActivity: Date;
  response?: Response;
}

interface BandwidthStats {
  totalBytes: number;
  bytesPerSecond: number;
  bytesThisSecond: number;
  lastUpdate: Date;
  history: Array<{ timestamp: Date; bytes: number; bytesPerSecond: number }>;
}

class StreamProxyManager {
  private storage: IStorage;
  private activeConnections: Map<string, ActiveConnection> = new Map();
  private globalBandwidth: BandwidthStats = {
    totalBytes: 0,
    bytesPerSecond: 0,
    bytesThisSecond: 0,
    lastUpdate: new Date(),
    history: []
  };
  private streamBandwidth: Map<number, BandwidthStats> = new Map();
  private bandwidthInterval: NodeJS.Timeout | null = null;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.startBandwidthTracking();
  }

  private startBandwidthTracking() {
    this.bandwidthInterval = setInterval(() => {
      this.calculateBandwidthRates();
      this.broadcastStats();
    }, 1000);
  }

  private calculateBandwidthRates() {
    const now = new Date();
    const timeDiff = (now.getTime() - this.globalBandwidth.lastUpdate.getTime()) / 1000;
    
    if (timeDiff >= 1) {
      // Calculate bytes per second from the delta
      const bytesThisInterval = this.globalBandwidth.bytesThisSecond;
      this.globalBandwidth.bytesPerSecond = bytesThisInterval / timeDiff;
      
      // Update per-stream bandwidth rates
      this.streamBandwidth.forEach((stats, streamId) => {
        stats.bytesPerSecond = stats.bytesThisSecond / timeDiff;
        stats.bytesThisSecond = 0;
      });
      
      // Add to history
      this.globalBandwidth.history.unshift({ 
        timestamp: now, 
        bytes: this.globalBandwidth.totalBytes,
        bytesPerSecond: this.globalBandwidth.bytesPerSecond
      });
      
      if (this.globalBandwidth.history.length > 100) {
        this.globalBandwidth.history.pop();
      }
      
      // Reset counter for next interval
      this.globalBandwidth.bytesThisSecond = 0;
      this.globalBandwidth.lastUpdate = now;
    }
  }
  
  private trackBytes(streamId: number, bytes: number) {
    // Update global bandwidth
    this.globalBandwidth.totalBytes += bytes;
    this.globalBandwidth.bytesThisSecond += bytes;
    
    // Update per-stream bandwidth
    let streamStats = this.streamBandwidth.get(streamId);
    if (!streamStats) {
      streamStats = {
        totalBytes: 0,
        bytesPerSecond: 0,
        bytesThisSecond: 0,
        lastUpdate: new Date(),
        history: []
      };
      this.streamBandwidth.set(streamId, streamStats);
    }
    streamStats.totalBytes += bytes;
    streamStats.bytesThisSecond += bytes;
  }

  private broadcastStats() {
    const wsManager = getWebSocketManager();
    if (!wsManager) return;

    const stats = this.getStats();
    wsManager.broadcastStreamStatus(0, 'stats_update', stats.activeConnections);
  }

  public getStats() {
    const connectionsByStream: Map<number, number> = new Map();
    const connectionsByLine: Map<number, number> = new Map();
    const bandwidthByStream: Map<number, number> = new Map();

    this.activeConnections.forEach((conn) => {
      connectionsByStream.set(conn.streamId, (connectionsByStream.get(conn.streamId) || 0) + 1);
      connectionsByLine.set(conn.lineId, (connectionsByLine.get(conn.lineId) || 0) + 1);
    });
    
    // Get actual bandwidth per stream
    this.streamBandwidth.forEach((stats, streamId) => {
      bandwidthByStream.set(streamId, stats.bytesPerSecond);
    });

    return {
      activeConnections: this.activeConnections.size,
      totalBandwidth: this.globalBandwidth.totalBytes,
      bandwidthPerSecond: this.globalBandwidth.bytesPerSecond,
      connectionsByStream: Object.fromEntries(connectionsByStream),
      connectionsByLine: Object.fromEntries(connectionsByLine),
      bandwidthByStream: Object.fromEntries(bandwidthByStream),
      bandwidthHistory: this.globalBandwidth.history.slice(0, 60).map(h => ({
        timestamp: h.timestamp.toISOString(),
        bytes: h.bytes,
        bytesPerSecond: h.bytesPerSecond
      }))
    };
  }

  public getActiveConnectionsList(): ActiveConnection[] {
    return Array.from(this.activeConnections.values()).map(conn => ({
      ...conn,
      response: undefined
    }));
  }

  public getConnectionCountForLine(lineId: number): number {
    let count = 0;
    this.activeConnections.forEach((conn) => {
      if (conn.lineId === lineId) count++;
    });
    return count;
  }

  async proxyStream(
    req: Request,
    res: Response,
    lineId: number,
    streamId: number,
    streamType: 'live' | 'movie' | 'series'
  ): Promise<void> {
    const line = await this.storage.getLine(lineId);
    if (!line) {
      res.status(404).json({ error: 'Line not found' });
      return;
    }

    const stream = await this.storage.getStream(streamId);
    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }

    const currentConnections = this.getConnectionCountForLine(lineId);
    if (line.maxConnections && currentConnections >= line.maxConnections) {
      res.status(403).json({ error: 'Maximum connections reached for this line' });
      return;
    }

    const connectionId = `${lineId}-${streamId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const connection: ActiveConnection = {
      id: connectionId,
      lineId,
      streamId,
      username: line.username,
      ip: clientIp,
      userAgent,
      streamName: stream.name,
      streamType,
      startTime: new Date(),
      bytesTransferred: 0,
      lastActivity: new Date(),
      response: res
    };

    this.activeConnections.set(connectionId, connection);
    console.log(`[StreamProxy] New connection: ${connectionId} - ${line.username} watching ${stream.name}`);

    this.storage.createConnection({
      lineId,
      streamId,
      ipAddress: clientIp,
      userAgent
    }).catch((err: Error) => console.error('Failed to log connection:', err));

    const wsManager = getWebSocketManager();
    if (wsManager) {
      wsManager.trackConnection({
        lineId,
        streamId,
        username: line.username,
        ip: clientIp,
        userAgent,
        connectedAt: new Date(),
        bytesTransferred: 0
      });
    }

    const sourceUrl = stream.sourceUrl;
    
    try {
      const url = new URL(sourceUrl);
      const protocol = url.protocol === 'https:' ? https : http;
      
      const proxyReq = protocol.request({
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'Referer': url.origin + '/',
          ...this.getCustomHeaders(stream)
        },
        timeout: 30000
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': proxyRes.headers['content-type'] || 'video/mp2t',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        proxyRes.on('data', (chunk: Buffer) => {
          const conn = this.activeConnections.get(connectionId);
          if (conn) {
            conn.bytesTransferred += chunk.length;
            conn.lastActivity = new Date();
            // Track bytes for accurate bandwidth calculation
            this.trackBytes(conn.streamId, chunk.length);
          }

          try {
            res.write(chunk);
          } catch (err) {
            this.cleanupConnection(connectionId);
          }
        });

        proxyRes.on('end', () => {
          this.cleanupConnection(connectionId);
          res.end();
        });

        proxyRes.on('error', (err) => {
          console.error(`[StreamProxy] Proxy response error: ${err.message}`);
          this.cleanupConnection(connectionId);
        });
      });

      proxyReq.on('error', (err) => {
        console.error(`[StreamProxy] Proxy request error: ${err.message}`);
        this.cleanupConnection(connectionId);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Failed to connect to stream source' });
        }
      });

      proxyReq.on('timeout', () => {
        console.error(`[StreamProxy] Proxy request timeout`);
        proxyReq.destroy();
        this.cleanupConnection(connectionId);
        if (!res.headersSent) {
          res.status(504).json({ error: 'Stream source timeout' });
        }
      });

      req.on('close', () => {
        proxyReq.destroy();
        this.cleanupConnection(connectionId);
      });

      req.on('error', () => {
        proxyReq.destroy();
        this.cleanupConnection(connectionId);
      });
      
      // Handle client response disconnect
      res.on('close', () => {
        proxyReq.destroy();
        this.cleanupConnection(connectionId);
      });
      
      res.on('error', () => {
        proxyReq.destroy();
        this.cleanupConnection(connectionId);
      });
      
      // Handle aborted requests (client disconnects abruptly)
      req.on('aborted', () => {
        console.log(`[StreamProxy] Request aborted: ${connectionId}`);
        proxyReq.destroy();
        this.cleanupConnection(connectionId);
      });

      proxyReq.end();

    } catch (err: any) {
      console.error(`[StreamProxy] Error: ${err.message}`);
      this.cleanupConnection(connectionId);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream proxy error' });
      }
    }
  }

  private getCustomHeaders(stream: any): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (stream.customHeaders) {
      try {
        const customHeaders = typeof stream.customHeaders === 'string' 
          ? JSON.parse(stream.customHeaders) 
          : stream.customHeaders;
        Object.assign(headers, customHeaders);
      } catch (e) {
      }
    }
    
    return headers;
  }

  private cleanupConnection(connectionId: string) {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      console.log(`[StreamProxy] Connection ended: ${connectionId} - transferred ${this.formatBytes(conn.bytesTransferred)}`);
      
      this.storage.cleanupStaleConnections()
        .catch(err => console.error('Failed to cleanup connection:', err));
      
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.removeConnection(conn.lineId, conn.streamId);
      }
      
      this.activeConnections.delete(connectionId);
    }
  }

  public kickConnection(lineId: number, streamId?: number): number {
    let kicked = 0;
    this.activeConnections.forEach((conn, id) => {
      if (conn.lineId === lineId && (streamId === undefined || conn.streamId === streamId)) {
        if (conn.response) {
          try {
            conn.response.end();
          } catch (e) {
          }
        }
        this.cleanupConnection(id);
        kicked++;
      }
    });
    return kicked;
  }

  public kickAllConnections(): number {
    const count = this.activeConnections.size;
    this.activeConnections.forEach((conn, id) => {
      if (conn.response) {
        try {
          conn.response.end();
        } catch (e) {
        }
      }
      this.cleanupConnection(id);
    });
    return count;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  // Get real-time health data for all active streams
  public getStreamHealthData(): Array<{
    streamId: number;
    status: string;
    bitrate: number;
    activeViewers: number;
    bytesTransferred: number;
  }> {
    const healthData: Array<{
      streamId: number;
      status: string;
      bitrate: number;
      activeViewers: number;
      bytesTransferred: number;
    }> = [];

    this.streamBandwidth.forEach((stats, streamId) => {
      const viewers = Array.from(this.activeConnections.values())
        .filter(c => c.streamId === streamId).length;
      
      // Calculate bitrate in kbps from bytes per second
      const bitrateKbps = Math.round((stats.bytesPerSecond * 8) / 1000);
      
      healthData.push({
        streamId,
        status: viewers > 0 ? 'online' : 'idle',
        bitrate: bitrateKbps,
        activeViewers: viewers,
        bytesTransferred: stats.totalBytes
      });
    });

    return healthData;
  }

  // Get health data for a specific stream
  public getStreamHealth(streamId: number): {
    status: string;
    bitrate: number;
    activeViewers: number;
    bytesTransferred: number;
    connections: ActiveConnection[];
  } | null {
    const streamStats = this.streamBandwidth.get(streamId);
    const connections = Array.from(this.activeConnections.values())
      .filter(c => c.streamId === streamId);
    
    if (!streamStats && connections.length === 0) {
      return null;
    }

    const bitrateKbps = streamStats ? Math.round((streamStats.bytesPerSecond * 8) / 1000) : 0;
    
    return {
      status: connections.length > 0 ? 'online' : 'idle',
      bitrate: bitrateKbps,
      activeViewers: connections.length,
      bytesTransferred: streamStats?.totalBytes || 0,
      connections: connections.map(c => ({ ...c, response: undefined }))
    };
  }

  public destroy() {
    if (this.bandwidthInterval) {
      clearInterval(this.bandwidthInterval);
    }
    this.kickAllConnections();
  }
}

let proxyManager: StreamProxyManager | null = null;

export function initializeStreamProxy(storage: IStorage): StreamProxyManager {
  if (!proxyManager) {
    proxyManager = new StreamProxyManager(storage);
  }
  return proxyManager;
}

export function getStreamProxyManager(): StreamProxyManager | null {
  return proxyManager;
}
