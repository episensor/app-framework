import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';

export interface SocketIOConfig extends Partial<ManagerOptions & SocketOptions> {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  timeout?: number;
  transports?: string[];
  auth?: Record<string, any>;
  query?: Record<string, any>;
}

export interface SocketIOState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  retryCount: number;
  transport: 'websocket' | 'polling' | null;
}

export interface SocketIOActions {
  socket: Socket | null;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler: (data: any) => void) => void;
  once: (event: string, handler: (data: any) => void) => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

// Singleton manager for Socket.IO connections
class SocketManager {
  private sockets: Map<string, Socket> = new Map();

  getSocket(url: string, options: SocketIOConfig = {}): Socket {
    const key = url || '/';
    
    if (!this.sockets.has(key)) {
      const socket = io(url, {
        autoConnect: false,
        ...options
      });
      this.sockets.set(key, socket);
    }
    
    return this.sockets.get(key)!;
  }

  removeSocket(url: string): void {
    const key = url || '/';
    const socket = this.sockets.get(key);
    if (socket) {
      socket.disconnect();
      this.sockets.delete(key);
    }
  }
}

const socketManager = new SocketManager();

export function useSocketIO(config: SocketIOConfig = {}): [SocketIOState, SocketIOActions] {
  const {
    url = '',
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = Infinity,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    timeout = 20000,
    transports = ['websocket', 'polling'],
    auth,
    query,
    ...otherOptions
  } = config;

  const socketRef = useRef<Socket | null>(null);
  const eventHandlers = useRef<Map<string, Set<Function>>>(new Map());
  const reconnectCountRef = useRef(0);

  const [state, setState] = useState<SocketIOState>({
    connected: false,
    connecting: false,
    error: null,
    retryCount: 0,
    transport: null
  });

  // Initialize socket
  useEffect(() => {
    const socket = socketManager.getSocket(url, {
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      timeout,
      transports,
      auth,
      query,
      ...otherOptions
    });

    socketRef.current = socket;

    // Setup event listeners
    socket.on('connect', () => {
      const transport = socket.io?.engine?.transport?.name || null;
      setState({
        connected: true,
        connecting: false,
        error: null,
        retryCount: reconnectCountRef.current,
        transport
      });
      reconnectCountRef.current = 0;
    });

    socket.on('disconnect', (_reason) => {
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        transport: null
      }));
    });

    socket.on('connect_error', (error) => {
      setState(prev => ({
        ...prev,
        error: error as Error,
        connecting: false
      }));
    });

    socket.io.on('reconnect_attempt', (attemptNumber) => {
      reconnectCountRef.current = attemptNumber;
      setState(prev => ({
        ...prev,
        connecting: true,
        retryCount: attemptNumber
      }));
    });

    socket.io.on('reconnect', (_attemptNumber) => {
      const transport = socket.io?.engine?.transport?.name || null;
      setState(prev => ({
        ...prev,
        connected: true,
        connecting: false,
        retryCount: 0,
        transport
      }));
    });

    socket.io.on('reconnect_failed', () => {
      setState(prev => ({
        ...prev,
        error: new Error('Reconnection failed'),
        connecting: false
      }));
    });

    // Auto-connect if enabled
    if (autoConnect && !socket.connected) {
      socket.connect();
    }

    // Cleanup on unmount
    return () => {
      // Remove all event handlers specific to this component
      eventHandlers.current.forEach((handlers, event) => {
        handlers.forEach(handler => {
          socket.off(event, handler as any);
        });
      });
      eventHandlers.current.clear();
    };
  }, [url]); // Only recreate if URL changes

  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket is not initialized');
    }
  }, []);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
      
      // Track handlers for cleanup
      if (!eventHandlers.current.has(event)) {
        eventHandlers.current.set(event, new Set());
      }
      eventHandlers.current.get(event)!.add(handler);
    }
  }, []);

  const off = useCallback((event: string, handler: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
      
      // Remove from tracked handlers
      eventHandlers.current.get(event)?.delete(handler);
    }
  }, []);

  const once = useCallback((event: string, handler: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.once(event, handler);
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      setState(prev => ({ ...prev, connecting: true }));
      socketRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect();
    }
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      reconnectCountRef.current = 0;
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  const actions: SocketIOActions = {
    socket: socketRef.current,
    emit,
    on,
    off,
    once,
    connect,
    disconnect,
    reconnect
  };

  return [state, actions];
}

// Export singleton socket manager for advanced use cases
export { socketManager };