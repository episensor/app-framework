# Tauri Desktop Applications Guide

## Overview
This guide explains how to build desktop applications using Tauri with the EpiSensor App Framework.

## Quick Start

### 1. Add Tauri to Your Project

```bash
npm install --save-dev @tauri-apps/cli
```

### 2. Initialize Tauri

```bash
npx tauri init
```

When prompted:
- App name: Your application name
- Window title: Your window title  
- Web assets: `../dist` (or your build output)
- Dev server: `http://localhost:7001` (or your dev port)
- Dev command: `npm run dev`
- Build command: `npm run build`

### 3. Add Build Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "build:sidecar": "episensor build-tauri"
  }
}
```

Or generate a custom script:

```bash
npx episensor build-tauri --generate-script
```

## Building the Sidecar

The framework provides a `build-tauri` command that handles all the complexities of building Node.js sidecars for Tauri:

```bash
# Build with defaults
npx episensor build-tauri

# Custom entry point
npx episensor build-tauri --entry dist/server/index.js

# Specific platforms only
npx episensor build-tauri --platforms macos-arm64,win-x64

# Additional external modules
npx episensor build-tauri --externals my-native-module,another-module
```

### Options

- `--entry <path>`: Entry point (default: `dist/index.js`)
- `--output <path>`: Output directory (default: `src-tauri/binaries`)
- `--node-version <version>`: Node version (default: `18`)
- `--platforms <list>`: Platforms to build (default: `macos-arm64,win-x64,linux-x64`)
- `--no-compress`: Disable GZip compression
- `--externals <modules>`: Additional external modules
- `--generate-script`: Generate package.json script

## Programmatic API

You can also use the bundler programmatically:

```typescript
import { buildTauriSidecar } from '@episensor/app-framework';

await buildTauriSidecar({
  entryPoint: 'dist/index.js',
  platforms: ['macos-arm64', 'win-x64'],
  externals: ['my-native-module']
});
```

## Cross-Platform Data Storage

### Platform-Specific Paths

Desktop apps should store data in platform-specific locations:

- **macOS**: `~/Library/Application Support/[app-name]/`
- **Windows**: `%APPDATA%/[app-name]/`
- **Linux**: `~/.config/[app-name]/`

### Implementation

Use the framework's utilities:

```typescript
import { getAppDataPath, isDesktopApp } from '@episensor/app-framework';

// In your app's utility file
export function getDataPath(subPath?: string): string {
  if (isDesktopApp()) {
    const basePath = getAppDataPath('com.yourcompany.appname', 'appname');
    return subPath ? path.join(basePath, subPath) : basePath;
  } else {
    const basePath = path.join(process.cwd(), 'data');
    return subPath ? path.join(basePath, subPath) : basePath;
  }
}
```

## Tauri Configuration

### Update `tauri.conf.json`

```json
{
  "bundle": {
    "resources": {
      "binaries/server-*": "./server/"
    }
  },
  "tauri": {
    "bundle": {
      "identifier": "com.yourcompany.appname",
      "icon": ["icons/icon.ico", "icons/icon.png", "icons/icon.icns"]
    }
  }
}
```

### Start the Sidecar

In `src-tauri/src/main.rs`, add code to start your Node.js sidecar:

```rust
use tauri::api::process::Command;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let resource_path = app.path_resolver()
                .resource_dir()
                .expect("failed to resolve resource dir");
            
            let server_path = resource_path.join("server").join(
                if cfg!(target_os = "windows") {
                    "server-x86_64-pc-windows-msvc.exe"
                } else if cfg!(target_os = "macos") {
                    "server-aarch64-apple-darwin"
                } else {
                    "server-x86_64-unknown-linux-gnu"
                }
            );
            
            Command::new(server_path)
                .spawn()
                .expect("failed to start sidecar");
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Native Module Handling

### Common Issues

#### SerialPort and Other Native Modules

If your app uses native modules like `serialport`:

1. For `modbus-serial`, use the no-serial-port variant:
   ```json
   {
     "dependencies": {
       "modbus-serial": "8.0.21-no-serial-port"
     }
   }
   ```

2. Mark native modules as external in the build:
   ```bash
   npx episensor build-tauri --externals serialport
   ```

#### Sharp Image Processing

Sharp is automatically marked as external. Ensure your Tauri app bundles the Sharp binaries if needed.

## Testing

### Development Mode

```bash
# Terminal 1: Start your dev server
npm run dev

# Terminal 2: Run Tauri in dev mode
npm run tauri:dev
```

### Test Binary Directly

```bash
# macOS
./src-tauri/binaries/server-aarch64-apple-darwin

# Windows
./src-tauri/binaries/server-x86_64-pc-windows-msvc.exe

# Linux
./src-tauri/binaries/server-x86_64-unknown-linux-gnu
```

### Production Build

```bash
# Build your app
npm run build

# Build the sidecar
npm run build:sidecar

# Build Tauri app
npm run tauri:build
```

## Troubleshooting

### Port Configuration

Ensure consistent ports across:
- `package.json` devServer config
- `tauri.conf.json` devPath
- Your application's API configuration

### Binary Not Found

If Tauri can't find the sidecar:
1. Check binary exists in `src-tauri/binaries/`
2. Verify the name matches Tauri's platform expectations
3. Ensure execute permissions: `chmod +x src-tauri/binaries/server-*`

### Module Not Found Errors

For `ERR_MODULE_NOT_FOUND`:
1. Ensure all dependencies are installed
2. Mark problematic modules as external
3. Use CommonJS output format (handled automatically by the framework)

## Example Projects

- **VPP Manager**: Virtual Power Plant management system
- **CPCodebase**: Code management and sharing tool
- **Modbus Simulator**: Industrial protocol simulator

All use the same Tauri bundling approach provided by this framework.