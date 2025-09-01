# Desktop Bundling Guide

This guide explains how to bundle Node.js backend applications for desktop deployment using the EpiSensor App Framework's desktop bundling capabilities.

## Overview

The desktop bundling system allows you to:
- Bundle Node.js backends into self-contained executables
- Handle native Node.js modules properly
- Integrate with Tauri for cross-platform desktop apps
- Manage IPC communication between frontend and backend
- Create truly offline-capable applications

## Quick Start

### 1. Install Dependencies

```bash
npm install @episensor/app-framework
```

### 2. Create Bundle Script

Create a `scripts/bundle-desktop.js` file:

```javascript
import { bundleBackend } from '@episensor/app-framework/desktop';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await bundleBackend({
  entryPoint: path.join(__dirname, '../dist/index.js'),
  outDir: path.join(__dirname, '../src-tauri/resources'),
  appName: 'MyApp',
  version: '1.0.0',
  format: 'cjs',
  nativeModules: {
    autoDetect: true,
    modules: ['serialport'], // Additional native modules
    rebuild: false
  }
});
```

### 3. Add to package.json

```json
{
  "scripts": {
    "bundle:desktop": "node scripts/bundle-desktop.js"
  }
}
```

## Configuration Options

### BundleOptions

```typescript
interface BundleOptions {
  // Required
  entryPoint: string;      // Path to compiled JS entry point
  outDir: string;          // Output directory for bundle
  appName: string;         // Application name
  version: string;         // Application version
  
  // Optional
  platform?: 'node' | 'neutral';  // Target platform (default: 'node')
  target?: string;                 // Node version (default: 'node18')
  format?: 'cjs' | 'esm';         // Module format (default: 'cjs')
  minify?: boolean;                // Minify output (default: false)
  sourcemap?: boolean;             // Generate sourcemaps (default: false)
  external?: string[];             // Additional external modules
  env?: Record<string, string>;    // Environment variables to inject
  
  // Resources
  resources?: {
    config?: string;      // Config file to copy
    data?: string[];      // Data directories to create
  };
  
  // Native modules handling
  nativeModules?: {
    autoDetect?: boolean;   // Auto-detect native modules
    modules?: string[];     // Explicit native modules list
    rebuild?: boolean;      // Rebuild for target platform
  };
}
```

## Handling Native Modules

Native modules (like `serialport`, `bcrypt`, etc.) require special handling as they contain compiled binary code.

### Auto-Detection

The bundler can automatically detect native modules:

```javascript
{
  nativeModules: {
    autoDetect: true
  }
}
```

### Manual Specification

Or you can specify them manually:

```javascript
{
  nativeModules: {
    modules: ['serialport', '@serialport/bindings-cpp', 'bcrypt']
  }
}
```

### Common Native Modules

The framework includes a list of common native modules:
- `serialport` - Serial port communication
- `bcrypt` - Password hashing
- `better-sqlite3` - SQLite database
- `canvas` - Canvas rendering
- `sharp` - Image processing
- `node-pty` - Terminal emulation
- `usb` - USB device access
- `node-hid` - HID device access

## Tauri Integration

### Backend Manager

Use the `BackendManager` class to manage the backend process:

```typescript
import { BackendManager } from '@episensor/app-framework/desktop';

const backend = new BackendManager({
  executable: '../resources/backend.js',
  args: ['--port', '8080'],
  env: {
    NODE_ENV: 'production',
    DESKTOP_MODE: 'true'
  },
  healthCheck: {
    url: 'http://localhost:8080/health',
    interval: 5000,
    timeout: 3000
  }
});

// Start backend
await backend.start();

// Stop backend
await backend.stop();
```

### IPC Bridge

Communicate between frontend and backend:

```typescript
import { IPCBridge } from '@episensor/app-framework/desktop';

const ipc = new IPCBridge();

// Frontend -> Backend
const response = await ipc.invoke('api-request', {
  method: 'GET',
  path: '/api/data'
});

// Listen for backend events
ipc.on('backend-event', (data) => {
  console.log('Received from backend:', data);
});
```

## Project Structure

Recommended project structure for desktop apps:

```
my-app/
├── src/                 # Source code
│   ├── index.ts        # Backend entry point
│   └── ...
├── web/                # Frontend code
│   ├── src/
│   └── dist/           # Built frontend
├── src-tauri/          # Tauri app
│   ├── src/            # Rust code
│   ├── resources/      # Bundled backend
│   │   ├── backend.js  # Bundled backend
│   │   ├── native-loader.js
│   │   └── node_modules/  # Native modules
│   └── tauri.conf.json
├── scripts/
│   └── bundle-desktop.js
└── package.json
```

## Complete Example

### 1. Backend Entry Point (`src/index.ts`)

```typescript
import { StandardServer } from '@episensor/app-framework';
import express from 'express';

const server = new StandardServer({
  appName: 'MyApp',
  port: process.env.PORT || 8080,
  enableWebSocket: true
});

const app = express();

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from backend!' });
});

await server.initialize(app);
await server.start();
```

### 2. Bundle Script (`scripts/bundle-desktop.js`)

```javascript
import { bundleBackend } from '@episensor/app-framework/desktop';
import { execSync } from 'child_process';
import path from 'path';

// Build TypeScript first
console.log('Building TypeScript...');
execSync('npm run build', { stdio: 'inherit' });

// Bundle for desktop
await bundleBackend({
  entryPoint: './dist/index.js',
  outDir: './src-tauri/resources',
  appName: 'MyApp',
  version: '1.0.0',
  format: 'cjs',
  nativeModules: {
    autoDetect: true
  },
  resources: {
    config: './config',
    data: ['storage', 'logs']
  }
});

console.log('✅ Desktop bundle created!');
```

### 3. Tauri Configuration (`src-tauri/tauri.conf.json`)

```json
{
  "build": {
    "beforeDevCommand": "npm run dev:web",
    "beforeBuildCommand": "npm run build:all",
    "devPath": "http://localhost:3000",
    "distDir": "../web/dist"
  },
  "bundle": {
    "resources": [
      "resources/**/*"
    ]
  }
}
```

### 4. Frontend Integration (`web/src/App.tsx`)

```typescript
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api';

function App() {
  const [backendStatus, setBackendStatus] = useState('starting');
  
  useEffect(() => {
    // Start backend
    invoke('start_backend').then(() => {
      setBackendStatus('running');
    });
    
    // Cleanup on unmount
    return () => {
      invoke('stop_backend');
    };
  }, []);
  
  return (
    <div>
      <h1>Desktop App</h1>
      <p>Backend: {backendStatus}</p>
    </div>
  );
}
```

## Troubleshooting

### Native Module Errors

If you get errors about missing native modules:

1. **Ensure modules are copied**: Check that native modules are in `resources/node_modules/`
2. **Rebuild if needed**: Use `rebuild: true` in native modules config
3. **Check externals**: Make sure native modules are in the `external` array

### Bundle Size

To reduce bundle size:
- Enable minification: `minify: true`
- Exclude unnecessary modules
- Use tree-shaking where possible

### Path Issues

For path resolution issues:
- Use `process.cwd()` instead of `__dirname`
- Ensure all paths are relative to the bundle location
- Set `DESKTOP_MODE` environment variable

### Port Conflicts

Handle port conflicts gracefully:

```typescript
const port = await findAvailablePort(8080, 8090);
process.env.PORT = port.toString();
```

## Advanced Topics

### Custom Native Module Loader

Create a custom loader for complex native module scenarios:

```javascript
import { createNativeModuleLoader } from '@episensor/app-framework/desktop';

await createNativeModuleLoader(
  './resources/native-loader.js',
  ['serialport', 'bcrypt', 'custom-module']
);
```

### Multi-Platform Builds

Build for different platforms:

```javascript
// Windows
await bundleBackend({
  ...options,
  target: 'node18-win-x64'
});

// macOS
await bundleBackend({
  ...options,
  target: 'node18-darwin-arm64'
});

// Linux
await bundleBackend({
  ...options,
  target: 'node18-linux-x64'
});
```

### Development vs Production

Handle different environments:

```javascript
const isDev = process.env.NODE_ENV === 'development';

await bundleBackend({
  ...options,
  minify: !isDev,
  sourcemap: isDev,
  env: {
    NODE_ENV: isDev ? 'development' : 'production',
    DEBUG: isDev ? 'true' : 'false'
  }
});
```

## Best Practices

1. **Always compile TypeScript first** before bundling
2. **Test bundle locally** before shipping
3. **Include health checks** for backend monitoring
4. **Handle graceful shutdown** in backend code
5. **Use environment variables** for configuration
6. **Keep native modules minimal** to reduce complexity
7. **Version your bundles** for easier debugging
8. **Monitor bundle size** to ensure reasonable download sizes

## API Reference

See the [API documentation](./api/desktop.md) for detailed method signatures and options.