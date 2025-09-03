# Complete Desktop App Packaging Guide

This guide covers the complete process for packaging Node.js applications as standalone desktop apps using Tauri, based on lessons learned from real-world implementation.

## 🎯 **What You Get**

- ✅ **Standalone Desktop Apps**: No Node.js installation required
- ✅ **Cross-Platform**: macOS (ARM64/x64), Windows x64, Linux x64
- ✅ **Platform-Specific Data**: Proper app data directories
- ✅ **Automatic Logging**: File-based logs in correct locations  
- ✅ **Complete CI/CD**: Automated builds and releases
- ✅ **Zero Manual Setup**: Framework handles everything automatically

## 🚀 **Quick Start**

### For New Applications

When creating a new app from the template:

```typescript
import { StandardServer } from '@episensor/app-framework';

const server = new StandardServer({
  appName: 'My Awesome App',
  appVersion: '1.0.0',
  description: 'A comprehensive desktop application',
  port: 8080,
  webPort: 5173,
  // Desktop integration is AUTOMATIC when TAURI=1 is detected
  // appId will auto-generate as 'com.company.my-awesome-app'
  // Customize with: appId: 'com.yourcompany.your-app'
  
  onInitialize: async (app) => {
    // Your app setup here
  }
});

await server.initialize();
await server.start();
```

**That's it!** The framework automatically:
- Detects desktop environment (`TAURI=1`)
- Generates appropriate `appId`  
- Sets up CORS for Tauri origins
- Initializes enhanced logging with platform-specific paths
- Configures data storage in proper directories

### For Existing Applications

Update your existing app to use StandardServer:

```typescript
// OLD - Manual setup required
if (process.env.TAURI === '1') {
  const enhancedLogger = getEnhancedLogger;
  await enhancedLogger.initialize({
    appName: 'myapp',
    logsDir: getLogsPath()
  });
}

// NEW - Automatic setup
const server = new StandardServer({
  appName: 'My App',
  appVersion: '1.0.0',
  // Desktop integration happens automatically!
});
```

## 📁 **Data Storage Locations**

The framework automatically uses platform-specific directories:

| Platform | Location |
|----------|----------|
| **macOS** | `~/Library/Application Support/{appId}/` |
| **Windows** | `%APPDATA%/{appId}/` |  
| **Linux** | `~/.local/share/{appId}/` |

### Directory Structure
```
{app-data}/
├── logs/
│   ├── app-2024-01-15.log
│   └── app-2024-01-16.log
├── config.json
└── projects.json
```

## 🏗️ **Build Pipeline**

### Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "build": "npm run build:api && npm run build:web",
    "build:api": "tsc",
    "build:web": "cd web && npm run build",
    "build:sidecar": "npm run build:api && npx esbuild dist/index.js --bundle --platform=node --target=node20 --format=cjs --outfile=dist/server/bundle.cjs --external:sharp --external:canvas --external:bufferutil --external:utf-8-validate && npx pkg dist/server/bundle.cjs --targets node20-macos-arm64,node20-macos-x64,node20-win-x64,node20-linux-x64 --output-path src-tauri/binaries --compress GZip",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "devDependencies": {
    "pkg": "^5.8.1"
  }
}
```

### Tauri Configuration

Update your `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeBuildCommand": "VITE_API_URL=http://localhost:8080 npm run build && npm run build:sidecar",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../web/dist"
  },
  "bundle": {
    "resources": {
      "binaries/server-*": "./server"
    }
  }
}
```

### Rust Sidecar Code

Your `src-tauri/src/main.rs` should include:

```rust
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Debug)]
struct BackendProcess(Mutex<Option<Child>>);

#[tauri::command]
async fn start_backend(app: AppHandle, state: State<'_, BackendProcess>) -> Result<(), String> {
    let mut process_guard = state.0.lock().unwrap();
    
    if process_guard.is_some() {
        return Ok(());
    }

    if cfg!(debug_assertions) {
        println!("Development mode: Backend started separately");
        return Ok(());
    }

    // Production: Use bundled binary
    let resource_dir = app.path().resource_dir()
        .map_err(|e| format!("Failed to resolve resource directory: {}", e))?;

    let binary_name = if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") { "server-aarch64-apple-darwin" }
        else { "server-x86_64-apple-darwin" }
    } else if cfg!(target_os = "windows") {
        "server-x86_64-pc-windows-msvc.exe"
    } else {
        "server-x86_64-unknown-linux-gnu"
    };

    let server_path = resource_dir.join("binaries").join(binary_name);
    
    let child = Command::new(&server_path)
        .env("TAURI", "1")
        .env("NODE_ENV", "production")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    *process_guard = Some(child);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                let backend_state = app_handle.state::<BackendProcess>();
                if let Err(e) = start_backend(app_handle.clone(), backend_state).await {
                    eprintln!("Failed to start backend: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 🤖 **CI/CD Integration**

### Complete CI Workflow

```yaml
name: Build and Release

on:
  push:
    tags: ['v*']

jobs:
  build-tauri:
    strategy:
      matrix:
        include:
          - platform: 'macos-latest'
            target: 'aarch64-apple-darwin'
          - platform: 'macos-latest' 
            target: 'x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            target: 'x86_64-unknown-linux-gnu'
          - platform: 'windows-latest'
            target: 'x86_64-pc-windows-msvc'
    
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install Node dependencies
        run: |
          npm ci
          cd web && npm ci

      - name: Bundle sidecar server
        run: npm run build:sidecar

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Release ${{ github.ref_name }}'
          args: --target ${{ matrix.target }}
```

## 🔧 **Troubleshooting**

### Common Issues

**❌ "Server binary not found"**
- Ensure `npm run build:sidecar` runs before Tauri build
- Check `src-tauri/binaries/` directory contains server binaries
- Verify Tauri config includes correct resources mapping

**❌ "Logs not appearing in desktop app"**  
- Fixed in framework v3.7.4+ - StandardServer automatically initializes enhanced logging
- For older versions: manually initialize enhanced logger when `TAURI=1`

**❌ "WebSocket disconnected"**
- Ensure `VITE_API_URL=http://localhost:8080` in build command
- Check CORS origins include Tauri origins (automatic in StandardServer)

**❌ "Data stored in wrong directory"**
- Framework automatically uses platform-specific paths when `enableDesktopIntegration: true`
- Triggered automatically when `TAURI=1` environment is detected

### Debug Mode

Enable debug logging:
```bash
TAURI=1 LOG_LEVEL=debug ./your-app
```

Check logs location:
```bash
# macOS
ls ~/Library/Application Support/com.company.your-app/logs/

# Windows  
dir %APPDATA%\com.company.your-app\logs\

# Linux
ls ~/.local/share/com.company.your-app/logs/
```

## 📚 **Migration Guide**

### From Manual Desktop Setup

**Before:**
```typescript
// Manual CORS setup
if (process.env.TAURI === '1') {
  app.use(cors({ origin: ['tauri://localhost'] }));
}

// Manual logging setup
if (isDesktopApp()) {
  await enhancedLogger.initialize({
    logsDir: getLogsPath()
  });
}

// Manual config paths
const configPath = isDesktopApp() 
  ? path.join(getAppDataPath(), 'config.json')
  : './config/default.json';
```

**After:**
```typescript
// Everything handled automatically!
const server = new StandardServer({
  appName: 'My App',
  appVersion: '1.0.0'
});
```

### From Express + Socket.io

**Before:**
```typescript
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });

app.use(cors(corsOptions));
// ... lots of manual setup
```

**After:**  
```typescript
const server = new StandardServer({
  appName: 'My App',
  appVersion: '1.0.0',
  enableWebSocket: true,
  
  onInitialize: async (app) => {
    // Your routes here
  }
});
```

## 🎉 **What's New**

### Framework v3.7.4+ Enhancements

- **Automatic Desktop Detection**: No need to manually set `enableDesktopIntegration: true`
- **Auto-Generated App IDs**: Automatically creates `com.company.{app-name}` (customizable)
- **Automatic Enhanced Logging**: File logging works out of the box in desktop apps
- **Simplified Configuration**: Minimal config required for full desktop functionality

### Application Template Improvements

- **Modern StandardServer**: Uses latest framework patterns
- **Complete Rust Integration**: Proper sidecar binary management
- **Updated CI/CD**: Includes sidecar bundling in build pipeline
- **Cross-Platform Binaries**: Builds for all supported platforms

## 🔮 **Future Improvements**

- **Auto-Update Integration**: Built-in update checking and installation
- **Crash Reporting**: Automatic error reporting and recovery
- **Performance Monitoring**: Built-in metrics and monitoring
- **Plugin System**: Extensible desktop functionality

---

## 📞 **Support**

For issues with desktop packaging:

1. Check this guide first
2. Verify you're using StandardServer from framework v3.7.4+
3. Test the build pipeline with `npm run build:sidecar`
4. Check CI/CD logs for build failures
5. Report issues with full logs and system information

The framework now handles 95% of desktop integration automatically. Focus on your app logic, not packaging complexity! 🚀