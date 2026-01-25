/**
 * WebSocket Hook
 * Real-time connection management
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface WebSocketState {
  connected: boolean;
  error: Error | null;
  lastMessage: any;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = window.location.origin,
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
  } = options;

  const [state, setState] = useState<WebSocketState>({
    connected: false,
    error: null,
    lastMessage: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const listenersRef = useRef<Map<string, Set<Function>>>(new Map());

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(url, {
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
    });

    socket.on('connect', () => {
      setState((prev) => ({ ...prev, connected: true, error: null }));
    });

    socket.on('disconnect', () => {
      setState((prev) => ({ ...prev, connected: false }));
    });

    socket.on('error', (error: Error) => {
      setState((prev) => ({ ...prev, error }));
    });

    // Re-attach all listeners
    listenersRef.current.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        socket.on(event, callback as any);
      });
    });

    socketRef.current = socket;
  }, [url, reconnection, reconnectionAttempts, reconnectionDelay]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event: string, callback: Function) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    if (socketRef.current) {
      socketRef.current.on(event, callback as any);
    }

    return () => {
      const listeners = listenersRef.current.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          listenersRef.current.delete(event);
        }
      }

      if (socketRef.current) {
        socketRef.current.off(event, callback as any);
      }
    };
  }, []);

  const off = useCallback((event: string, callback?: Function) => {
    if (callback) {
      const listeners = listenersRef.current.get(event);
      if (listeners) {
        listeners.delete(callback);
      }

      if (socketRef.current) {
        socketRef.current.off(event, callback as any);
      }
    } else {
      listenersRef.current.delete(event);

      if (socketRef.current) {
        socketRef.current.off(event);
      }
    }
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}

/**
 * Example Usage:
 *
 * const { connected, emit, on } = useWebSocket();
 *
 * useEffect(() => {
 *   const unsubscribe = on('bandwidth-update', (data) => {
 *     console.log('Bandwidth update:', data);
 *   });
 *
 *   return unsubscribe;
 * }, [on]);
 *
 * const handleAction = () => {
 *   emit('request-data', { userId: 123 });
 * };
 */
