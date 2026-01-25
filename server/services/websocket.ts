/**
 * WebSocket Server
 * Real-time communication for dashboard and monitoring
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer | null = null;

export function initializeWebSocket(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`WebSocket client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`WebSocket client disconnected: ${socket.id}`);
    });

    socket.on('subscribe', (topic: string) => {
      socket.join(topic);
      console.log(`Client ${socket.id} subscribed to ${topic}`);
    });

    socket.on('unsubscribe', (topic: string) => {
      socket.leave(topic);
      console.log(`Client ${socket.id} unsubscribed from ${topic}`);
    });
  });

  console.log('✅ WebSocket server initialized');
  return io;
}

export function getWebSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Emit bandwidth update to all connected clients
 */
export function emitBandwidthUpdate(data: any) {
  if (io) {
    io.emit('bandwidth-update', data);
  }
}

/**
 * Emit stats update to all connected clients
 */
export function emitStatsUpdate(data: any) {
  if (io) {
    io.emit('stats-update', data);
  }
}

/**
 * Emit event to specific room/topic
 */
export function emitToRoom(room: string, event: string, data: any) {
  if (io) {
    io.to(room).emit(event, data);
  }
}
