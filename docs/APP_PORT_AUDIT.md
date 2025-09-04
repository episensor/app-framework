# EpiSensor Apps Port Configuration Audit

## Current State (as of audit)

### epi-cpcodebase
- **package.json**: backendPort: 7000, frontendPort: 7001
- **app.json**: {} (empty!)
- **Status**: ❌ No app.json configuration

### epi-modbus-simulator  
- **package.json**: backendPort: 7010, frontendPort: 7011
- **app.json**: (needs checking)
- **Status**: ⚠️ To be verified

### epi-vpp-manager
- **package.json**: backendPort: 7015, frontendPort: 7016
- **app.json**: api.port: 7015, web.port: 7016, web.devPort: 7016
- **Status**: ✅ Properly configured

### epi-node-programmer
- **package.json**: backendPort: 7020, frontendPort: 7021  
- **app.json**: (needs checking)
- **Status**: ⚠️ To be verified

### epi-competitor-ai
- **package.json**: backendPort: 7005, frontendPort: 7006
- **app.json**: (needs checking)
- **Status**: ⚠️ To be verified

## Issues Found

1. **Inconsistent Configuration Sources**: Some apps rely on package.json while others use app.json
2. **Missing app.json**: epi-cpcodebase has an empty app.json
3. **Frontend Startup Issues**: episensor-dev not properly starting frontend processes
4. **Port Hopping**: Fallback to hardcoded defaults when config is missing

## Recommended Actions

1. **Standardize on app.json** for runtime configuration
2. **Keep package.json devServer** for dev tooling only
3. **Update all apps** to have proper app.json with api.port, web.port, web.devPort
4. **Fix episensor-dev** frontend spawning issue
5. **Add validation** on startup to ensure ports are configured

## Standard Template for app.json

```json
{
  "app": {
    "name": "App Name",
    "version": "1.0.0",
    "description": "App Description"
  },
  "api": {
    "port": 7000,
    "host": "0.0.0.0"
  },
  "web": {
    "port": 7001,
    "devPort": 7001,
    "host": "0.0.0.0"
  }
}
```
