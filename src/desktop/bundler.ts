/**
 * Desktop Bundler Module
 * Handles bundling Node.js backends for Tauri desktop applications
 */

import * as esbuild from "esbuild";
import { ensureDir, writeFile, stat, copy, move, remove, writeJson } from "../utils/fs-utils.js";
import path from "path";
import { execSync } from "child_process";
import { createLogger } from "../core/index.js";
import {
  detectNativeModules,
  copyNativeModules,
  createNativeModuleLoader,
} from "./native-modules.js";

const logger = createLogger("DesktopBundler");

export interface BundleOptions {
  entryPoint: string;
  outDir: string;
  appName: string;
  version: string;
  platform?: "node" | "neutral";
  target?: string;
  format?: "cjs" | "esm";
  minify?: boolean;
  sourcemap?: boolean;
  external?: string[];
  env?: Record<string, string>;
  resources?: {
    config?: string;
    data?: string[];
  };
  nativeModules?: {
    autoDetect?: boolean;
    modules?: string[];
    rebuild?: boolean;
  };
}

/**
 * Bundle a Node.js backend for desktop deployment
 */
export async function bundleBackend(options: BundleOptions): Promise<void> {
  const {
    entryPoint,
    outDir,
    appName,
    version,
    platform = "node",
    target = "node18",
    format = "cjs",
    minify = false,
    sourcemap = false,
    external = [],
    env = {},
    resources = {},
  } = options;

  logger.info(`Bundling backend for ${appName} v${version}`);

  // Ensure output directory exists
  await ensureDir(outDir);

  // Default externals for Node.js
  const defaultExternals = [
    "fsevents", // Mac-specific, optional
    "bufferutil", // Optional WebSocket performance
    "utf-8-validate", // Optional WebSocket validation
    "@episensor/app-framework/ui", // UI components not needed in backend
    "serialport", // Optional serial port support
    "@serialport/bindings-cpp", // Optional serial port bindings
    "@aws-sdk/client-s3", // Optional AWS S3 support
    "modbus-serial", // Optional Modbus communication
  ];

  // Build with esbuild
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    platform,
    target,
    outfile: path.join(outDir, "backend.js"),
    format,
    minify,
    sourcemap,
    external: [...defaultExternals, ...external],
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.DESKTOP_MODE": '"true"',
      ...Object.entries(env).reduce(
        (acc, [key, value]) => {
          acc[`process.env.${key}`] = JSON.stringify(value);
          return acc;
        },
        {} as Record<string, string>,
      ),
    },
    loader: {
      ".node": "file",
      ".json": "json",
    },
    metafile: true,
    logLevel: "info",
  });

  // Write metafile for analysis
  await writeFile(
    path.join(outDir, "backend-meta.json"),
    JSON.stringify(result.metafile, null, 2),
  );

  // Create wrapper script
  const wrapperScript = generateWrapperScript(appName, format);
  await writeFile(path.join(outDir, "start-backend.js"), wrapperScript);

  // Copy resources
  if (resources.config) {
    const configDest = path.join(outDir, "config");
    await ensureDir(configDest);
    await copy(resources.config, path.join(configDest, "app.json"));
  }

  if (resources.data) {
    const dataDir = path.join(outDir, "data");
    for (const dir of resources.data) {
      await ensureDir(path.join(dataDir, dir));
    }
  }

  // Handle native modules if configured
  if (options.nativeModules) {
    const projectDir = path.dirname(entryPoint);

    // Detect native modules if requested
    let nativeModulesList = options.nativeModules.modules || [];
    if (options.nativeModules.autoDetect) {
      const detected = await detectNativeModules(projectDir);
      nativeModulesList = [...new Set([...nativeModulesList, ...detected])];
      logger.info(`Detected native modules: ${nativeModulesList.join(", ")}`);
    }

    // Copy native modules to output directory
    if (nativeModulesList.length > 0) {
      await copyNativeModules({
        modules: nativeModulesList,
        sourceDir: projectDir,
        targetDir: outDir,
        rebuild: options.nativeModules.rebuild,
      });

      // Create native module loader
      await createNativeModuleLoader(
        path.join(outDir, "native-loader.js"),
        nativeModulesList,
      );

      logger.info(`Copied ${nativeModulesList.length} native modules`);
    }
  }

  // Get bundle size
  const stats = await stat(path.join(outDir, "backend.js"));
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

  logger.info(`✅ Backend bundled successfully!`);
  logger.info(`   Bundle size: ${sizeMB} MB`);
  logger.info(`   Location: ${outDir}/backend.js`);
}

/**
 * Generate wrapper script for starting the bundled backend
 */
function generateWrapperScript(appName: string, format: "cjs" | "esm"): string {
  return `#!/usr/bin/env node

/**
 * Desktop App Backend Wrapper for ${appName}
 * Sets up environment and starts the bundled backend
 */

${format === "esm" ? "import { fileURLToPath } from 'url';" : ""}
${format === "esm" ? "import { dirname, join } from 'path';" : "const path = require('path');"}

${
  format === "esm"
    ? `
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
`
    : ""
}

// Set environment variables
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.DESKTOP_MODE = 'true';

// Set data directory to app data location
if (!process.env.DATA_DIR) {
  // In production, this will be set by Tauri
  // For testing, use a local data directory
  process.env.DATA_DIR = ${format === "esm" ? "join" : "path.join"}(__dirname, 'data');
}

console.log('Starting ${appName} Backend...');
console.log('Data directory:', process.env.DATA_DIR);

// Start the bundled backend
${format === "cjs" ? "require('./backend.js');" : "import('./backend.js');"}
`;
}

/**
 * Bundle dependencies separately for better caching
 */
export async function bundleDependencies(
  packageJsonPath: string,
  outDir: string,
): Promise<void> {
  const fs = await import('fs');
  const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
  const dependencies = packageJson.dependencies || {};

  logger.info("Installing production dependencies...");

  // Create temporary directory for dependencies
  const tempDir = path.join(outDir, "temp");
  await ensureDir(tempDir);

  // Create minimal package.json
  const minimalPackage = {
    name: packageJson.name,
    version: packageJson.version,
    dependencies,
  };

  await writeJson(path.join(tempDir, "package.json"), minimalPackage);

  // Install production dependencies
  execSync("npm install --production --no-audit --no-fund", {
    cwd: tempDir,
    stdio: "inherit",
  });

  // Move node_modules to output directory
  await move(
    path.join(tempDir, "node_modules"),
    path.join(outDir, "node_modules"),
    { overwrite: true },
  );

  // Clean up temp directory
  await remove(tempDir);
}

/**
 * Create Tauri configuration for desktop app
 */
export async function createTauriConfig(
  projectDir: string,
  appName: string,
  version: string,
  identifier: string,
): Promise<void> {
  const tauriDir = path.join(projectDir, "src-tauri");
  await ensureDir(tauriDir);

  const config = {
    $schema:
      "https://raw.githubusercontent.com/tauri-apps/tauri/dev/tooling/cli/schema.json",
    productName: appName,
    version: version,
    identifier: identifier,
    build: {
      frontendDist: "../web/dist",
      devUrl: "http://localhost:5173",
      beforeDevCommand: "npm run dev:web",
      beforeBuildCommand: "npm run build:web && npm run bundle:backend",
    },
    app: {
      windows: [
        {
          title: appName,
          width: 1400,
          height: 900,
          resizable: true,
          fullscreen: false,
          center: true,
          minWidth: 1024,
          minHeight: 600,
        },
      ],
      security: {
        csp: null,
      },
      trayIcon: {
        iconPath: "icons/icon.png",
        menuOnLeftClick: false,
        tooltip: appName,
      },
    },
    bundle: {
      active: true,
      targets: "all",
      icon: [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico",
      ],
      resources: ["resources/**/*"],
      copyright: `© ${new Date().getFullYear()} EpiSensor`,
      category: "DeveloperTool",
      shortDescription: `${appName} Desktop Application`,
      longDescription: `${appName} - A cross-platform desktop application built with Tauri`,
    },
    plugins: {
      updater: {
        active: false,
      },
    },
  };

  await writeJson(path.join(tauriDir, "tauri.conf.json"), config, {
    spaces: 2,
  });

  logger.info(`Created Tauri configuration at ${tauriDir}/tauri.conf.json`);
}

/**
 * Initialize Tauri project structure
 */
export async function initializeTauriProject(
  projectDir: string,
): Promise<void> {
  const tauriDir = path.join(projectDir, "src-tauri");

  // Create directory structure
  await ensureDir(path.join(tauriDir, "src"));
  await ensureDir(path.join(tauriDir, "icons"));
  await ensureDir(path.join(tauriDir, "resources"));

  // Create main.rs with backend integration
  const mainRs = `// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use tauri::Manager;

#[tauri::command]
fn start_backend(app_handle: tauri::AppHandle) -> Result<String, String> {
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    
    let backend_path = resource_path.join("resources/backend/start-backend.js");
    
    // Start backend process
    Command::new("node")
        .arg(backend_path)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok("Backend started successfully".to_string())
}

#[tauri::command]
fn get_backend_status() -> String {
    "Backend running in bundled mode".to_string()
}

#[tauri::command]
fn get_api_url() -> String {
    std::env::var("API_URL").unwrap_or_else(|_| "http://localhost:8080".to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Start backend on app startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = start_backend(app_handle) {
                    eprintln!("Failed to start backend: {}", e);
                }
            });
            
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_backend_status,
            get_api_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`;

  await writeFile(path.join(tauriDir, "src", "main.rs"), mainRs);

  // Create Cargo.toml
  const cargoToml = `[package]
name = "app"
version = "0.1.0"
description = "A Tauri App"
authors = ["you"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
`;

  await writeFile(path.join(tauriDir, "Cargo.toml"), cargoToml);

  // Create build.rs
  const buildRs = `fn main() {
    tauri_build::build()
}
`;

  await writeFile(path.join(tauriDir, "build.rs"), buildRs);

  logger.info(`Initialized Tauri project structure at ${tauriDir}`);
}

export default {
  bundleBackend,
  bundleDependencies,
  createTauriConfig,
  initializeTauriProject,
};
