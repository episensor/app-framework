/**
 * WebSocket Server Implementation
 * Provides real-time updates for simulator data and events
 */

import { Server, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createLogger } from '../core/index.js';
import {
  WebSocketMessage,
  SimulatorUpdateMessage,
  TemplateUpdateMessage,
  DataUpdateMessage,
  Simulator,
  Template
} from '../types/index.js';

let logger: any; // Will be initialized when needed

interface ClientInfo {
  id: string;
  connectedAt: Date;
  subscriptions: Set<string>;
}

interface BroadcastData {
  simulatorId?: string;
  templateId?: string;
  [key: string]: any;
}

class WebSocketServer {
  private io: Server | null = null;
  private httpServer: HTTPServer;
  private clients: Map<string, ClientInfo>;
  private simulatorSubscriptions: Map<string, Set<string>>; // simulatorId -> Set of socket IDs

  constructor(httpServer: HTTPServer) {
    // Initialize logger if not already done
    if (!logger) {
      logger = createLogger('WebSocket');
    }
    
    this.httpServer = httpServer;
    this.clients = new Map();
    this.simulatorSubscriptions = new Map();
  }

  initialize(): void {
    this.io = new Server(this.httpServer, {
      cors: {
        origin: "*", // Allow all origins for local development
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    logger.info('WebSocket server initialized');
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      // Only log in debug mode to avoid spam
      if (process.env.LOG_LEVEL?.toLowerCase() === 'debug') {
        logger.debug(`Client connected: ${socket.id}`);
      }
      this.clients.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        subscriptions: new Set()
      });

      // Send initial connection confirmation
      socket.emit('connected', { 
        id: socket.id,
        timestamp: Date.now()
      });

      // Handle simulator subscriptions
      socket.on('subscribe:simulator', (simulatorId: string) => {
        this.subscribeToSimulator(socket, simulatorId);
      });

      socket.on('unsubscribe:simulator', (simulatorId: string) => {
        this.unsubscribeFromSimulator(socket, simulatorId);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        // Only log in debug mode to avoid spam
        if (process.env.LOG_LEVEL?.toLowerCase() === 'debug') {
          logger.debug(`Client disconnected: ${socket.id}`);
        }
        this.handleDisconnect(socket);
      });

      // Handle errors
      socket.on('error', (_error: Error) => {
        logger.error(`Socket error for ${socket.id}:`, _error);
      });
    });
  }

  private subscribeToSimulator(socket: Socket, simulatorId: string): void {
    const client = this.clients.get(socket.id);
    if (!client) return;

    // Add to client's subscriptions
    client.subscriptions.add(simulatorId);

    // Add to simulator's subscriber list
    if (!this.simulatorSubscriptions.has(simulatorId)) {
      this.simulatorSubscriptions.set(simulatorId, new Set());
    }
    const subscribers = this.simulatorSubscriptions.get(simulatorId);
    if (subscribers) {
      subscribers.add(socket.id);
    }

    // Join socket.io room for efficient broadcasting
    socket.join(`simulator:${simulatorId}`);

    logger.debug(`Client ${socket.id} subscribed to simulator ${simulatorId}`);
  }

  private unsubscribeFromSimulator(socket: Socket, simulatorId: string): void {
    const client = this.clients.get(socket.id);
    if (!client) return;

    // Remove from client's subscriptions
    client.subscriptions.delete(simulatorId);

    // Remove from simulator's subscriber list
    const subscribers = this.simulatorSubscriptions.get(simulatorId);
    if (subscribers) {
      subscribers.delete(socket.id);
      if (subscribers.size === 0) {
        this.simulatorSubscriptions.delete(simulatorId);
      }
    }

    // Leave socket.io room
    socket.leave(`simulator:${simulatorId}`);

    logger.debug(`Client ${socket.id} unsubscribed from simulator ${simulatorId}`);
  }

  private handleDisconnect(socket: Socket): void {
    const client = this.clients.get(socket.id);
    if (!client) return;

    // Clean up all subscriptions
    client.subscriptions.forEach(simulatorId => {
      const subscribers = this.simulatorSubscriptions.get(simulatorId);
      if (subscribers) {
        subscribers.delete(socket.id);
        if (subscribers.size === 0) {
          this.simulatorSubscriptions.delete(simulatorId);
        }
      }
    });

    // Remove client
    this.clients.delete(socket.id);
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcast(event: string, data: BroadcastData): void {
    if (!this.io) return;

    // Create typed message based on event
    let message: WebSocketMessage;
    // Timestamp removed - not needed in simplified message structure

    switch (event) {
      case 'simulator:started':
      case 'simulator:stopped':
      case 'simulator:update':
        message = {
          type: event as 'simulator:started' | 'simulator:stopped' | 'simulator:data',
          data: data as Simulator
        } as SimulatorUpdateMessage;
        break;

      case 'template:created':
      case 'template:updated':
      case 'template:deleted':
        message = {
          type: event as 'template:created' | 'template:updated' | 'template:deleted',
          data: data as Template
        } as TemplateUpdateMessage;
        break;

      case 'simulator:data':
        message = {
          type: 'data:update',
          data: {
            simulatorId: data.simulatorId!,
            values: data.values || { [data.address]: data.value }
          }
        } as DataUpdateMessage;
        break;

      default:
        message = {
          type: event,
          data: data
        } as WebSocketMessage;
    }

    // Broadcast to all clients
    this.io.emit(event, message.data);

    // If simulator-specific, also send to room
    if (data.simulatorId) {
      this.io.to(`simulator:${data.simulatorId}`).emit(event, message.data);
    }

    logger.debug(`Broadcast ${event} to ${this.clients.size} clients`);
  }

  /**
   * Send event to specific simulator subscribers
   */
  broadcastToSimulator(simulatorId: string, event: string, data: any): void {
    if (!this.io) return;

    const message: DataUpdateMessage = {
      type: 'data:update',
      data: {
        simulatorId,
        values: data
      }
    };

    this.io.to(`simulator:${simulatorId}`).emit(event, message.data);

    const subscriberCount = this.simulatorSubscriptions.get(simulatorId)?.size || 0;
    logger.debug(`Broadcast ${event} to ${subscriberCount} subscribers of simulator ${simulatorId}`);
  }

  /**
   * Get statistics about connected clients
   */
  getStats(): {
    totalClients: number;
    totalSubscriptions: number;
    simulatorSubscriptions: Record<string, number>;
  } {
    const stats = {
      totalClients: this.clients.size,
      totalSubscriptions: 0,
      simulatorSubscriptions: {} as Record<string, number>
    };

    // Count total subscriptions
    this.clients.forEach(client => {
      stats.totalSubscriptions += client.subscriptions.size;
    });

    // Count per-simulator subscriptions
    this.simulatorSubscriptions.forEach((subscribers, simulatorId) => {
      stats.simulatorSubscriptions[simulatorId] = subscribers.size;
    });

    return stats;
  }

  /**
   * Get list of connected clients
   */
  getClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.io !== null;
  }

  /**
   * Shutdown the WebSocket server
   */
  async shutdown(): Promise<void> {
    if (this.io) {
      // Disconnect all clients
      this.io.disconnectSockets();
      
      // Close the server
      await new Promise<void>((resolve) => {
        this.io!.close(() => {
          logger.info('WebSocket server shut down');
          resolve();
        });
      });
      
      this.io = null;
    }
    
    // Clear all data
    this.clients.clear();
    this.simulatorSubscriptions.clear();
  }
}

// Singleton instance
let wsServer: WebSocketServer | null = null;

/**
 * Create WebSocket server instance
 */
export function createWebSocketServer(httpServer: HTTPServer): WebSocketServer {
  // Initialize logger if not already done
  if (!logger) {
    logger = createLogger('WebSocket');
  }
  
  if (!wsServer) {
    wsServer = new WebSocketServer(httpServer);
    wsServer.initialize();
  }
  return wsServer;
}

/**
 * Get existing WebSocket server instance
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wsServer;
}

/**
 * Export the class for type usage
 */
export { WebSocketServer };
export type { ClientInfo, BroadcastData };
