# WebSocket and Connection Status Migration Plan

## Executive Summary

Multiple apps in the ecosystem are duplicating WebSocket functionality that already exists in @episensor/app-framework. This creates:
- **Duplicate connections** - Apps creating 2+ WebSocket connections instead of 1
- **Inconsistent behavior** - Different retry logic, transport fallback, error handling
- **Maintenance burden** - ~400+ lines of duplicate code across apps
- **Poor UX** - Inconsistent connection status indicators

## Current State Analysis

### 🔴 Critical Issues
1. **epi-cpcodebase**: Custom SocketContext creating duplicate connection
2. **epi-competitor-ai**: 245-line WebSocketService completely bypassing framework
3. **epi-node-programmer**: No connection status UI components

### ✅ Good Example
- **epi-modbus-simulator**: Clean implementation using only framework WebSocket

## The Unified Approach

### Framework Provides
```typescript
// Server side - StandardServer automatically provides:
- Socket.IO server instance
- CORS configuration
- Transport fallback (websocket → polling)
- Connection management
- Room-based subscriptions

// Client side - Framework provides:
- useConnectionStatus() hook
- useSocketIO() hook
- ConnectionStatusBanner component
- ConnectionLostOverlay component
- Automatic reconnection logic
- Transport detection
```

### Apps Should Only Add
```typescript
// Server side - Custom event handlers:
onInitialize: async (app, io) => {
  if (io) {
    // Add domain-specific event handlers
    io.on('connection', (socket) => {
      socket.on('custom:event', handler);
    });
  }
}

// Client side - Use framework hooks:
const { socket } = useSocketIO();
const { connected, transport } = useConnectionStatus();
```

## Migration Steps

### Phase 1: Fix epi-cpcodebase (Reference Implementation)

#### 1. Remove Custom SocketContext
```bash
# DELETE these files:
rm /Users/brendan/Code/epi-cpcodebase/web/src/contexts/SocketContext.tsx
```

#### 2. Update Component Imports
```typescript
// OLD - Custom SocketContext
import { useSocket } from '../contexts/SocketContext';

// NEW - Framework hooks
import { useSocketIO, useConnectionStatus } from '@episensor/app-framework/ui';
```

#### 3. Update Components Using WebSocket
```typescript
// Example: ProjectsPage.tsx
// OLD
const { socket, connected } = useSocket();

// NEW
const { socket } = useSocketIO();
const { connected } = useConnectionStatus();

// WebSocket events remain the same
useEffect(() => {
  if (socket && connected) {
    socket.on('scan:progress', handleProgress);
    return () => {
      socket.off('scan:progress', handleProgress);
    };
  }
}, [socket, connected]);
```

#### 4. Remove SocketProvider from App.tsx
```typescript
// OLD
<SocketProvider>
  <AppContent />
</SocketProvider>

// NEW - No provider needed, framework handles it
<AppContent />
```

### Phase 2: Fix epi-competitor-ai

#### 1. Remove Custom WebSocketService
```bash
# This 245-line file should be deleted:
rm /Users/brendan/Code/epi-competitor-ai/src/server/services/WebSocketService.ts
```

#### 2. Migrate WebSocket Events to StandardServer
```typescript
// OLD - Custom WebSocketService
export class WebSocketService {
  constructor(server: HttpServer, jobQueue: JobQueue) {
    this.io = new SocketIOServer(server, { /* config */ });
    this.setupEventListeners();
  }
}

// NEW - Use StandardServer's io instance
const server = new StandardServer({
  enableWebSocket: true,
  onInitialize: async (app, io) => {
    if (io) {
      const jobQueue = app.locals.jobQueue;

      // Migrate event listeners
      jobQueue.on('job:created', (job) => {
        io.to('all').emit('job:created', job);
      });

      // Migrate connection handlers
      io.on('connection', (socket) => {
        socket.on('subscribe:job', (jobId) => {
          socket.join(`job:${jobId}`);
        });
        // ... other handlers
      });
    }
  }
});
```

#### 3. Remove Custom SocketContext
```bash
rm /Users/brendan/Code/epi-competitor-ai/web/src/contexts/SocketContext.tsx
```

#### 4. Update Frontend Components
- Replace `useSocket()` with `useSocketIO()` and `useConnectionStatus()`
- Remove SocketProvider wrapper

### Phase 3: Fix epi-node-programmer

#### 1. Remove Abstraction Layers
```bash
# Consider removing or simplifying:
/Users/brendan/Code/epi-node-programmer/src/services/WebSocketAdapter.ts
/Users/brendan/Code/epi-node-programmer/web/src/lib/websocket-singleton.ts
```

#### 2. Add Connection Status UI
```typescript
// Add to main App or Layout component:
import {
  ConnectionStatusBanner,
  ConnectionLostOverlay,
  useConnectionStatus
} from '@episensor/app-framework/ui';

// In component:
const { connected, connecting, transport } = useConnectionStatus();

return (
  <>
    <ConnectionStatusBanner
      connected={connected}
      connecting={connecting}
      transport={transport}
    />
    {/* existing UI */}
    <ConnectionLostOverlay
      isConnected={connected || connecting}
      appName="Node Programmer"
    />
  </>
);
```

## Framework Enhancement Recommendations

### 1. Add Common Event Patterns
```typescript
// Add to framework's WebSocket service:
interface JobQueueEvents {
  'job:created': (job: Job) => void;
  'job:updated': (job: Job) => void;
  'job:progress': (progress: Progress) => void;
  'job:completed': (job: Job) => void;
  'job:failed': (job: Job, error: Error) => void;
}

// Reusable job queue WebSocket handler
export function setupJobQueueSocket(io: SocketIOServer, jobQueue: JobQueue) {
  // Standard implementation all apps can use
}
```

### 2. Add Room Management Utilities
```typescript
// Framework could provide:
export class RoomManager {
  subscribeToEntity(socket: Socket, entityType: string, entityId: string) {
    socket.join(`${entityType}:${entityId}`);
  }

  broadcastToEntity(io: SocketIOServer, entityType: string, entityId: string, event: string, data: any) {
    io.to(`${entityType}:${entityId}`).emit(event, data);
  }
}
```

### 3. Standardize Connection Health Checks
```typescript
// Framework's StandardServer should expose:
app.locals.getWebSocketStatus = () => ({
  connected: io.engine.clientsCount > 0,
  clients: io.engine.clientsCount,
  transport: 'websocket' // or 'polling'
});
```

## Testing Strategy Integration

### 1. WebSocket Connection Test
```bash
#!/bin/bash
# test-websocket.sh

# Test single connection (should be only one)
CONNECTIONS=$(lsof -i :$PORT | grep -c ESTABLISHED)
if [ $CONNECTIONS -eq 1 ]; then
  echo "✅ Single WebSocket connection"
else
  echo "❌ Multiple connections detected: $CONNECTIONS"
fi
```

### 2. Browser Console Test
```javascript
// Check for duplicate connection attempts
const checkDuplicateConnections = () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (msg) => {
    logs.push(msg);
    originalLog(msg);
  };

  // Wait for app to load
  setTimeout(() => {
    const wsConnections = logs.filter(l => l.includes('WebSocket'));
    if (wsConnections.length > 1) {
      console.error('❌ Multiple WebSocket connections detected');
    }
  }, 3000);
};
```

### 3. Framework Integration Test
```typescript
// Verify framework hooks are used
import { renderHook } from '@testing-library/react-hooks';
import { useSocketIO, useConnectionStatus } from '@episensor/app-framework/ui';

test('uses framework WebSocket hooks', () => {
  const { result: socketResult } = renderHook(() => useSocketIO());
  const { result: statusResult } = renderHook(() => useConnectionStatus());

  expect(socketResult.current.socket).toBeDefined();
  expect(statusResult.current.connected).toBeDefined();
});
```

## Success Metrics

### After Migration
- ✅ Each app has only ONE WebSocket connection
- ✅ All apps show consistent connection status indicators
- ✅ ~400 lines of duplicate code removed
- ✅ Unified retry logic and transport fallback
- ✅ No browser console errors about WebSocket connections
- ✅ Health endpoints report WebSocket as "healthy"

## Implementation Timeline

### Week 1
- [ ] Fix epi-cpcodebase (reference implementation)
- [ ] Test and document the pattern
- [ ] Update framework documentation

### Week 2
- [ ] Migrate epi-competitor-ai WebSocketService
- [ ] Add connection status to epi-node-programmer
- [ ] Create automated tests

### Week 3
- [ ] Review all apps for compliance
- [ ] Add framework enhancements (job queue patterns, room management)
- [ ] Final testing and documentation

## Code Examples

### ❌ WRONG - Custom SocketContext
```typescript
// DON'T DO THIS - Creates duplicate connection
export const SocketProvider: React.FC = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socketInstance = io(apiUrl, { /* config */ });
    setSocket(socketInstance);
  }, []);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
};
```

### ✅ RIGHT - Use Framework Hooks
```typescript
// DO THIS - Uses framework's single connection
import { useSocketIO, useConnectionStatus } from '@episensor/app-framework/ui';

export const MyComponent = () => {
  const { socket } = useSocketIO();
  const { connected, transport } = useConnectionStatus();

  useEffect(() => {
    if (socket && connected) {
      socket.on('my:event', handleEvent);
    }
  }, [socket, connected]);
};
```

### ❌ WRONG - Custom WebSocket Service
```typescript
// DON'T DO THIS - Bypasses framework
export class WebSocketService {
  private io: SocketIOServer;

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, { /* config */ });
  }
}
```

### ✅ RIGHT - Use StandardServer's WebSocket
```typescript
// DO THIS - Extends framework WebSocket
const server = new StandardServer({
  enableWebSocket: true,
  onInitialize: async (app, io) => {
    if (io) {
      // Add your custom handlers to framework's io instance
      io.on('connection', (socket) => {
        socket.on('domain:specific', handler);
      });
    }
  }
});
```

## Conclusion

This migration will:
1. **Reduce complexity** - Remove ~400 lines of duplicate code
2. **Improve reliability** - Single, robust WebSocket implementation
3. **Enhance UX** - Consistent connection status across all apps
4. **Simplify maintenance** - One WebSocket system to maintain
5. **Enable features** - Framework can add features that benefit all apps

The key principle: **Let the framework handle WebSocket infrastructure, apps only add domain-specific event handlers.**