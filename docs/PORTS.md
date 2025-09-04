# Port Standardization

## Overview

All applications follow a consistent port strategy:

### Development Mode
- **API Server**: Runs on the main application port
- **Web Dev Server (Vite)**: Runs on a separate web port
- Vite proxies `/api` and `/socket.io` requests to the API server

### Production Mode  
- **API Server**: Runs on the main application port AND serves the built web UI
- No separate web server needed - Express serves everything

## Example Port Configuration

| Application Type | API Port | Web Port (Dev Only) | Notes |
|-----------------|----------|-------------------|--------|
| Example App 1 | 5174 | 5173 | Main application |
| Example App 2 | 8080 | 8081 | Secondary service |
| Example App 3 | 4000 | 4001 | Additional service |

## Configuration

Ports are configured in `data/config/app.json`:

```json
{
  "server": {
    "port": 5174,        // API port (used in both dev and prod)
    "webPort": 5173,     // Web dev server port (dev only)
    "websocketPort": 5174 // WebSocket port (same as API)
  }
}
```

## Access URLs

### Development
- Web UI: `http://localhost:{webPort}` (e.g., http://localhost:5173)
- API: `http://localhost:{port}/api` (e.g., http://localhost:5174/api)

### Production
- Web UI: `http://localhost:{port}` (e.g., http://localhost:5174)
- API: `http://localhost:{port}/api` (e.g., http://localhost:5174/api)

## Implementation Details

### Express Static Serving (Production)
In production, Express serves the built React app:

```typescript
if (process.env.NODE_ENV === 'production') {
  // Serve static files
  app.use(express.static(path.join(__dirname, '../web/dist')));
  
  // Catch-all route for React SPA
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../web/dist/index.html'));
  });
}
```

### Vite Proxy (Development)
In development, Vite proxies API requests to the backend:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5174', // API port
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'ws://localhost:5174',
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
```

## Benefits

1. **Simplified Production**: Single process serves everything
2. **Development Flexibility**: Hot reload with Vite dev server
3. **Consistent API Access**: `/api` routes work the same in dev and prod
4. **No CORS Issues**: Everything comes from the same origin in production
