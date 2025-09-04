# App Structure Review

## Summary of All Apps

### 1. epi-cpcodebase ✅
- **Port Assignment**: 7000 (API), 7001 (Web)
- **Startup**: Uses `episensor-dev` CLI
- **Logging**: Standard `createLogger` with desktop enhancement
- **Config**: Uses `ConfigManager` with schema validation
- **Directory Structure**: Clean, follows framework patterns
- **Docs**: Minimal (could use improvement)
- **Desktop**: Full Tauri support
- **WebSocket**: Custom implementation for real-time updates

### 2. epi-modbus-simulator ✅
- **Port Assignment**: 7010 (API), 7011 (Web)
- **Startup**: Uses `episensor-dev` CLI
- **Logging**: Standard `createLogger`
- **Config**: Uses `ConfigManager` with comprehensive schema
- **Directory Structure**: Well organized with features/ pattern
- **Docs**: Good documentation
- **Desktop**: Tauri support
- **WebSocket**: Custom Socket.IO for simulator events

### 3. epi-vpp-manager ✅
- **Port Assignment**: 7015 (API), 7016 (Web)
- **Startup**: Uses `episensor-dev` CLI
- **Logging**: Standard `createLogger`
- **Config**: Modern config system with validation
- **Directory Structure**: Clean feature-based organization
- **Docs**: Adequate
- **Desktop**: Tauri support
- **WebSocket**: Custom implementation for VPP events

### 4. epi-node-programmer ✅ (after fix)
- **Port Assignment**: 7020 (API), 7021 (Web)
- **Startup**: Fixed - now uses `episensor-dev` CLI
- **Logging**: Standard `createLogger`
- **Config**: Basic config object (could use ConfigManager)
- **Directory Structure**: Good
- **Docs**: Minimal
- **Desktop**: Tauri support
- **WebSocket**: Custom for programming status

### 5. epi-app-template ✅
- **Port Assignment**: 8080 (default, configurable)
- **Startup**: Uses `episensor-dev` CLI
- **Logging**: Example shows `createLogger` usage
- **Config**: Basic template with app.json
- **Directory Structure**: Minimal template structure
- **Docs**: Good template documentation
- **Desktop**: Tauri ready

## Port Assignment Summary

| App | API Port | Web Port | Purpose |
|-----|----------|----------|---------|
| epi-cpcodebase | 7000 | 7001 | Codebase management |
| epi-modbus-simulator | 7010 | 7011 | Device simulation |
| epi-vpp-manager | 7015 | 7016 | VPP management |
| epi-node-programmer | 7020 | 7021 | Manufacturing tool |
| epi-app-template | 8080 | 5173 | Template default |

## Common Patterns (Good)

1. **All apps use `StandardServer`** for consistent initialization
2. **All apps use `createLogger`** for logging
3. **All apps support desktop packaging** via Tauri
4. **All apps use the framework's UI components**
5. **All apps follow similar project structure**
6. **All apps implement custom WebSocket logic** for their specific needs

## Areas for Improvement

### 1. Configuration
- **epi-node-programmer** could benefit from using `ConfigManager` instead of plain objects
- Some apps could use more comprehensive schemas

### 2. Documentation
- **epi-cpcodebase** and **epi-node-programmer** have minimal docs
- Could benefit from standardized README templates

### 3. Testing
- Test coverage varies significantly between apps
- Some apps have no tests at all

### 4. Error Handling
- Now that generic error handler is in framework, apps should adopt it
- Remove any duplicate error handling code

## Recommendations

1. **Standardize Configuration**: All apps should use `ConfigManager` with proper schemas
2. **Documentation Template**: Create a standard README template for all apps
3. **Testing Standards**: Establish minimum test coverage requirements
4. **Error Handler Migration**: Update all apps to use framework's error handler
5. **Port Registry**: Consider maintaining a central port assignment registry

## Framework Features Adoption

| Feature | cpcodebase | modbus-sim | vpp-manager | node-prog |
|---------|------------|------------|-------------|-----------|
| StandardServer | ✅ | ✅ | ✅ | ✅ |
| createLogger | ✅ | ✅ | ✅ | ✅ |
| ConfigManager | ✅ | ✅ | ✅ | ❌ |
| UI Components | ✅ | ✅ | ✅ | ✅ |
| Error Handler | ❌ | ❌ | ❌ | ❌ |
| SettingsService | ❌ | ✅ | ❌ | ✅ |
| AIService | ❌ | ✅ | ❌ | ❌ |
| QueueService | ❌ | ❌ | ❌ | ✅ |

All apps are in good shape with the main issues being:
1. The infinite loop in epi-node-programmer's dev script (now fixed)
2. Opportunity to adopt the new generic error handler
3. Some apps could benefit from better configuration management
