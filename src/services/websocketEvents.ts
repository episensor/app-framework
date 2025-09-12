/**
 * WebSocket Event System
 * Standardized event patterns for real-time communication
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import { createLogger } from "../core/index.js";

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger("WebSocketEvents");
  }
  return logger;
}

/**
 * Standard event types
 */
export enum EventTypes {
  // Connection events
  CONNECT = "connect",
  DISCONNECT = "disconnect",
  ERROR = "error",

  // Data events
  DATA_UPDATE = "data:update",
  DATA_CREATE = "data:create",
  DATA_DELETE = "data:delete",
  DATA_SYNC = "data:sync",

  // Status events
  STATUS_CHANGE = "status:change",
  STATUS_HEALTH = "status:health",
  STATUS_METRICS = "status:metrics",

  // Control events
  CONTROL_START = "control:start",
  CONTROL_STOP = "control:stop",
  CONTROL_RESTART = "control:restart",
  CONTROL_CONFIG = "control:config",

  // Subscription events
  SUBSCRIBE = "subscribe",
  UNSUBSCRIBE = "unsubscribe",

  // System events
  SYSTEM_PING = "system:ping",
  SYSTEM_PONG = "system:pong",
  SYSTEM_INFO = "system:info",
  SYSTEM_ALERT = "system:alert",
}

/**
 * Standard event payload structure
 */
export interface EventPayload<T = any> {
  id?: string;
  timestamp: string;
  type: string;
  source?: string;
  target?: string;
  data: T;
  metadata?: Record<string, any>;
}

/**
 * Event response structure
 */
export interface EventResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * WebSocket Event Manager
 */
export class WebSocketEventManager {
  private io: SocketIOServer;
  private subscriptions: Map<string, Set<string>> = new Map();
  private eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupDefaultHandlers();
  }

  /**
   * Setup default event handlers
   */
  private setupDefaultHandlers(): void {
    this.io.on("connection", (socket: Socket) => {
      ensureLogger().info(`Client connected: ${socket.id}`);

      // Handle ping/pong for keepalive
      socket.on(EventTypes.SYSTEM_PING, () => {
        socket.emit(EventTypes.SYSTEM_PONG, {
          timestamp: new Date().toISOString(),
          latency: 0,
        });
      });

      // Handle subscriptions
      socket.on(EventTypes.SUBSCRIBE, (channel: string) => {
        this.subscribe(socket, channel);
      });

      socket.on(EventTypes.UNSUBSCRIBE, (channel: string) => {
        this.unsubscribe(socket, channel);
      });

      // Handle disconnect
      socket.on(EventTypes.DISCONNECT, () => {
        ensureLogger().info(`Client disconnected: ${socket.id}`);
        this.cleanupSubscriptions(socket.id);
      });

      // Send initial connection info
      socket.emit(EventTypes.SYSTEM_INFO, {
        id: socket.id,
        timestamp: new Date().toISOString(),
        server: "framework-websocket",
        version: "1.0.0",
      });
    });
  }

  /**
   * Subscribe socket to a channel
   */
  subscribe(socket: Socket, channel: string): void {
    socket.join(channel);

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel)!.add(socket.id);

    ensureLogger().debug(`Socket ${socket.id} subscribed to ${channel}`);

    socket.emit(EventTypes.SUBSCRIBE, {
      success: true,
      channel,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Unsubscribe socket from a channel
   */
  unsubscribe(socket: Socket, channel: string): void {
    socket.leave(channel);

    const subs = this.subscriptions.get(channel);
    if (subs) {
      subs.delete(socket.id);
      if (subs.size === 0) {
        this.subscriptions.delete(channel);
      }
    }

    ensureLogger().debug(`Socket ${socket.id} unsubscribed from ${channel}`);

    socket.emit(EventTypes.UNSUBSCRIBE, {
      success: true,
      channel,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Clean up all subscriptions for a socket
   */
  private cleanupSubscriptions(socketId: string): void {
    for (const [channel, subs] of this.subscriptions.entries()) {
      if (subs.has(socketId)) {
        subs.delete(socketId);
        if (subs.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    }
  }

  /**
   * Emit event to all clients
   */
  broadcast<T>(event: string, payload: EventPayload<T>): void {
    this.io.emit(event, payload);
    ensureLogger().debug(`Broadcast event: ${event}`);
  }

  /**
   * Emit event to specific room/channel
   */
  emit<T>(channel: string, event: string, payload: EventPayload<T>): void {
    this.io.to(channel).emit(event, payload);
    ensureLogger().debug(`Emit to ${channel}: ${event}`);
  }

  /**
   * Send event to specific socket
   */
  send<T>(socketId: string, event: string, payload: EventPayload<T>): void {
    this.io.to(socketId).emit(event, payload);
    ensureLogger().debug(`Send to ${socketId}: ${event}`);
  }

  /**
   * Register custom event handler
   */
  on(event: string, handler: (socket: Socket, data: any) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());

      // Register with socket.io
      this.io.on("connection", (socket: Socket) => {
        socket.on(event, (data: any) => {
          const handlers = this.eventHandlers.get(event);
          if (handlers) {
            handlers.forEach((h) => h(socket, data));
          }
        });
      });
    }

    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Get subscription statistics
   */
  getStats(): {
    connections: number;
    channels: number;
    subscriptions: Record<string, number>;
  } {
    const stats = {
      connections: this.io.sockets.sockets.size,
      channels: this.subscriptions.size,
      subscriptions: {} as Record<string, number>,
    };

    for (const [channel, subs] of this.subscriptions.entries()) {
      stats.subscriptions[channel] = subs.size;
    }

    return stats;
  }
}

/**
 * Typed event emitter for specific domains
 */
export class TypedEventEmitter<T extends Record<string, any>> {
  private manager: WebSocketEventManager;
  private namespace: string;

  constructor(manager: WebSocketEventManager, namespace: string) {
    this.manager = manager;
    this.namespace = namespace;
  }

  /**
   * Emit typed event
   */
  emit<K extends keyof T>(event: K, data: T[K]): void {
    const payload: EventPayload<T[K]> = {
      timestamp: new Date().toISOString(),
      type: String(event),
      source: this.namespace,
      data,
    };

    this.manager.broadcast(`${this.namespace}:${String(event)}`, payload);
  }

  /**
   * Emit to specific channel
   */
  emitTo<K extends keyof T>(channel: string, event: K, data: T[K]): void {
    const payload: EventPayload<T[K]> = {
      timestamp: new Date().toISOString(),
      type: String(event),
      source: this.namespace,
      target: channel,
      data,
    };

    this.manager.emit(channel, `${this.namespace}:${String(event)}`, payload);
  }
}

/**
 * Create event patterns for common use cases
 */
export const EventPatterns = {
  /**
   * CRUD event pattern
   */
  crud: <T>(namespace: string) => ({
    created: (data: T) => ({
      event: `${namespace}:created`,
      payload: { timestamp: new Date().toISOString(), type: "created", data },
    }),
    updated: (data: T) => ({
      event: `${namespace}:updated`,
      payload: { timestamp: new Date().toISOString(), type: "updated", data },
    }),
    deleted: (id: string) => ({
      event: `${namespace}:deleted`,
      payload: {
        timestamp: new Date().toISOString(),
        type: "deleted",
        data: { id },
      },
    }),
    list: (data: T[]) => ({
      event: `${namespace}:list`,
      payload: { timestamp: new Date().toISOString(), type: "list", data },
    }),
  }),

  /**
   * Status event pattern
   */
  status: (namespace: string) => ({
    online: () => ({
      event: `${namespace}:online`,
      payload: {
        timestamp: new Date().toISOString(),
        type: "online",
        data: { status: "online" },
      },
    }),
    offline: () => ({
      event: `${namespace}:offline`,
      payload: {
        timestamp: new Date().toISOString(),
        type: "offline",
        data: { status: "offline" },
      },
    }),
    error: (error: string) => ({
      event: `${namespace}:error`,
      payload: {
        timestamp: new Date().toISOString(),
        type: "error",
        data: { error },
      },
    }),
    health: (health: any) => ({
      event: `${namespace}:health`,
      payload: {
        timestamp: new Date().toISOString(),
        type: "health",
        data: health,
      },
    }),
  }),

  /**
   * Data stream pattern
   */
  stream: <T>(namespace: string) => ({
    start: () => ({
      event: `${namespace}:stream:start`,
      payload: {
        timestamp: new Date().toISOString(),
        type: "stream:start",
        data: {},
      },
    }),
    data: (data: T) => ({
      event: `${namespace}:stream:data`,
      payload: {
        timestamp: new Date().toISOString(),
        type: "stream:data",
        data,
      },
    }),
    end: () => ({
      event: `${namespace}:stream:end`,
      payload: {
        timestamp: new Date().toISOString(),
        type: "stream:end",
        data: {},
      },
    }),
    error: (error: string) => ({
      event: `${namespace}:stream:error`,
      payload: {
        timestamp: new Date().toISOString(),
        type: "stream:error",
        data: { error },
      },
    }),
  }),
};

export default {
  WebSocketEventManager,
  TypedEventEmitter,
  EventTypes,
  EventPatterns,
};
