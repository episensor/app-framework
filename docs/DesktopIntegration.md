# Desktop App Integration with StandardServer

The `StandardServer` now includes built-in desktop app support for Tauri applications.

## Quick Start

```typescript
import { StandardServer } from '@episensor/app-framework';

const server = new StandardServer({
  appName: 'myapp',
  appVersion: '1.0.0',
  appId: 'com.episensor.myapp', // Desktop app ID
  enableDesktopIntegration: true, // Auto-enabled when TAURI=1
  webPort: 5173, // Vite dev server port
  onInitialize: async (app) => {
    // Your app setup here
  }
});

await server.initialize();
await server.start();
```

## Automatic Desktop Detection

When `TAURI=1` environment variable is set, the server automatically:

- ✅ Enables desktop integration
- ✅ Uses platform-specific data directories
- ✅ Configures CORS for Tauri origins
- ✅ Sets up proper logging paths

## Desktop Features

### Data Paths
- **macOS**: `~/Library/Application Support/{appId}/`  
- **Windows**: `%APPDATA%/{appId}/`
- **Linux**: `~/.local/share/{appId}/`

### CORS Configuration
Automatically includes (when `webPort` is specified):
- `http://localhost:{webPort}` (Vite dev server)
- `http://localhost:{webPort+1}` (Alternative port)

Always includes for desktop apps:
- `tauri://localhost` (Tauri WebView)
- `https://tauri.localhost` (Tauri HTTPS)

Additional origins can be specified via the `corsOrigins` config option.

### Configuration Options

```typescript
interface StandardServerConfig {
  // ... other options
  appId?: string;                    // App identifier (com.episensor.appname)
  enableDesktopIntegration?: boolean; // Enable desktop features
  desktopDataPath?: string;          // Override data path
  corsOrigins?: string[];            // Additional CORS origins
}
```

### Utility Methods

```typescript
// Check if running as desktop app
if (server.isDesktopApp()) {
  console.log('Running in desktop mode');
}

// Get platform-specific data path
const dataPath = server.getDataPath();
console.log('Data stored at:', dataPath);
```

## Tauri Configuration

Update your `tauri.conf.json`:

```json
{
  "build": {
    "beforeBuildCommand": "VITE_API_URL=http://localhost:3005 npm run build"
  }
}
```

This ensures the frontend connects to the correct API URL in the bundled app.

## Sidecar Binary Setup

The framework includes comprehensive sidecar support. See the existing `/desktop/` directory for:

- Binary bundling with esbuild + pkg
- Rust templates for sidecar management
- Cross-platform build scripts
- Process lifecycle management

## Migration from Manual Setup

If you have existing desktop setup code, you can remove:

- Manual CORS configuration for Tauri
- Custom data path management
- Environment detection logic

The StandardServer handles all of this automatically when `enableDesktopIntegration: true`.