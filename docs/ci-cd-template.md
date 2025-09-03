# CI/CD Templates for Desktop Apps

Complete GitHub Actions workflows for building and releasing EpiSensor desktop applications.

## CI Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: |
          npm ci
          cd web && npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run tests
        run: npm run test

      - name: Build application
        run: npm run build

  build-tauri:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            target: 'aarch64-apple-darwin'
            name: 'aarch64-apple-darwin'
          - platform: 'macos-latest'
            target: 'x86_64-apple-darwin' 
            name: 'x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            target: 'x86_64-unknown-linux-gnu'
            name: 'x86_64-unknown-linux-gnu'
          - platform: 'windows-latest'
            target: 'x86_64-pc-windows-msvc'
            name: 'x86_64-pc-windows-msvc'
    
    runs-on: ${{ matrix.platform }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Rust stable
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

      - name: Build frontend
        run: npm run build:web

      - name: Bundle sidecar server
        run: npm run build:sidecar

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: test-build
          releaseName: 'Test Build'
          releaseBody: 'CI test build'
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}
```

## Release Workflow (`.github/workflows/release.yml`)

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag (e.g., v1.0.0)'
        required: true
        type: string

jobs:
  create-release:
    runs-on: ubuntu-latest
    outputs:
      release_id: ${{ steps.create_release.outputs.id }}
      upload_url: ${{ steps.create_release.outputs.upload_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Create Release
        id: create_release
        uses: softprops/action-gh-release@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref_name || github.event.inputs.tag }}
          name: Release ${{ github.ref_name || github.event.inputs.tag }}
          draft: true
          prerelease: false

  build-tauri:
    needs: create-release
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            target: 'aarch64-apple-darwin'
            name: 'macOS-AppleSilicon'
          - platform: 'macos-latest'
            target: 'x86_64-apple-darwin'
            name: 'macOS-Intel'
          - platform: 'ubuntu-22.04'
            target: 'x86_64-unknown-linux-gnu'
            name: 'Linux-x64'
          - platform: 'windows-latest'
            target: 'x86_64-pc-windows-msvc'
            name: 'Windows-x64'

    runs-on: ${{ matrix.platform }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Rust stable
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
          tagName: ${{ github.ref_name || github.event.inputs.tag }}
          releaseName: 'Release ${{ github.ref_name || github.event.inputs.tag }}'
          releaseBody: 'See the release notes for details.'
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}
```

## Required Package.json Scripts

Your `package.json` must include these scripts:

```json
{
  "scripts": {
    "build": "npm run build:api && npm run build:web",
    "build:api": "tsc",
    "build:web": "cd web && npm run build",
    "build:sidecar": "npm run build:api && npx esbuild dist/index.js --bundle --platform=node --target=node20 --format=cjs --outfile=dist/server/bundle.cjs --external:sharp --external:canvas --external:bufferutil --external:utf-8-validate && npx pkg dist/server/bundle.cjs --targets node20-macos-arm64,node20-macos-x64,node20-win-x64,node20-linux-x64 --output-path src-tauri/binaries --compress GZip",
    "lint": "eslint src/ --ext .ts",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "devDependencies": {
    "pkg": "^5.8.1"
  }
}
```

## Required Tauri Configuration

Your `src-tauri/tauri.conf.json` needs:

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

## Required Rust Sidecar Code

Your `src-tauri/src/lib.rs` should include server management:

```rust
use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use tauri::{State, AppHandle};

pub struct ApiServerState {
    process: Mutex<Option<Child>>,
}

#[tauri::command]
pub fn start_api_server(state: State<ApiServerState>, app_handle: AppHandle) -> Result<String, String> {
    let mut process = state.process.lock().unwrap();
    
    if process.is_some() {
        return Ok("API server already running".to_string());
    }
    
    let resource_dir = app_handle
        .path_resolver()
        .resolve_resource("")
        .ok_or("Failed to resolve resource directory")?;
    
    let binary_name = if cfg!(target_os = "macos") {
        if cfg!(target_arch = "aarch64") {
            "server-aarch64-apple-darwin"
        } else {
            "server-x86_64-apple-darwin"
        }
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
        .map_err(|e| format!("Failed to start server binary: {}", e))?;
    
    *process = Some(child);
    Ok("Server started".to_string())
}
```

## Directory Structure

Ensure these directories exist:
- `src-tauri/binaries/` (created automatically by build process)
- `dist/server/` (created automatically by build process)

## Key Features

- ✅ Cross-platform builds (macOS ARM64/x64, Windows x64, Linux x64)
- ✅ Automatic Node.js server bundling with pkg
- ✅ Proper CORS configuration for desktop apps
- ✅ Platform-specific data storage paths
- ✅ Comprehensive release automation
- ✅ Asset naming with version and architecture