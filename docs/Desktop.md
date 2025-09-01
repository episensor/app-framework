# Desktop Application Support

The App Framework provides comprehensive support for building desktop applications using Tauri, with full backend bundling and external API access.

## Quick Start

### 1. Initialize Desktop Support

```bash
# In your app directory
npx app-framework desktop init
```

This will:
- Install Tauri dependencies
- Create `src-tauri` directory structure
- Set up bundling scripts
- Configure icon generation

### 2. Configure Your App

Update your `package.json`:

```json
{
  "desktop": {
    "appId": "com.yourcompany.yourapp",
    "appName": "Your App Name",
    "port": 8081,
    "externalAccess": true
  }
}
```

### 3. Add Your Icon

Place a high-resolution square PNG icon at `icons/icon.png`, then generate all sizes:

```bash
npx tauri icon icons/icon.png
```

### 4. Build Desktop App

```bash
npm run desktop:build
```

This creates a self-contained application with:
- Bundled backend (single JS file)
- Embedded Node.js runtime
- External API access on configured port
- Platform-specific installer

## Architecture

### Backend Bundling

The framework uses esbuild to bundle your Node.js backend into a single JavaScript file:

```
src/index.ts → tsc → dist/index.js → esbuild → backend.js (6-10MB)
```

This bundle includes:
- All application code
- All dependencies (except native modules)
- Framework code
- ESM/CommonJS compatibility layer

### Process Management

```
Desktop App (Tauri)
    ├── Frontend (WebView)
    │   └── React/Vue/Angular app
    └── Backend (Node.js Process)
        ├── Bundled backend.js
        ├── API Server (Express)
        └── WebSocket Server
```

The backend runs as a child process, managed by Tauri:
- Starts automatically when app launches
- Stops when app closes
- Restarts on crash (optional)

### External API Access

The backend API is accessible from outside the application:

```javascript
// Backend binds to all interfaces
app.listen(8081, '0.0.0.0', () => {
  console.log('API accessible at http://<any-ip>:8081');
});
```

This enables:
- External API integrations
- Remote monitoring
- Multi-device testing
- Third-party service connections

## Configuration

### Desktop Configuration Schema

```typescript
interface DesktopConfig {
  enabled: boolean;          // Enable desktop builds
  appId: string;             // Reverse domain identifier
  appName: string;           // Display name
  port: number;              // API port (default: 8081)
  externalAccess: boolean;   // Allow external API access
  autoUpdate: boolean;       // Enable auto-updates
  singleInstance: boolean;   // Prevent multiple instances
  startMinimized: boolean;   // Start in system tray
  icon?: string;             // Path to icon file
}
```

### Environment Variables

The desktop app sets these environment variables:

```bash
NODE_ENV=production        # Production mode
DESKTOP_MODE=true         # Desktop app indicator
PORT=8081                 # API port
HOST=0.0.0.0             # Bind to all interfaces
DATA_DIR=/path/to/appdata # User data directory
```

## Data Storage

User data is stored in platform-specific locations:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/[appId]/` |
| Windows | `%APPDATA%/[appId]/` |
| Linux | `~/.config/[appId]/` |

Standard directories:
```
data/
├── config/       # User configuration
├── logs/         # Application logs
├── cache/        # Temporary files
├── storage/      # Persistent data
└── uploads/      # User uploads
```

## API Endpoints

### Health Check
```http
GET http://localhost:8081/api/health
```

### Authentication
```http
POST http://localhost:8081/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}
```

### External Access Test
```bash
# From another machine
curl http://<desktop-ip>:8081/api/health
```

## Development Workflow

### Development Mode

```bash
npm run desktop:dev
```

Features:
- Hot reload for frontend
- Backend auto-restart
- DevTools enabled
- Source maps included

### Testing

```bash
# Unit tests
npm test

# E2E tests (desktop specific)
npm run test:desktop

# Test external access
npm run test:external
```

### Debugging

1. **Frontend Debugging**: DevTools open automatically in development
2. **Backend Debugging**: Logs written to `data/logs/`
3. **Process Debugging**: Use `--inspect` flag for Node.js debugging

## Building for Distribution

### Build Commands

```bash
# macOS
npm run desktop:build:mac

# Windows (from Windows or macOS with Wine)
npm run desktop:build:win

# Linux
npm run desktop:build:linux

# All platforms (CI/CD)
npm run desktop:build:all
```

### Code Signing

#### macOS
```bash
export APPLE_ID="your-apple-id"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="team-id"
npm run desktop:build:mac
```

#### Windows
```bash
export WINDOWS_CERT_PATH="path/to/certificate.pfx"
export WINDOWS_CERT_PASSWORD="password"
npm run desktop:build:win
```

### Auto Updates

Configure in `tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://releases.your-domain.com/{{app}}/{{target}}/{{version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

## Security Considerations

### API Security

Even with external access, the API remains secure:

```javascript
// Require authentication for all API routes
app.use('/api', authenticate);

// CORS configuration for known origins
app.use(cors({
  origin: ['tauri://localhost', 'http://trusted-origin.example.com']
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
```

### Network Security

```javascript
// Firewall rules (example for macOS)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /Applications/YourApp.app
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /Applications/YourApp.app
```

### Data Encryption

Sensitive data is encrypted using the OS keychain:

```javascript
import { keychain } from 'app-framework';

// Store sensitive data
await keychain.set('api-key', 'secret-value');

// Retrieve sensitive data
const apiKey = await keychain.get('api-key');
```

## External Integration

### API Endpoints

The desktop app can expose custom API endpoints for external integrations:

```javascript
// Example external API endpoint
app.post('/api/external/command', authenticate, async (req, res) => {
  const { action, payload } = req.body;
  
  // Process external command
  const result = await processExternalCommand(action, payload);
  
  res.json({ success: true, result });
});
```

### Testing External Access

```bash
# Test external API
curl -X POST http://localhost:8081/api/external/command \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"action": "test", "payload": {}}'
```

## Troubleshooting

### Common Issues

#### Backend Not Starting
```bash
# Check Node.js installation
node --version

# Check logs
tail -f ~/Library/Application\ Support/[appId]/data/logs/app-*.log

# Check port availability
lsof -i :8081
```

#### External Access Blocked
```bash
# Check firewall
sudo pfctl -s rules | grep 8081

# Test local binding
curl http://0.0.0.0:8081/api/health

# Check network interface
ifconfig | grep inet
```

#### Bundle Too Large
```javascript
// Exclude unnecessary dependencies
{
  external: ['canvas', 'sharp', 'sqlite3']
}

// Use production builds
NODE_ENV=production npm run bundle:backend
```

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm run desktop:dev
```

View Tauri logs:
```bash
RUST_LOG=debug npm run desktop:dev
```

## Migration Guide

### From Electron

```javascript
// Electron
const { app, BrowserWindow } = require('electron');

// Tauri (in Rust)
tauri::Builder::default()
  .setup(|app| {
    // Setup code
    Ok(())
  })
```

### From Web App

1. Add desktop configuration
2. Update API URLs to use relative paths
3. Handle offline scenarios
4. Add file system access if needed

## Best Practices

### 1. Resource Management
- Bundle only necessary dependencies
- Lazy load optional features
- Compress assets

### 2. User Experience
- Show splash screen during startup
- Provide offline functionality
- Implement proper error handling

### 3. Security
- Validate all external inputs
- Use secure communication (HTTPS/WSS)
- Implement rate limiting

### 4. Performance
- Use worker threads for heavy computation
- Implement caching strategies
- Optimize bundle size

## Framework CLI Commands

```bash
# Initialize desktop support
npx app-framework desktop init

# Generate icons from source image
npx app-framework desktop icon <source>

# Build for current platform
npx app-framework desktop build

# Build for specific platform
npx app-framework desktop build --target mac
npx app-framework desktop build --target windows
npx app-framework desktop build --target linux

# Run in development mode
npx app-framework desktop dev

# Package for distribution
npx app-framework desktop package

# Sign application
npx app-framework desktop sign

# Create installer
npx app-framework desktop installer
```

## Support

For issues or questions:
- GitHub: [Repository URL]
- Documentation: [Documentation URL]

