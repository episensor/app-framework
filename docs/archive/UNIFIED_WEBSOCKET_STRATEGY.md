# Unified WebSocket Strategy for @episensor/app-framework

## Executive Summary

After comprehensive analysis of all apps in the ecosystem, we've identified sophisticated patterns that should be standardized in the framework while preserving domain-specific innovation. The goal is to eliminate duplication while maintaining the unique capabilities each app has developed.

## Best Patterns from Each App

### 🏆 epi-vpp-manager - Energy Grid Excellence
**What it does brilliantly:**
- Real-time energy dispatch with NESO integration
- Environment switching (sandbox/production)
- Email notifications for critical events
- Graceful degradation when services unavailable

**Framework adoption:**
```typescript
// Energy-specific events wrapped around framework WebSocket
io.on('connection', (socket) => {
  socket.on('device:dispatch', async (data) => {
    await energyService.dispatch(data);
    io.to(`site:${data.siteId}`).emit('dispatch:success', result);
  });
});
```

### 🏆 epi-competitor-ai - Dual WebSocket Innovation
**What it does brilliantly:**
- Separate WebSocket for browser extension communication
- Job queue with real-time progress tracking
- Room-based subscriptions for entities
- System prerequisites checking

**Pattern to preserve:**
```typescript
// Multiple WebSocket servers for different purposes
const mainIO = standardServer.io;  // Main app WebSocket
const extensionIO = new Server();  // Browser extension WebSocket
```

### 🏆 epi-node-programmer - Manufacturing Bridge Pattern
**What it does brilliantly:**
- Domain-specific event abstraction (WebSocketAdapter)
- Manufacturing workflow events
- Session/batch management
- Clean separation of concerns

**Pattern to standardize:**
```typescript
// Bridge pattern for domain-specific events
export class DomainEventBridge {
  constructor(private io: SocketIOServer) {}

  emitManufacturingEvent(event: string, data: any) {
    // Transform domain events to WebSocket events
    this.io.emit(`manufacturing:${event}`, data);
  }
}
```

### 🏆 epi-modbus-simulator - Migration Excellence
**What it does brilliantly:**
- Backwards compatibility layer
- Clean framework integration
- Minimal custom code

### 🏆 epi-cpcodebase - Clean Architecture
**What it does brilliantly:**
- Project scanning via WebSocket
- File operation progress tracking
- Clean separation of API and WebSocket

## Unified Framework Strategy

### Core Framework Provides

#### 1. **Base WebSocket Infrastructure**
```typescript
// StandardServer automatically provides:
export interface StandardServerConfig {
  enableWebSocket: true,
  webSocketOptions?: {
    cors?: CorsOptions;
    transports?: ('websocket' | 'polling')[];
    connectionStateRecovery?: boolean;
    adapter?: any; // For Redis/cluster support
  }
}
```

#### 2. **Connection Management Hooks**
```typescript
// Framework exports these hooks:
export { useSocketIO } from './hooks/useSocketIO';
export { useConnectionStatus } from './hooks/useConnectionStatus';
export { useSocketSubscription } from './hooks/useSocketSubscription'; // NEW
export { useSocketProgress } from './hooks/useSocketProgress'; // NEW
```

#### 3. **Common Event Patterns**
```typescript
// Framework provides standard event handlers:
export class FrameworkEventPatterns {
  // Job Queue Pattern (from competitor-ai)
  setupJobQueue(io: SocketIOServer, jobQueue: JobQueue) {
    jobQueue.on('job:created', (job) => io.emit('job:created', job));
    jobQueue.on('job:progress', (data) => io.to(`job:${data.id}`).emit('job:progress', data));
    jobQueue.on('job:completed', (job) => io.to(`job:${job.id}`).emit('job:completed', job));
  }

  // Progress Tracking Pattern (from cpcodebase)
  setupProgressTracking(io: SocketIOServer) {
    return {
      startProgress: (id: string, total: number) => {
        io.to(`progress:${id}`).emit('progress:start', { id, total });
      },
      updateProgress: (id: string, current: number) => {
        io.to(`progress:${id}`).emit('progress:update', { id, current });
      },
      completeProgress: (id: string, result?: any) => {
        io.to(`progress:${id}`).emit('progress:complete', { id, result });
      }
    };
  }

  // Room Management Pattern
  setupRoomManager(io: SocketIOServer) {
    return {
      subscribeEntity: (socket: Socket, type: string, id: string) => {
        socket.join(`${type}:${id}`);
        socket.emit('subscribed', { type, id });
      },
      unsubscribeEntity: (socket: Socket, type: string, id: string) => {
        socket.leave(`${type}:${id}`);
        socket.emit('unsubscribed', { type, id });
      },
      broadcastToEntity: (type: string, id: string, event: string, data: any) => {
        io.to(`${type}:${id}`).emit(event, data);
      }
    };
  }
}
```

#### 4. **Connection Status Components**
```typescript
// Enhanced connection status with transport info
export const ConnectionStatusBanner = ({
  showTransport = true,
  showLatency = false,
  showClientCount = false
}) => {
  const { connected, connecting, transport, latency, clientCount } = useConnectionStatus();
  // ... render logic
};
```

### Apps Add Domain-Specific Logic

#### Pattern 1: Energy Management (epi-vpp-manager)
```typescript
// App adds energy-specific events
const server = new StandardServer({
  enableWebSocket: true,
  onInitialize: async (app, io) => {
    const patterns = new FrameworkEventPatterns();
    const roomManager = patterns.setupRoomManager(io);

    // Add energy-specific logic
    io.on('connection', (socket) => {
      socket.on('dispatch:request', async (data) => {
        // Domain logic here
        const result = await energyService.dispatch(data);
        roomManager.broadcastToEntity('site', data.siteId, 'dispatch:update', result);
      });
    });
  }
});
```

#### Pattern 2: Dual WebSocket (epi-competitor-ai)
```typescript
// App can create additional WebSocket servers
const server = new StandardServer({
  enableWebSocket: true,
  onInitialize: async (app, io, httpServer) => {
    // Main app WebSocket (framework)
    const patterns = new FrameworkEventPatterns();
    patterns.setupJobQueue(io, app.locals.jobQueue);

    // Additional WebSocket for browser extension
    const extensionIO = new SocketIOServer(httpServer, {
      path: '/extension-socket',
      cors: { origin: 'chrome-extension://*' }
    });

    extensionIO.on('connection', (socket) => {
      // Extension-specific events
    });
  }
});
```

#### Pattern 3: Domain Bridge (epi-node-programmer)
```typescript
// App creates domain-specific abstraction
export class ManufacturingBridge {
  constructor(private io: SocketIOServer) {
    const patterns = new FrameworkEventPatterns();
    this.progressTracker = patterns.setupProgressTracking(io);
  }

  startBatch(batchId: string, deviceCount: number) {
    this.progressTracker.startProgress(`batch:${batchId}`, deviceCount);
  }

  updateBatchProgress(batchId: string, completed: number) {
    this.progressTracker.updateProgress(`batch:${batchId}`, completed);
  }
}
```

## Migration Roadmap

### Phase 1: Framework Enhancements (Week 1)
1. **Add new hooks**:
   - `useSocketSubscription` - Subscribe to specific rooms/entities
   - `useSocketProgress` - Track long-running operations
   - `useSocketEmit` - Type-safe event emission

2. **Add event pattern utilities**:
   - `FrameworkEventPatterns` class
   - Job queue helpers
   - Progress tracking helpers
   - Room management utilities

3. **Enhance StandardServer**:
   - Support for multiple WebSocket servers
   - Better WebSocket configuration options
   - Connection state recovery

### Phase 2: App Migration (Week 2-3)

#### Priority 1: Fix Duplications
**epi-cpcodebase** - Remove custom SocketContext
```bash
# Remove duplicate WebSocket
rm web/src/contexts/SocketContext.tsx
# Update imports to use framework hooks
```

**epi-competitor-ai** - Migrate WebSocketService to framework patterns
```typescript
// OLD: Custom WebSocketService
class WebSocketService {
  constructor(server, jobQueue) { /* 245 lines */ }
}

// NEW: Use framework patterns
patterns.setupJobQueue(io, jobQueue);
```

#### Priority 2: Add Missing Features
**epi-node-programmer** - Add connection status UI
```typescript
import { ConnectionStatusBanner } from '@episensor/app-framework/ui';
// Add to UI
```

#### Priority 3: Preserve Innovation
**epi-vpp-manager** - Keep energy-specific features
**epi-competitor-ai** - Keep dual WebSocket for extension

### Phase 3: Testing & Documentation (Week 4)

## Framework API Design

### New Hooks

#### `useSocketSubscription`
```typescript
// Subscribe to entity updates
const subscription = useSocketSubscription('competitor', competitorId);
const { data, loading, error } = subscription;
```

#### `useSocketProgress`
```typescript
// Track operation progress
const progress = useSocketProgress('scan-project');
const { current, total, percentage, isComplete } = progress;
```

#### `useSocketEmit`
```typescript
// Type-safe event emission
const emit = useSocketEmit<AppEvents>();
emit('project:scan', { projectId: '123' });
```

### Server Utilities

#### Job Queue Integration
```typescript
// Standardized job queue pattern
import { createJobQueueSocket } from '@episensor/app-framework';

const jobSocket = createJobQueueSocket(io, jobQueue, {
  roomPrefix: 'job',
  events: ['created', 'updated', 'progress', 'completed', 'failed']
});
```

#### Progress Tracking
```typescript
// Standardized progress tracking
import { createProgressTracker } from '@episensor/app-framework';

const tracker = createProgressTracker(io);
await tracker.trackOperation('scan-123', async (progress) => {
  for (let i = 0; i < files.length; i++) {
    await scanFile(files[i]);
    progress.update(i + 1, files.length);
  }
});
```

## Implementation Guidelines

### DO ✅
- Use framework's `useSocketIO` and `useConnectionStatus` hooks
- Leverage `FrameworkEventPatterns` for common patterns
- Create domain-specific bridges when needed
- Use room-based subscriptions for efficiency
- Implement proper error handling and recovery

### DON'T ❌
- Create custom SocketContext components
- Duplicate WebSocket connection logic
- Bypass framework's connection management
- Implement progress tracking from scratch
- Create redundant event patterns

## Success Metrics

### Immediate Benefits
- **-50% code reduction** in WebSocket handling
- **Single connection** per app (except special cases)
- **Consistent UX** across all apps
- **Reusable patterns** for common operations

### Long-term Benefits
- **Easier maintenance** - One WebSocket system
- **Better performance** - Optimized connection handling
- **Enhanced features** - Framework improvements benefit all apps
- **Faster development** - Standard patterns ready to use

## Code Examples

### Before (Duplicate Implementation)
```typescript
// ❌ Each app reimplements WebSocket
export class CustomWebSocketService {
  private io: SocketIOServer;
  private clients: Map<string, Socket>;

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, { /* config */ });
    this.clients = new Map();
    this.setupHandlers();
  }

  // 200+ lines of duplicate logic...
}
```

### After (Framework Pattern)
```typescript
// ✅ Use framework with domain logic
const server = new StandardServer({
  enableWebSocket: true,
  onInitialize: async (app, io) => {
    const patterns = new FrameworkEventPatterns();

    // Use standard patterns
    patterns.setupJobQueue(io, app.locals.jobQueue);
    patterns.setupProgressTracking(io);

    // Add domain-specific events only
    io.on('connection', (socket) => {
      socket.on('domain:specific', handler);
    });
  }
});
```

## Special Cases

### Multiple WebSocket Servers
When needed (like competitor-ai's browser extension):
```typescript
// Framework supports additional WebSocket servers
const extensionSocket = server.createAdditionalSocket({
  path: '/extension',
  cors: { origin: 'chrome-extension://*' }
});
```

### Legacy Support
For backwards compatibility:
```typescript
// Framework provides migration helpers
import { createLegacyAdapter } from '@episensor/app-framework';

// Wrap old code during transition
const adapter = createLegacyAdapter(oldWebSocketService);
```

## Conclusion

This unified strategy:
1. **Preserves innovation** - Keeps unique features from each app
2. **Eliminates duplication** - ~500+ lines removed across apps
3. **Standardizes patterns** - Common operations become trivial
4. **Enables scaling** - Framework improvements benefit everyone
5. **Maintains flexibility** - Apps can still innovate

The key insight: **Framework handles infrastructure, apps add domain value.**