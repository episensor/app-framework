# WebSocket Reference Implementation

## ✅ Verified Working Pattern (epi-cpcodebase)

This pattern has been tested and confirmed to eliminate duplicate WebSocket connections while maintaining all functionality.

## Step-by-Step Migration Guide

### 1. Remove Custom Socket Implementation

**DELETE or BACKUP these files:**
```bash
# Backup the old implementation
mv src/contexts/SocketContext.tsx src/contexts/SocketContext.tsx.backup

# Or create a stub file to prevent import errors
echo "export {} // Migrated to framework hooks" > src/contexts/SocketContext.tsx
```

### 2. Update Component Imports

**BEFORE:**
```typescript
import { useSocket } from '../contexts/SocketContext';
```

**AFTER:**
```typescript
import { useSocketIO, useConnectionStatus } from '@episensor/app-framework/ui';
```

### 3. Update Hook Usage

**BEFORE:**
```typescript
export function MyComponent() {
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('event', (data) => {
      console.log('Event:', data);
    });

    return () => {
      socket.off('event');
    };
  }, [socket]);
}
```

**AFTER:**
```typescript
export function MyComponent() {
  const [socketState, socketActions] = useSocketIO();
  const { connected } = useConnectionStatus();

  useEffect(() => {
    if (!socketActions.socket) return;

    // CRITICAL: Store handler functions for proper cleanup
    const handleEvent = (data: any) => {
      console.log('Event:', data);
    };

    socketActions.on('event', handleEvent);

    return () => {
      // Use the same handler reference for cleanup
      socketActions.off('event', handleEvent);
    };
  }, [socketActions]);
}
```

### 4. Remove Provider from App

**BEFORE:**
```typescript
export function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <AppContent />
      </SocketProvider>
    </BrowserRouter>
  );
}
```

**AFTER:**
```typescript
export function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
```

## Critical Implementation Details

### ⚠️ Handler Function References

**This is the most common mistake when migrating:**

```typescript
// ❌ WRONG - Anonymous functions can't be properly removed
useEffect(() => {
  socketActions.on('event', (data) => { /* handler */ });
  return () => {
    socketActions.off('event', (data) => { /* handler */ }); // Won't work!
  };
}, []);

// ✅ CORRECT - Store handler reference
useEffect(() => {
  const handleEvent = (data) => { /* handler */ };
  socketActions.on('event', handleEvent);
  return () => {
    socketActions.off('event', handleEvent); // Same reference
  };
}, []);
```

### Hook Return Values

```typescript
// useSocketIO returns a tuple: [state, actions]
const [socketState, socketActions] = useSocketIO();

// socketState contains:
// - connected: boolean
// - connecting: boolean
// - error: Error | null
// - retryCount: number
// - transport: 'websocket' | 'polling' | null

// socketActions contains:
// - socket: Socket | null (the raw socket.io instance)
// - emit: (event: string, data?: any) => void
// - on: (event: string, handler: Function) => void
// - off: (event: string, handler: Function) => void
// - once: (event: string, handler: Function) => void
// - connect: () => void
// - disconnect: () => void
// - reconnect: () => void
```

### Server-Side Requirements

Ensure your server uses StandardServer with WebSocket enabled:

```typescript
import { StandardServer } from '@episensor/app-framework';

const server = new StandardServer({
  appName: 'your-app',
  port: 7000,
  enableWebSocket: true,
  onInitialize: async (app, io) => {
    if (io) {
      // Add your custom WebSocket handlers
      io.on('connection', (socket) => {
        console.log('Client connected');

        socket.on('custom:event', (data) => {
          // Handle custom events
        });
      });
    }
  }
});

await server.start();
```

## Common Patterns

### Pattern 1: Subscribe to Entity Updates

```typescript
function useEntitySubscription(entityType: string, entityId: string) {
  const [socketState, socketActions] = useSocketIO();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!socketActions.socket || !entityId) return;

    // Subscribe to entity room
    socketActions.emit(`subscribe:${entityType}`, entityId);

    // Handle updates
    const handleUpdate = (updatedData: any) => {
      if (updatedData.id === entityId) {
        setData(updatedData);
      }
    };

    socketActions.on(`${entityType}:updated`, handleUpdate);

    return () => {
      socketActions.emit(`unsubscribe:${entityType}`, entityId);
      socketActions.off(`${entityType}:updated`, handleUpdate);
    };
  }, [socketActions, entityType, entityId]);

  return data;
}
```

### Pattern 2: Progress Tracking

```typescript
function useProgressTracking(operationId: string) {
  const [socketState, socketActions] = useSocketIO();
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!socketActions.socket || !operationId) return;

    const handleProgress = (data: any) => {
      if (data.id === operationId) {
        setProgress({ current: data.current, total: data.total });
      }
    };

    const handleComplete = (data: any) => {
      if (data.id === operationId) {
        setProgress({ current: data.total, total: data.total });
        // Handle completion
      }
    };

    socketActions.on('progress:update', handleProgress);
    socketActions.on('progress:complete', handleComplete);

    return () => {
      socketActions.off('progress:update', handleProgress);
      socketActions.off('progress:complete', handleComplete);
    };
  }, [socketActions, operationId]);

  return progress;
}
```

### Pattern 3: Connection Status Display

```typescript
function ConnectionIndicator() {
  const { connected, connecting, transport } = useConnectionStatus();

  if (connecting) {
    return <div>Connecting...</div>;
  }

  if (!connected) {
    return <div>Disconnected</div>;
  }

  return (
    <div>
      Connected via {transport}
    </div>
  );
}
```

## Testing Checklist

After migration, verify:

### 1. Build Success
```bash
npm run build
# Should compile without errors
```

### 2. Runtime Checks
```bash
# Start the app
npm run dev

# Check API health
curl -s http://localhost:PORT/api/health | jq .

# Check Socket.IO endpoint
curl -s "http://localhost:PORT/socket.io/?EIO=4&transport=polling"
# Should return session ID
```

### 3. Browser Console
- Open Developer Tools → Console
- Should see NO errors about:
  - "WebSocket is closed before connection"
  - "Multiple connections"
  - "useSocket is not defined"

### 4. Network Tab
- Open Developer Tools → Network → WS
- Should see ONLY ONE WebSocket connection
- Connection should be to backend port (e.g., 7000)
- NOT to frontend port (e.g., 7001)

### 5. Connection Count
```bash
# Check established connections
lsof -i :PORT | grep ESTABLISHED | wc -l
# Should be 1 per connected client
```

## Benefits After Migration

1. **Code Reduction**: ~60-250 lines removed per app
2. **Single Connection**: No more duplicate WebSocket connections
3. **Better Reliability**: Framework handles reconnection, transport fallback
4. **Consistent UX**: Same connection status across all apps
5. **Type Safety**: Full TypeScript support
6. **Automatic Cleanup**: Framework manages socket lifecycle

## Troubleshooting

### Issue: "useSocketIO is not defined"
**Solution:** Update @episensor/app-framework to latest version

### Issue: Events not firing
**Solution:** Check you're using the same handler reference in on() and off()

### Issue: "socket is null"
**Solution:** Check `socketActions.socket` not just `socket`

### Issue: Connection to wrong port
**Solution:** Framework connects to current origin by default. Override with:
```typescript
const [state, actions] = useSocketIO({
  url: 'http://localhost:7000'
});
```

## Next Apps to Migrate

Apply this same pattern to:

1. **epi-competitor-ai** - Replace 245-line WebSocketService
2. **epi-node-programmer** - Add connection status UI
3. **epi-vpp-manager** - Verify framework usage
4. **epi-modbus-simulator** - Already good, just verify

## Summary

The key to successful migration:
1. Remove ALL custom WebSocket code
2. Use framework hooks exclusively
3. Store handler functions for proper cleanup
4. Let framework handle connection management
5. Test thoroughly in browser console

This pattern is now proven and ready for rollout across all apps.