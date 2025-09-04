# Port Management in EpiSensor Applications

## Overview

Port configuration in EpiSensor applications can come from multiple sources, leading to confusion when ports don't match expectations. This document explains the port management strategy and how to ensure consistent behavior.

## Port Configuration Sources (in priority order)

1. **Environment Variables** (highest priority)
   - `API_PORT` or `PORT` - Backend API port
   - Always takes precedence over config files

2. **app.json Configuration**
   - `api.port` - Backend API port (production and development)
   - `web.port` - Frontend port in production
   - `web.devPort` - Frontend port in development

3. **package.json devServer** (development only)
   - `devServer.backendPort` - Used by episensor-dev
   - `devServer.frontendPort` - Used by episensor-dev

4. **Hardcoded Defaults** (lowest priority)
   - Backend: 3000
   - Frontend Dev: 5173 (Vite default)

## How Ports Are Resolved

### Backend Port Resolution
```javascript
const apiPort = process.env.API_PORT || process.env.PORT || config.api?.port || 3000;
```

### Frontend Port Resolution
```javascript
// In development (episensor-dev)
const frontendPort = config.web?.devPort || packageJson.devServer?.frontendPort || 5173;

// In production (desktop apps)
const frontendPort = config.web?.port || 3000;
```

## Configuration Files

### app.json (Runtime Configuration)
```json
{
  "api": {
    "port": 7015        // Backend port for all environments
  },
  "web": {
    "port": 7016,       // Frontend port in production
    "devPort": 7016     // Frontend port in development
  }
}
```

### package.json (Development Configuration)
```json
{
  "devServer": {
    "backendPort": 7015,
    "frontendPort": 7016,
    "backendCommand": "tsx watch src/index.ts",
    "frontendCommand": "cd web && npm run dev"
  }
}
```

### vite.config.ts (Frontend Dev Server)
```typescript
// Reads from app.json
const config = JSON.parse(fs.readFileSync('../data/config/app.json', 'utf-8'));
const devPort = config.web?.devPort;

export default defineConfig({
  server: {
    port: devPort,
    proxy: {
      '/api': `http://localhost:${config.api.port}`
    }
  }
});
```

## Common Issues and Solutions

### Issue 1: Frontend Not Starting on Expected Port

**Symptom**: Banner shows port 7016 but frontend isn't accessible

**Cause**: Multiple sources of configuration not aligned

**Solution**:
1. Ensure `app.json` has `web.devPort` set
2. Ensure `package.json` has matching `devServer.frontendPort`
3. Ensure `vite.config.ts` reads from app.json

### Issue 2: Port Already in Use

**Symptom**: EADDRINUSE errors

**Solution**:
```bash
# Find what's using the port
lsof -i :7015

# Kill stale processes
pkill -f "episensor-dev"
pkill -f "tsx watch"
```

### Issue 3: Desktop App Can't Connect

**Symptom**: Desktop app shows connection errors

**Cause**: Hardcoded ports in desktop launcher don't match config

**Solution**: Ensure launcher uses same port resolution logic

## Best Practices

1. **Single Source of Truth**: Use `app.json` as the primary configuration
2. **Avoid Hardcoding**: Always provide fallbacks but prefer config
3. **Environment Variables**: Use for deployment overrides only
4. **Validate on Startup**: Check ports are available before binding

## Standard Port Assignments

| Application | Backend | Frontend Dev | Frontend Prod |
|------------|---------|--------------|---------------|
| epi-cpcodebase | 3005 | 3006 | 3006 |
| epi-modbus-simulator | 5002 | 5003 | 5003 |
| epi-vpp-manager | 7015 | 7016 | 7016 |
| epi-node-programmer | 8001 | 8002 | 8002 |
| epi-competitor-ai | 7005 | 7006 | 7006 |

## Implementation Checklist

When setting up ports for a new app:

- [ ] Set ports in `data/config/app.json`
- [ ] Set matching ports in `package.json` devServer section
- [ ] Configure `vite.config.ts` to read from app.json
- [ ] Update `src/index.ts` to use config properly
- [ ] Test with `npm run dev`
- [ ] Test with `npm run tauri dev`
- [ ] Document in app's README

## Debugging Port Issues

```bash
# Check what's configured
cat data/config/app.json | jq '.api.port, .web.port, .web.devPort'

# Check what's running
lsof -i :7015,7016 | grep LISTEN

# Check episensor-dev processes
ps aux | grep episensor-dev

# Test manually
cd web && npm run dev  # Should start on configured port
```
