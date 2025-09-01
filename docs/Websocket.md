# WebSocket Implementation Guide

## Overview

The EpiSensor App Framework provides a comprehensive WebSocket implementation built on Socket.IO for real-time bidirectional communication between server and clients. This enables live data streaming, instant updates, and responsive user interfaces.

## Table of Contents

1. [Core Features](#core-features)
2. [Server Setup](#server-setup)
3. [Client Integration](#client-integration)
4. [Event System](#event-system)
5. [Subscription Management](#subscription-management)
6. [React Integration](#react-integration)
7. [Performance & Scaling](#performance--scaling)
8. [Security Considerations](#security-considerations)
9. [Debugging & Monitoring](#debugging--monitoring)
10. [Complete Examples](#complete-examples)

## Core Features

- **Automatic Connection Management**: Handles reconnection with exponential backoff
- **Subscription-Based Architecture**: Clients subscribe to specific data streams
- **Client Tracking**: Monitor connected clients and their subscriptions
- **Typed Events**: Type-safe event system with predefined patterns
- **React Hooks**: Ready-to-use React hooks for WebSocket integration
- **Connection Status**: Built-in connection status monitoring
- **Statistics & Monitoring**: Real-time connection and message statistics

## Server Setup

### Basic Initialization

```typescript
import { StandardServer, createWebSocketServer } from '@episensor/app-framework';

const server = new StandardServer({
  appName: 'My App',
  appVersion: '1.0.0',
  port: 8080,
  enableWebSocket: true, // Enables WebSocket automatically
  onInitialize: async (app) => {
    // Your Express middleware and routes
  }
});

await server.initialize();
await server.start();
```

### Manual WebSocket Setup

```typescript
import { createWebSocketServer, getWebSocketServer } from '@episensor/app-framework';
import { createServer } from 'http';

const httpServer = createServer(app);
const wsServer = createWebSocketServer(httpServer);

// Access the WebSocket server instance
const ws = getWebSocketServer();
```

### Server Configuration

```typescript
const wsServer = createWebSocketServer(httpServer, {
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});
```

## Client Integration

### Browser Client

```html
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io('http://localhost:8080', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });

  // Connection events
  socket.on('connect', () => {
    console.log('Connected to server');
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });

  // Subscribe to data streams
  socket.emit('subscribe:simulator', 'simulator-123');
  
  // Listen for updates
  socket.on('simulator:update', (data) => {
    console.log('Simulator update:', data);
  });
</script>
```

### Node.js Client

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080', {
  transports: ['websocket'],
  reconnection: true
});

socket.on('connect', () => {
  console.log('Connected with ID:', socket.id);
});
```

## Event System

### Standard Event Patterns

The framework uses consistent event naming patterns:

```typescript
// CRUD Operations
'entity:created'    // New entity created
'entity:updated'    // Entity updated
'entity:deleted'    // Entity deleted
'entity:list'       // List of entities

// Subscriptions
'subscribe:entity'   // Subscribe to entity updates
'unsubscribe:entity' // Unsubscribe from entity updates

// Real-time Data
'data:update'       // Generic data update
'metrics:update'    // Metrics/statistics update
'status:change'     // Status change notification
```

### Broadcasting Events

```typescript
import { getWebSocketServer } from '@episensor/app-framework';

const ws = getWebSocketServer();

// Broadcast to all connected clients
ws.broadcast('system:announcement', {
  message: 'System maintenance in 5 minutes',
  timestamp: new Date()
});

// Broadcast to specific simulator subscribers
ws.broadcastSimulatorUpdate('simulator-123', {
  status: 'running',
  metrics: { temperature: 25.5, pressure: 1013 }
});

// Broadcast to specific template subscribers
ws.broadcastTemplateUpdate('template-456', {
  name: 'Updated Template',
  fields: [...]
});

// Generic data broadcast
ws.broadcastDataUpdate('sensors', {
  sensorId: 'sensor-789',
  value: 42.0
});
```

### Typed Events

```typescript
import { WebSocketEventManager, TypedEventEmitter } from '@episensor/app-framework';

// Define your event types
interface AppEvents {
  'sensor:reading': { id: string; value: number; timestamp: Date };
  'alert:triggered': { level: 'info' | 'warning' | 'error'; message: string };
  'user:action': { userId: string; action: string; metadata?: any };
}

// Create typed event emitter
const events = new TypedEventEmitter<AppEvents>();

// Type-safe event handling
events.on('sensor:reading', (data) => {
  // TypeScript knows data has id, value, timestamp
  console.log(`Sensor ${data.id}: ${data.value}`);
});

// Emit typed events
events.emit('sensor:reading', {
  id: 'temp-001',
  value: 23.5,
  timestamp: new Date()
});
```

## Subscription Management

### Server-Side Subscription Handling

```typescript
import { getWebSocketServer } from '@episensor/app-framework';

const ws = getWebSocketServer();

// The framework automatically handles these subscription events:
// - 'subscribe:simulator'
// - 'unsubscribe:simulator'

// Custom subscription handling
ws.io.on('connection', (socket) => {
  socket.on('subscribe:custom', (entityId: string) => {
    // Join a room for this entity
    socket.join(`entity:${entityId}`);
    
    // Track subscription
    const client = ws.clients.get(socket.id);
    if (client) {
      client.subscriptions.add(`entity:${entityId}`);
    }
    
    // Send initial data
    socket.emit('custom:initial', getEntityData(entityId));
  });
  
  socket.on('unsubscribe:custom', (entityId: string) => {
    // Leave the room
    socket.leave(`entity:${entityId}`);
    
    // Remove subscription tracking
    const client = ws.clients.get(socket.id);
    if (client) {
      client.subscriptions.delete(`entity:${entityId}`);
    }
  });
});

// Broadcast to subscribers
ws.io.to('entity:123').emit('custom:update', data);
```

### Client-Side Subscription

```typescript
class SubscriptionManager {
  private socket: Socket;
  private subscriptions = new Set<string>();
  
  constructor(socket: Socket) {
    this.socket = socket;
    
    // Re-subscribe on reconnection
    this.socket.on('connect', () => {
      this.subscriptions.forEach(id => {
        this.subscribe(id);
      });
    });
  }
  
  subscribe(entityId: string) {
    this.subscriptions.add(entityId);
    this.socket.emit('subscribe:entity', entityId);
  }
  
  unsubscribe(entityId: string) {
    this.subscriptions.delete(entityId);
    this.socket.emit('unsubscribe:entity', entityId);
  }
  
  unsubscribeAll() {
    this.subscriptions.forEach(id => this.unsubscribe(id));
  }
}
```

## React Integration

### useWebSocket Hook

```tsx
import { useWebSocket } from '@episensor/ui-framework';

function MyComponent() {
  const { 
    connected, 
    socket, 
    subscribe, 
    unsubscribe,
    emit,
    on,
    off 
  } = useWebSocket('http://localhost:8080');
  
  useEffect(() => {
    if (connected) {
      // Subscribe to updates
      subscribe('simulator', 'sim-123');
      
      // Listen for events
      const handler = (data) => console.log('Update:', data);
      on('simulator:update', handler);
      
      return () => {
        off('simulator:update', handler);
        unsubscribe('simulator', 'sim-123');
      };
    }
  }, [connected]);
  
  return (
    <div>
      Status: {connected ? 'Connected' : 'Disconnected'}
    </div>
  );
}
```

### useWebSocketSubscription Hook

```tsx
import { useWebSocketSubscription } from '@episensor/ui-framework';

function SimulatorDisplay({ simulatorId }) {
  const { data, loading, error } = useWebSocketSubscription(
    'simulator',
    simulatorId,
    {
      initialData: { status: 'unknown' },
      transform: (raw) => ({
        ...raw,
        timestamp: new Date(raw.timestamp)
      })
    }
  );
  
  if (loading) return <div>Connecting...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h3>Simulator Status: {data.status}</h3>
      <p>Last Update: {data.timestamp?.toLocaleString()}</p>
    </div>
  );
}
```

### Connection Status Component

```tsx
import { ConnectionStatus } from '@episensor/ui-framework';

function Header() {
  return (
    <header>
      <h1>My App</h1>
      <ConnectionStatus 
        url="http://localhost:8080"
        showDetails={true}
        onReconnect={() => console.log('Manual reconnect')}
      />
    </header>
  );
}
```

## Performance & Scaling

### Connection Management

```typescript
// Get connection statistics
const ws = getWebSocketServer();
const stats = ws.getStats();
console.log(`Connected clients: ${stats.connectedClients}`);
console.log(`Total subscriptions: ${stats.totalSubscriptions}`);

// Get detailed client information
const clients = ws.getClients();
clients.forEach((client, socketId) => {
  console.log(`Client ${socketId}:`);
  console.log(`  Connected at: ${client.connectedAt}`);
  console.log(`  Subscriptions: ${Array.from(client.subscriptions)}`);
});
```

### Optimizing for Scale

```typescript
// 1. Use rooms for efficient broadcasting
ws.io.to('room-name').emit('event', data); // Only to specific room

// 2. Implement rate limiting
const rateLimiter = new Map();
socket.on('data:request', (payload) => {
  const lastRequest = rateLimiter.get(socket.id);
  if (lastRequest && Date.now() - lastRequest < 100) {
    return; // Ignore if too frequent
  }
  rateLimiter.set(socket.id, Date.now());
  // Process request
});

// 3. Batch updates
const updateQueue = [];
setInterval(() => {
  if (updateQueue.length > 0) {
    ws.broadcast('batch:update', updateQueue);
    updateQueue.length = 0;
  }
}, 100); // Send batched updates every 100ms

// 4. Implement pagination for large data sets
socket.on('data:list', ({ page = 1, limit = 100 }) => {
  const data = getData(page, limit);
  socket.emit('data:list:response', {
    items: data,
    page,
    total: getTotalCount(),
    hasMore: page * limit < getTotalCount()
  });
});
```

### Memory Management

```typescript
// Clean up on disconnect
ws.io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    // Clean up any socket-specific data
    cleanupClientData(socket.id);
    rateLimiter.delete(socket.id);
  });
});

// Periodic cleanup
setInterval(() => {
  // Clean up old data
  ws.clients.forEach((client, socketId) => {
    const socket = ws.io.sockets.sockets.get(socketId);
    if (!socket || !socket.connected) {
      ws.clients.delete(socketId);
    }
  });
}, 60000); // Every minute
```

## Security Considerations

### Authentication

```typescript
// Server-side authentication
ws.io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    const user = await verifyToken(token);
    socket.data.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

// Client-side authentication
const socket = io('http://localhost:8080', {
  auth: {
    token: localStorage.getItem('auth_token')
  }
});
```

### Authorization

```typescript
// Check permissions before allowing subscriptions
socket.on('subscribe:sensitive', async (resourceId) => {
  const user = socket.data.user;
  if (!await canAccessResource(user, resourceId)) {
    socket.emit('error', { message: 'Access denied' });
    return;
  }
  
  socket.join(`sensitive:${resourceId}`);
});
```

### Input Validation

```typescript
import { z } from 'zod';

// Define schemas for events
const subscribeSchema = z.object({
  entityId: z.string().uuid(),
  options: z.object({
    includeHistory: z.boolean().optional()
  }).optional()
});

socket.on('subscribe:entity', (data) => {
  try {
    const validated = subscribeSchema.parse(data);
    // Process validated data
  } catch (error) {
    socket.emit('error', { message: 'Invalid subscription data' });
  }
});
```

## Debugging & Monitoring

### Enable Debug Logging

```bash
# Set environment variable
LOG_LEVEL=debug npm start
```

### Client-Side Debugging

```typescript
// Enable Socket.IO debug mode
localStorage.debug = 'socket.io-client:*';

// Custom debug logging
socket.on('connect', () => {
  console.log('[WS] Connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[WS] Disconnected:', reason);
});

socket.onAny((eventName, ...args) => {
  console.log('[WS] Event:', eventName, args);
});
```

### Server-Side Monitoring

```typescript
// Log all events
ws.io.on('connection', (socket) => {
  socket.onAny((eventName, ...args) => {
    logger.debug(`[${socket.id}] ${eventName}`, args);
  });
});

// Monitor performance
setInterval(() => {
  const stats = ws.getStats();
  logger.info('WebSocket Statistics', {
    clients: stats.connectedClients,
    subscriptions: stats.totalSubscriptions,
    messagesPerSecond: calculateMessageRate()
  });
}, 30000); // Every 30 seconds
```

## Complete Examples

### Real-Time Dashboard

```typescript
// Server
import { StandardServer, getWebSocketServer } from '@episensor/app-framework';

const server = new StandardServer({
  appName: 'Real-Time Dashboard',
  appVersion: '1.0.0',
  port: 8080,
  enableWebSocket: true,
  onInitialize: async (app) => {
    // API routes
    app.get('/api/metrics', async (req, res) => {
      res.json(await getMetrics());
    });
  }
});

await server.initialize();
await server.start();

// Stream metrics every second
const ws = getWebSocketServer();
setInterval(async () => {
  const metrics = await getMetrics();
  ws.broadcast('metrics:update', metrics);
}, 1000);
```

```tsx
// Client (React)
import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@episensor/ui-framework';
import { LineChart, Line, XAxis, YAxis } from 'recharts';

function Dashboard() {
  const [metrics, setMetrics] = useState([]);
  const { connected, on, off } = useWebSocket('http://localhost:8080');
  
  useEffect(() => {
    if (connected) {
      const handler = (data) => {
        setMetrics(prev => [...prev.slice(-59), {
          ...data,
          timestamp: new Date().toLocaleTimeString()
        }]);
      };
      
      on('metrics:update', handler);
      return () => off('metrics:update', handler);
    }
  }, [connected, on, off]);
  
  return (
    <div>
      <h1>Real-Time Metrics</h1>
      <LineChart width={800} height={400} data={metrics}>
        <XAxis dataKey="timestamp" />
        <YAxis />
        <Line type="monotone" dataKey="cpu" stroke="#8884d8" />
        <Line type="monotone" dataKey="memory" stroke="#82ca9d" />
      </LineChart>
    </div>
  );
}
```

### Chat Application

```typescript
// Server
ws.io.on('connection', (socket) => {
  // Join user to their rooms
  socket.on('join:room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user:joined', {
      userId: socket.data.user.id,
      username: socket.data.user.name
    });
  });
  
  // Handle messages
  socket.on('message:send', ({ roomId, message }) => {
    const messageData = {
      id: generateId(),
      userId: socket.data.user.id,
      username: socket.data.user.name,
      message,
      timestamp: new Date()
    };
    
    // Save to database
    saveMessage(messageData);
    
    // Broadcast to room
    ws.io.to(roomId).emit('message:received', messageData);
  });
  
  // Handle typing indicators
  socket.on('typing:start', ({ roomId }) => {
    socket.to(roomId).emit('user:typing', {
      userId: socket.data.user.id,
      username: socket.data.user.name
    });
  });
  
  socket.on('typing:stop', ({ roomId }) => {
    socket.to(roomId).emit('user:stopped-typing', {
      userId: socket.data.user.id
    });
  });
});
```

### IoT Device Monitoring

```typescript
// Server - Device data ingestion
app.post('/api/device/:id/data', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  
  // Store in database
  await storeDeviceData(id, data);
  
  // Broadcast to subscribers
  ws.broadcastToDevice(id, {
    type: 'telemetry',
    deviceId: id,
    data,
    timestamp: new Date()
  });
  
  res.json({ success: true });
});

// Client - Real-time monitoring
function DeviceMonitor({ deviceId }) {
  const [telemetry, setTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const { subscribe, on } = useWebSocket();
  
  useEffect(() => {
    subscribe('device', deviceId);
    
    on(`device:${deviceId}:telemetry`, (data) => {
      setTelemetry(data);
      setHistory(prev => [...prev.slice(-99), data]);
    });
    
    return () => unsubscribe('device', deviceId);
  }, [deviceId]);
  
  return (
    <div>
      <h2>Device {deviceId}</h2>
      <div>Status: {telemetry?.status || 'Unknown'}</div>
      <div>Temperature: {telemetry?.temperature}°C</div>
      <div>Last Update: {telemetry?.timestamp}</div>
      <Sparkline data={history.map(h => h.temperature)} />
    </div>
  );
}
```

## Best Practices

1. **Always handle disconnections gracefully** - Clean up subscriptions and data
2. **Implement reconnection logic** - Use exponential backoff
3. **Validate all incoming data** - Never trust client input
4. **Use rooms for efficient broadcasting** - Don't broadcast to all clients unnecessarily
5. **Implement rate limiting** - Prevent abuse and DOS attacks
6. **Monitor connection health** - Track metrics and set up alerts
7. **Use compression for large payloads** - Enable Socket.IO compression
8. **Implement heartbeat/ping-pong** - Detect stale connections
9. **Handle errors gracefully** - Provide meaningful error messages
10. **Test with network throttling** - Ensure good performance on slow connections

## Troubleshooting

### Common Issues

**Connection fails immediately**
- Check CORS configuration
- Verify server is running
- Check firewall/proxy settings

**Frequent disconnections**
- Increase ping timeout
- Check network stability
- Review server logs for errors

**Messages not received**
- Verify subscription is active
- Check event names match
- Ensure client is connected

**High memory usage**
- Implement cleanup on disconnect
- Limit message history
- Use pagination for large datasets

**Poor performance**
- Batch updates
- Implement throttling
- Use binary frames for large data
- Consider horizontal scaling with Redis adapter

## Additional Resources

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [WebSocket Protocol RFC](https://datatracker.ietf.org/doc/html/rfc6455)
- [Real-time Web Technologies Guide](https://www.html5rocks.com/en/tutorials/websockets/basics/)