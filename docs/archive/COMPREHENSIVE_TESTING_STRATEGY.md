# Comprehensive Testing Strategy for @episensor/app-framework Apps

## What Went Wrong with Initial Testing

My initial testing strategy was superficial and missed critical issues:

### ❌ Insufficient Testing Approach
1. **Only tested health endpoints** - Confirmed API was responding but didn't verify actual functionality
2. **No browser console checks** - Missed React errors, WebSocket failures, and other client-side issues
3. **No WebSocket verification** - Didn't test real-time connectivity despite it being a core feature
4. **No UI interaction testing** - Didn't verify if the UI was actually functional
5. **Assumed running = working** - Just because a process started didn't mean it was working correctly

## Comprehensive Testing Checklist

### 1. Backend API Testing
```bash
# Basic health check
curl -s http://localhost:PORT/api/health | jq .

# Verify health status is "healthy" not just responding
curl -s http://localhost:PORT/api/health | jq '.status' | grep -q "healthy"

# Test actual API endpoints (not just health)
curl -s http://localhost:PORT/api/info | jq .
curl -s http://localhost:PORT/api/app/info | jq .

# Check for error responses
curl -s -o /dev/null -w "%{http_code}" http://localhost:PORT/api/nonexistent
```

### 2. WebSocket Testing
```bash
# Test Socket.IO polling transport
curl -s "http://localhost:PORT/socket.io/?EIO=4&transport=polling" | head -1

# Verify WebSocket upgrade capability
curl -s -N -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:PORT/socket.io/ -v 2>&1 | grep "101 Switching Protocols"

# Check if multiple Socket.IO instances are conflicting
lsof -i :PORT | grep LISTEN
```

### 3. Frontend Testing

#### Browser Console Monitoring
```javascript
// Check for these common issues:
// - React errors (Element type invalid, hooks errors)
// - WebSocket connection failures
// - 404s on API calls
// - CORS errors
// - Module import errors
```

#### Manual Browser Checks
1. Open browser developer console BEFORE loading the app
2. Load the app at http://localhost:FRONTEND_PORT
3. Check for:
   - Red error messages in console
   - Failed network requests in Network tab
   - WebSocket connection status in WS tab
   - React DevTools warnings

### 4. Process Health Monitoring
```bash
# Check if process is actually running
ps aux | grep -E "app-name|PORT" | grep -v grep

# Monitor CPU/memory usage (high CPU might indicate infinite loops)
top -pid $(pgrep -f "app-name")

# Check for port conflicts
lsof -i :PORT

# Verify both backend and frontend are running
curl -s http://localhost:BACKEND_PORT/api/health
curl -s http://localhost:FRONTEND_PORT/
```

### 5. Configuration Verification
```bash
# Check environment variables
env | grep -E "PORT|API|VITE"

# Verify package.json scripts
npm run --list

# Check for TypeScript errors
npm run typecheck

# Run linting
npm run lint
```

### 6. Common Issues to Check

#### Dual WebSocket Connections
- Framework's `useConnectionStatus` creating one connection
- App's `SocketContext` creating another connection
- Connections to wrong ports (frontend vs backend)

#### React Component Mismatches
- Framework exports `AppLayout` not `AppShell`
- Check actual exports: `npm ls @episensor/app-framework`

#### TypeScript Strict Mode Issues
- Unused variables with `noUnusedLocals: true`
- Async/await in non-async functions
- Property mismatches in interfaces

#### Port Configuration Issues
- Backend and frontend on correct ports
- VITE_API_URL environment variable set correctly
- WebSocket connecting to backend port, not frontend

### 7. Automated Testing Script

Create a test script for each app:

```bash
#!/bin/bash
# test-app.sh

APP_NAME="app-name"
BACKEND_PORT=7000
FRONTEND_PORT=7001

echo "Testing $APP_NAME..."

# 1. Start the app
npm run dev &
PID=$!
sleep 5

# 2. Test backend health
if curl -s http://localhost:$BACKEND_PORT/api/health | jq -e '.status == "healthy"' > /dev/null; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
fi

# 3. Test WebSocket
if curl -s "http://localhost:$BACKEND_PORT/socket.io/?EIO=4&transport=polling" | grep -q "sid"; then
    echo "✅ WebSocket endpoint responding"
else
    echo "❌ WebSocket endpoint not responding"
fi

# 4. Test frontend
if curl -s http://localhost:$FRONTEND_PORT/ | grep -q "<div id=\"root\">"; then
    echo "✅ Frontend serving HTML"
else
    echo "❌ Frontend not serving properly"
fi

# 5. Check for TypeScript errors
if npm run typecheck 2>&1 | grep -q "error TS"; then
    echo "❌ TypeScript errors found"
else
    echo "✅ No TypeScript errors"
fi

# Cleanup
kill $PID
```

### 8. Browser Console Testing with Playwright

```javascript
// playwright-console-test.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const errors = [];

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push(error.message);
  });

  await page.goto('http://localhost:7001');
  await page.waitForTimeout(3000);

  if (errors.length > 0) {
    console.log('❌ Browser console errors:');
    errors.forEach(err => console.log('  -', err));
    process.exit(1);
  } else {
    console.log('✅ No browser console errors');
  }

  await browser.close();
})();
```

## Testing Strategy Summary

### Before Declaring "It Works"
1. ✅ Backend API responds with healthy status
2. ✅ WebSocket/Socket.IO endpoints are accessible
3. ✅ Frontend loads without console errors
4. ✅ No TypeScript compilation errors
5. ✅ No port conflicts or connection refused errors
6. ✅ UI is interactive (not just visible)
7. ✅ Real-time features work (if applicable)

### Red Flags to Watch For
- 503 Service Unavailable (backend not running)
- "WebSocket is closed before connection is established"
- "Element type is invalid" (React component issues)
- Multiple Socket.IO connection attempts
- High CPU usage indicating infinite loops
- CORS errors between frontend and backend

## Continuous Monitoring

### Development
```bash
# Run in separate terminals
npm run dev           # Terminal 1
npm run test:watch    # Terminal 2
npm run typecheck -w  # Terminal 3
```

### Production
- Health endpoint monitoring every 30 seconds
- WebSocket connection status tracking
- Error logging aggregation
- Performance metrics (response times, memory usage)

## Lessons Learned

1. **Never assume** - Just because an app starts doesn't mean it works
2. **Check the browser console** - Many issues only appear client-side
3. **Test actual functionality** - Health endpoints aren't enough
4. **Verify WebSocket connections** - Real-time features are fragile
5. **Read error messages carefully** - They often point to the exact issue
6. **Test incrementally** - Fix one issue at a time
7. **Document issues and fixes** - Build a knowledge base of common problems