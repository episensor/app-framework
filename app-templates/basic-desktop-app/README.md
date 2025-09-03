# Desktop App Template

A complete template for building desktop applications with the EpiSensor framework and Tauri.

## Features

- 🚀 **StandardServer** with automatic desktop integration
- 📁 **Platform-specific data storage** (macOS/Windows/Linux)
- 🌐 **Auto-configured CORS** for Tauri WebView
- 📦 **Node.js sidecar bundling** with esbuild + pkg
- 🔄 **Hot reload** in development
- ⚡ **TypeScript** for type safety

## Quick Start

1. **Copy this template:**
   ```bash
   cp -r app-templates/basic-desktop-app my-new-app
   cd my-new-app
   ```

2. **Customize your app:**
   - Update `package.json`: Change `name`, `description`
   - Update `src-tauri/tauri.conf.json`: Change `productName`, `identifier`
   - Update `src/server/index.ts`: Change `appName`, `appId`

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Development:**
   ```bash
   npm run dev:all        # Start both frontend and backend
   npm run tauri:dev      # Start Tauri app in dev mode
   ```

5. **Build desktop app:**
   ```bash
   npm run build:sidecar  # Build Node.js sidecar binary
   npm run tauri:build    # Build desktop app bundle
   ```

## How It Works

### Automatic Desktop Integration

The `StandardServer` automatically detects when running in Tauri (`TAURI=1`) and:

- ✅ Uses platform-specific data directories
- ✅ Configures CORS for `tauri://localhost`
- ✅ Sets up proper logging paths
- ✅ Handles API connections correctly

### Data Storage Locations

- **macOS**: `~/Library/Application Support/com.episensor.myapp/`
- **Windows**: `%APPDATA%/com.episensor.myapp/`
- **Linux**: `~/.local/share/com.episensor.myapp/`

### Sidecar Binary

The Node.js server is bundled into a single binary using:
1. **esbuild** - Bundles ES modules to CommonJS
2. **pkg** - Creates standalone executable
3. **Tauri** - Manages binary lifecycle

## Scripts

- `npm run dev` - Start backend server (development)
- `npm run dev:frontend` - Start Vite frontend server
- `npm run dev:all` - Start both frontend and backend
- `npm run build:sidecar` - Build sidecar binary for desktop
- `npm run tauri:dev` - Run Tauri app in development
- `npm run tauri:build` - Build desktop app bundle

## API Integration

The frontend automatically connects to the correct API URL:
- **Development**: Uses Vite dev server on port 5174
- **Production**: Uses `http://localhost:3005` (set via `VITE_API_URL`)

## Customization

### Adding API Routes

Edit `src/server/index.ts`:

```typescript
onInitialize: async (app) => {
  app.get('/api/my-endpoint', (req, res) => {
    res.json({ message: 'Hello World!' });
  });
}
```

### Frontend Setup

Add your React/Vue/vanilla frontend in the web directory and configure Vite as needed.

### Icons

Add app icons to `src-tauri/icons/`:
- `icon.icns` (macOS)
- `icon.ico` (Windows)  
- `32x32.png`, `128x128.png`, etc.

## Desktop Features

### System Tray (Optional)

The template includes tray icon configuration. Implement tray functionality in Rust if needed.

### Auto Updates (Optional)

The framework includes auto-update support. See framework docs for configuration.

### Window Management

Customize window properties in `tauri.conf.json`:

```json
{
  "app": {
    "windows": [{
      "title": "My App",
      "width": 1200,
      "height": 800,
      "resizable": true
    }]
  }
}
```

## Troubleshooting

### Server Not Starting
- Check that `TAURI=1` environment is set in production
- Verify sidecar binary exists in `src-tauri/binaries/`
- Check console output for error messages

### CORS Issues
- Ensure `VITE_API_URL=http://localhost:3005` in build command
- Verify server is listening on correct port
- Check browser dev tools for CORS errors

### Data Not Persisting
- Verify app is using `server.getDataPath()` for file operations
- Check app data directory permissions
- Ensure `appId` matches across config files