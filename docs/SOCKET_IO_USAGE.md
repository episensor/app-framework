# Socket.IO Usage Guide

The framework provides `StandardServer` which includes Express and HTTP server setup. Apps typically implement their own Socket.IO logic for real-time communication rather than using a generic WebSocket manager.

## Basic Setup

### 1. Server-Side Implementation

```typescript
// src/server/websocket.ts
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createLogger } from '@episensor/app-framework';

const logger = createLogger('WebSocket');

export function initializeWebSocket(httpServer: any): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? false 
        : ['http://localhost:5173', 'tauri://localhost'],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Handle app-specific events
    socket.on('subscribe', (channel: string) => {
      socket.join(channel);
      logger.debug(`Client ${socket.id} subscribed to ${channel}`);
    });

    socket.on('unsubscribe', (channel: string) => {
      socket.leave(channel);
      logger.debug(`Client ${socket.id} unsubscribed from ${channel}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Helper function to emit to specific channels
export function emitToChannel(io: SocketIOServer, channel: string, event: string, data: any) {
  io.to(channel).emit(event, data);
}
```

### 2. Integration with StandardServer

```typescript
// src/server/index.ts
import { StandardServer } from '@episensor/app-framework';
import { initializeWebSocket } from './websocket';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer;

const server = new StandardServer({
  appName: 'my-app',
  appVersion: '1.0.0',
  port: 8080,
  onInitialize: async (app) => {
    // Your Express routes here
  },
  onReady: async (httpServer) => {
    // Initialize Socket.IO after server is ready
    io = initializeWebSocket(httpServer);
    logger.info('WebSocket server initialized');
  }
});

// Export for use in other modules
export function getSocketServer(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO server not initialized');
  }
  return io;
}

server.start();
```

### 3. Client-Side Implementation

```typescript
// web/src/contexts/SocketContext.tsx
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = React.useState(false);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:8080', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
```

### 4. Using Socket.IO in Components

```typescript
// web/src/components/LiveData.tsx
import React, { useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export function LiveData() {
  const { socket, connected } = useSocket();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!socket || !connected) return;

    // Subscribe to data channel
    socket.emit('subscribe', 'live-data');

    // Listen for data updates
    socket.on('data-update', (newData) => {
      setData(prev => [...prev, newData]);
    });

    return () => {
      socket.emit('unsubscribe', 'live-data');
      socket.off('data-update');
    };
  }, [socket, connected]);

  return (
    <div>
      <h2>Live Data Stream</h2>
      {connected ? (
        <div>{/* Render your data */}</div>
      ) : (
        <p>Connecting to server...</p>
      )}
    </div>
  );
}
```

## Common Patterns

### Authentication with Socket.IO

```typescript
// Server-side middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  
  try {
    // Validate token
    const user = await validateToken(token);
    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

// Client-side
const socket = io(url, {
  auth: {
    token: localStorage.getItem('authToken')
  }
});
```

### Room-Based Broadcasting

```typescript
// Join user to their organization room
socket.on('authenticate', async (data) => {
  const user = socket.data.user;
  socket.join(`org:${user.organizationId}`);
  
  // Broadcast to all users in the organization
  io.to(`org:${user.organizationId}`).emit('user-joined', {
    userId: user.id,
    name: user.name
  });
});
```

### Error Handling

```typescript
// Server-side error handling
socket.on('error', (error) => {
  logger.error('Socket error:', error);
  socket.emit('error', {
    message: 'An error occurred',
    code: error.code || 'UNKNOWN_ERROR'
  });
});

// Client-side error handling
socket.on('error', (error) => {
  console.error('Socket error:', error);
  // Show user-friendly error message
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Handle reconnection logic
});
```

## Best Practices

1. **Use Namespaces for Different Features**
   ```typescript
   const adminNamespace = io.of('/admin');
   const userNamespace = io.of('/user');
   ```

2. **Implement Heartbeat for Connection Health**
   ```typescript
   // Server
   setInterval(() => {
     io.emit('ping');
   }, 30000);
   
   // Client
   socket.on('ping', () => {
     socket.emit('pong');
   });
   ```

3. **Handle Reconnection Gracefully**
   ```typescript
   socket.on('reconnect', (attemptNumber) => {
     console.log('Reconnected after', attemptNumber, 'attempts');
     // Re-subscribe to channels
     // Fetch missed data
   });
   ```

4. **Clean Up on Disconnect**
   ```typescript
   socket.on('disconnect', () => {
     // Clean up subscriptions
     // Clear temporary data
     // Update UI state
   });
   ```

5. **Use TypeScript for Events**
   ```typescript
   interface ServerToClientEvents {
     'data-update': (data: DataType) => void;
     'user-joined': (user: UserType) => void;
   }
   
   interface ClientToServerEvents {
     subscribe: (channel: string) => void;
     unsubscribe: (channel: string) => void;
   }
   ```

## Example: Real-Time Notifications

```typescript
// Server
interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
}

export function sendNotification(io: SocketIOServer, userId: string, notification: Notification) {
  io.to(`user:${userId}`).emit('notification', notification);
}

// Client hook
export function useNotifications() {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('notification', (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      
      // Show toast or alert
      toast({
        title: notification.type,
        description: notification.message
      });
    });

    return () => {
      socket.off('notification');
    };
  }, [socket]);

  return notifications;
}
```

This pattern allows each app to implement its own specific real-time requirements while leveraging the framework's server infrastructure.
