/**
 * WebSocket Manager Service
 * Provides unified WebSocket management with Socket.io
 */

import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { Server as SocketIOServer, Socket, Namespace } from 'socket.io';
// Redis adapter imports (optional dependencies)
import { EventEmitter } from 'events';
import { createLogger } from './enhancedLogger.js';

const logger = createLogger('WebSocketManager');

export interface WebSocketManagerOptions {
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  adapter?: 'memory' | 'redis';
  redisUrl?: string;
  pingInterval?: number;
  pingTimeout?: number;
  maxHttpBufferSize?: number;
  transports?: ('polling' | 'websocket')[];
  path?: string;
  authentication?: boolean;
  authHandler?: (socket: Socket) => Promise<boolean>;
}

export interface WebSocketNamespaceOptions {
  authentication?: boolean;
  authHandler?: (socket: Socket) => Promise<boolean>;
  middlewares?: Array<(socket: Socket, next: (err?: any) => void) => void>;
  roomJoinHandler?: (socket: Socket, room: string) => Promise<boolean>;
}

export interface ClientInfo {
  id: string;
  namespace: string;
  rooms: string[];
  data: any;
  connectedAt: Date;
  address: string;
}

export interface BroadcastOptions {
  namespace?: string;
  room?: string;
  except?: string[];
  volatile?: boolean;
  compress?: boolean;
}

export class WebSocketManager extends EventEmitter {
  private io: SocketIOServer | null = null;
  private namespaces: Map<string, Namespace> = new Map();
  private clients: Map<string, ClientInfo> = new Map();
  private redisClient?: any;
  private redisSubClient?: any;
  private isInitialized: boolean = false;
  private options: WebSocketManagerOptions;

  constructor(options: WebSocketManagerOptions = {}) {
    super();
    this.options = {
      cors: {
        origin: '*',
        credentials: true
      },
      pingInterval: 25000,
      pingTimeout: 60000,
      maxHttpBufferSize: 1e6,
      transports: ['polling', 'websocket'],
      path: '/socket.io/',
      ...options
    };
  }

  /**
   * Initialize WebSocket server
   */
  async initialize(httpServer: HttpServer | HttpsServer): Promise<void> {
    if (this.isInitialized) {
      logger.warn('WebSocket manager already initialized');
      return;
    }

    try {
      // Create Socket.io server
      this.io = new SocketIOServer(httpServer, {
        cors: this.options.cors,
        pingInterval: this.options.pingInterval,
        pingTimeout: this.options.pingTimeout,
        maxHttpBufferSize: this.options.maxHttpBufferSize,
        transports: this.options.transports,
        path: this.options.path
      });

      // Setup Redis adapter if configured
      if (this.options.adapter === 'redis' && this.options.redisUrl) {
        await this.setupRedisAdapter();
      }

      // Setup default namespace
      this.setupDefaultNamespace();

      // Global authentication if configured
      if (this.options.authentication && this.options.authHandler) {
        this.io.use(async (socket, next) => {
          try {
            const authenticated = await this.options.authHandler!(socket);
            if (authenticated) {
              next();
            } else {
              next(new Error('Authentication failed'));
            }
          } catch (error) {
            next(error as Error);
          }
        });
      }

      this.isInitialized = true;
      logger.info('WebSocket manager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket manager:', error);
      throw error;
    }
  }

  /**
   * Setup Redis adapter for scaling
   */
  private async setupRedisAdapter(): Promise<void> {
    try {
      // Try to load Redis modules dynamically
      let createClient: any;
      let createAdapter: any;
      
      try {
        // @ts-ignore - Optional dependency
        const redisModule = await import('redis');
        createClient = redisModule.createClient;
      } catch (e) {
        throw new Error('Redis module not installed. Run: npm install redis');
      }
      
      try {
        // @ts-ignore - Optional dependency  
        const adapterModule = await import('@socket.io/redis-adapter');
        createAdapter = adapterModule.createAdapter;
      } catch (e) {
        throw new Error('Redis adapter not installed. Run: npm install @socket.io/redis-adapter');
      }

      this.redisClient = createClient({ url: this.options.redisUrl });
      this.redisSubClient = this.redisClient.duplicate();

      await Promise.all([
        this.redisClient.connect(),
        this.redisSubClient.connect()
      ]);

      this.io!.adapter(createAdapter(this.redisClient, this.redisSubClient));
      logger.info('Redis adapter configured for WebSocket scaling');
    } catch (error) {
      logger.error('Failed to setup Redis adapter:', error);
      throw error;
    }
  }

  /**
   * Setup default namespace handlers
   */
  private setupDefaultNamespace(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      this.handleConnection(socket, '/');
    });
  }

  /**
   * Register a namespace with handlers
   */
  registerNamespace(
    name: string, 
    handlers: Record<string, (socket: Socket, ...args: any[]) => void>,
    options: WebSocketNamespaceOptions = {}
  ): Namespace {
    if (!this.io) {
      throw new Error('WebSocket manager not initialized');
    }

    // Get or create namespace
    const nsp = this.io.of(name);
    this.namespaces.set(name, nsp);

    // Apply namespace-specific authentication
    if (options.authentication && options.authHandler) {
      nsp.use(async (socket, next) => {
        try {
          const authenticated = await options.authHandler!(socket);
          if (authenticated) {
            next();
          } else {
            next(new Error('Authentication failed'));
          }
        } catch (error) {
          next(error as Error);
        }
      });
    }

    // Apply custom middlewares
    if (options.middlewares) {
      options.middlewares.forEach(middleware => {
        nsp.use(middleware);
      });
    }

    // Setup connection handler
    nsp.on('connection', (socket) => {
      this.handleConnection(socket, name);

      // Register event handlers
      Object.entries(handlers).forEach(([event, handler]) => {
        socket.on(event, (...args) => {
          try {
            handler(socket, ...args);
          } catch (error) {
            logger.error(`Error handling event ${event} in namespace ${name}:`, error);
            socket.emit('error', { event, error: 'Internal server error' });
          }
        });
      });

      // Room join handler
      if (options.roomJoinHandler) {
        socket.on('join-room', async (room: string, callback) => {
          try {
            const allowed = await options.roomJoinHandler!(socket, room);
            if (allowed) {
              await socket.join(room);
              callback({ success: true });
            } else {
              callback({ success: false, error: 'Not authorized to join room' });
            }
          } catch (error) {
            callback({ success: false, error: 'Failed to join room' });
          }
        });
      }
    });

    logger.info(`Namespace ${name} registered with ${Object.keys(handlers).length} handlers`);
    return nsp;
  }

  /**
   * Handle client connection
   */
  private handleConnection(socket: Socket, namespace: string): void {
    const clientInfo: ClientInfo = {
      id: socket.id,
      namespace,
      rooms: Array.from(socket.rooms),
      data: socket.data,
      connectedAt: new Date(),
      address: socket.handshake.address
    };

    this.clients.set(socket.id, clientInfo);
    logger.debug(`Client connected: ${socket.id} to namespace ${namespace}`);
    this.emit('client:connected', clientInfo);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.clients.delete(socket.id);
      logger.debug(`Client disconnected: ${socket.id} from namespace ${namespace}, reason: ${reason}`);
      this.emit('client:disconnected', { ...clientInfo, reason });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for client ${socket.id}:`, error);
      this.emit('client:error', { clientInfo, error });
    });

    // Update rooms when client joins/leaves
    socket.on('join-room', (_room: string) => {
      const client = this.clients.get(socket.id);
      if (client) {
        client.rooms = Array.from(socket.rooms);
      }
    });

    socket.on('leave-room', (_room: string) => {
      const client = this.clients.get(socket.id);
      if (client) {
        client.rooms = Array.from(socket.rooms);
      }
    });
  }

  /**
   * Broadcast message to clients
   */
  broadcast(event: string, data: any, options: BroadcastOptions = {}): void {
    if (!this.io) {
      throw new Error('WebSocket manager not initialized');
    }

    let emitter: any = this.io;

    // Select namespace
    if (options.namespace) {
      const nsp = this.namespaces.get(options.namespace);
      if (!nsp) {
        throw new Error(`Namespace ${options.namespace} not found`);
      }
      emitter = nsp;
    }

    // Select room
    if (options.room) {
      emitter = emitter.to(options.room);
    }

    // Exclude specific clients
    if (options.except && options.except.length > 0) {
      options.except.forEach(clientId => {
        emitter = emitter.except(clientId);
      });
    }

    // Apply options
    if (options.volatile) {
      emitter = emitter.volatile;
    }
    if (options.compress) {
      emitter = emitter.compress(true);
    }

    emitter.emit(event, data);
    logger.debug(`Broadcast event ${event} to ${options.namespace || '/'} namespace`);
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, event: string, data: any): boolean {
    if (!this.io) {
      throw new Error('WebSocket manager not initialized');
    }

    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn(`Client ${clientId} not found`);
      return false;
    }

    const nsp = client.namespace === '/' ? this.io : this.namespaces.get(client.namespace);
    if (nsp) {
      nsp.to(clientId).emit(event, data);
      return true;
    }

    return false;
  }

  /**
   * Get connected clients
   */
  getConnectedClients(namespace?: string): ClientInfo[] {
    const clients = Array.from(this.clients.values());
    
    if (namespace) {
      return clients.filter(client => client.namespace === namespace);
    }
    
    return clients;
  }

  /**
   * Get clients in a specific room
   */
  async getClientsInRoom(room: string, namespace: string = '/'): Promise<string[]> {
    if (!this.io) {
      throw new Error('WebSocket manager not initialized');
    }

    const nsp = namespace === '/' ? this.io : this.namespaces.get(namespace);
    if (!nsp) {
      return [];
    }

    const sockets = await nsp.in(room).fetchSockets();
    return sockets.map(socket => socket.id);
  }

  /**
   * Disconnect a specific client
   */
  disconnectClient(clientId: string, close: boolean = false): boolean {
    if (!this.io) {
      throw new Error('WebSocket manager not initialized');
    }

    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    const nsp = client.namespace === '/' ? this.io.sockets : this.namespaces.get(client.namespace);
    if (nsp && nsp.sockets) {
      const socket = nsp.sockets.get(clientId);
      if (socket) {
        socket.disconnect(close);
        return true;
      }
    }

    return false;
  }

  /**
   * Get namespace
   */
  getNamespace(name: string): Namespace | undefined {
    return this.namespaces.get(name);
  }

  /**
   * Get Socket.io server instance
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalClients: number;
    namespaces: Array<{ name: string; clients: number }>;
    uptime: number;
  } {
    const namespaceStats = Array.from(this.namespaces.entries()).map(([name, nsp]) => ({
      name,
      clients: nsp.sockets.size
    }));

    // Add default namespace
    if (this.io) {
      namespaceStats.unshift({
        name: '/',
        clients: this.io.sockets.sockets.size
      });
    }

    return {
      totalClients: this.clients.size,
      namespaces: namespaceStats,
      uptime: process.uptime()
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket manager');

    // Disconnect all clients
    if (this.io) {
      this.io.disconnectSockets(true);
      this.io.close();
    }

    // Close Redis connections
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    if (this.redisSubClient) {
      await this.redisSubClient.quit();
    }

    // Clear internal state
    this.clients.clear();
    this.namespaces.clear();
    this.io = null;
    this.isInitialized = false;

    logger.info('WebSocket manager shut down successfully');
    this.emit('shutdown');
  }
}

// Singleton instance
let instance: WebSocketManager | null = null;

/**
 * Get or create WebSocket manager instance
 */
export function getWebSocketManager(options?: WebSocketManagerOptions): WebSocketManager {
  if (!instance) {
    instance = new WebSocketManager(options);
  }
  return instance;
}

/**
 * Create WebSocket handlers helper
 */
export function createWebSocketHandlers<T extends Record<string, any>>(
  handlers: T
): Record<keyof T, (socket: Socket, ...args: any[]) => void> {
  return handlers as any;
}

