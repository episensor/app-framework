/**
 * Tauri Sidecar Support for Node.js Server Bundling
 *
 * This module provides utilities for bundling Node.js servers as Tauri sidecars,
 * allowing desktop apps to include their backend servers as standalone binaries.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { ensureDir, readJson, writeFile } from "../utils/fs-utils.js";
import path from "path";

const execAsync = promisify(exec);

export interface SidecarBuildOptions {
  /**
   * Path to the compiled server entry file (e.g., dist/server/index.js)
   */
  entryFile: string;

  /**
   * Output directory for the sidecar binaries (default: src-tauri/binaries)
   */
  outputDir?: string;

  /**
   * Target platforms to build for
   */
  targets?: SidecarTarget[];

  /**
   * Whether to compress the output
   */
  compress?: boolean;

  /**
   * Node.js version to target (default: node20)
   */
  nodeVersion?: string;
}

export interface SidecarTarget {
  platform: "macos" | "windows" | "linux";
  arch: "x64" | "arm64";
}

/**
 * Default targets for common platforms
 */
export const DEFAULT_TARGETS: SidecarTarget[] = [
  { platform: "macos", arch: "arm64" },
  { platform: "macos", arch: "x64" },
  { platform: "windows", arch: "x64" },
  { platform: "linux", arch: "x64" },
];

/**
 * Map platform/arch combinations to pkg target strings
 */
const TARGET_MAP: Record<string, string> = {
  "macos-arm64": "node20-macos-arm64",
  "macos-x64": "node20-macos-x64",
  "windows-x64": "node20-win-x64",
  "linux-x64": "node20-linux-x64",
};

/**
 * Map platform/arch combinations to Tauri binary names
 */
const BINARY_NAME_MAP: Record<string, string> = {
  "macos-arm64": "server-aarch64-apple-darwin",
  "macos-x64": "server-x86_64-apple-darwin",
  "windows-x64": "server-x86_64-pc-windows-gnu.exe",
  "linux-x64": "server-x86_64-unknown-linux-gnu",
};

/**
 * Build a Node.js server as a Tauri sidecar binary
 */
export async function buildSidecar(
  options: SidecarBuildOptions,
): Promise<void> {
  const {
    entryFile,
    outputDir = "src-tauri/binaries",
    targets = DEFAULT_TARGETS,
    compress = true,
    nodeVersion = "node20",
  } = options;

  // Ensure output directory exists
  await ensureDir(outputDir);

  // Check if pkg is installed
  try {
    await execAsync("npx pkg --version");
  } catch (_error) {
    throw new Error(
      "pkg is not installed. Install it with: npm install --save-dev @yao-pkg/pkg",
    );
  }

  // Build for each target
  for (const target of targets) {
    const targetKey = `${target.platform}-${target.arch}`;
    const pkgTarget = TARGET_MAP[targetKey];
    const outputName = BINARY_NAME_MAP[targetKey];

    if (!pkgTarget || !outputName) {
      console.warn(`Unsupported target: ${targetKey}`);
      continue;
    }

    const outputPath = path.join(outputDir, outputName);

    console.log(`Building sidecar for ${targetKey}...`);

    const pkgCommand = [
      "npx pkg",
      entryFile,
      "--target",
      pkgTarget.replace("node20", nodeVersion),
      "--output",
      outputPath,
      compress ? "--compress GZip" : "",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const { stdout, stderr } = await execAsync(pkgCommand);
      if (stdout) console.log(stdout);
      if (stderr) console.warn(stderr);

      // Make the binary executable on Unix systems
      if (target.platform !== "windows") {
        await import('fs').then(fs => fs.promises.chmod(outputPath, 0o755));
      }

      console.log(`✅ Built ${outputName} (${targetKey})`);
    } catch (_error: any) {
      console.error(`❌ Failed to build ${targetKey}: ${_error.message}`);
    }
  }
}

/**
 * Generate Tauri configuration for sidecar resources
 */
export function generateTauriConfig(): any {
  return {
    bundle: {
      resources: {
        "binaries/server-*": "./server",
      },
    },
  };
}

/**
 * Generate Rust code for starting the sidecar server
 */
export function generateRustServerModule(): string {
  return `use std::process::Child;
use std::sync::Mutex;
use tauri::{State, AppHandle, Manager};
use tauri::plugin::{Builder, TauriPlugin};

pub struct ServerState {
    pub process: Mutex<Option<Child>>,
}

#[tauri::command]
pub fn start_backend_server(app: AppHandle, state: State<ServerState>) -> Result<String, String> {
    let mut process = state.process.lock().unwrap();
    
    if process.is_some() {
        return Ok("Server already running".to_string());
    }
    
    // Get the path to the sidecar binary
    let server_path = app
        .path()
        .resource_dir()
        .expect("failed to resolve resource directory")
        .join("server");
    
    #[cfg(target_os = "macos")]
    let server_binary = if cfg!(target_arch = "aarch64") {
        server_path.join("server-aarch64-apple-darwin")
    } else {
        server_path.join("server-x86_64-apple-darwin")
    };
    
    #[cfg(target_os = "windows")]
    let server_binary = server_path.join("server-x86_64-pc-windows-gnu.exe");
    
    #[cfg(target_os = "linux")]
    let server_binary = server_path.join("server-x86_64-unknown-linux-gnu");
    
    // Start the sidecar server
    let child = std::process::Command::new(&server_binary)
        .env("NODE_ENV", "production")
        .env("PORT", std::env::var("SERVER_PORT").unwrap_or_else(|_| "3005".to_string()))
        .env("HOST", "127.0.0.1")
        .env("TAURI", "1")
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;
    
    *process = Some(child);
    
    // Wait for server to be ready
    std::thread::sleep(std::time::Duration::from_secs(2));
    
    Ok("Server started".to_string())
}

#[tauri::command]
pub fn stop_backend_server(state: State<ServerState>) -> Result<String, String> {
    let mut process = state.process.lock().unwrap();
    
    if let Some(mut child) = process.take() {
        child.kill().map_err(|e| format!("Failed to stop server: {}", e))?;
        Ok("Server stopped".to_string())
    } else {
        Ok("Server not running".to_string())
    }
}

#[tauri::command]
pub fn check_server_status(app: AppHandle) -> Result<bool, String> {
    let port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "3005".to_string());
    let url = format!("http://localhost:{}/api/health", port);
    
    // Use a simple HTTP request to check server status
    match ureq::get(&url).timeout(std::time::Duration::from_secs(2)).call() {
        Ok(response) => Ok(response.status() == 200),
        Err(_) => Ok(false),
    }
}

pub fn init<R: tauri::Runtime>() -> TauriPlugin<R> {
    Builder::new("server")
        .invoke_handler(tauri::generate_handler![
            start_backend_server,
            stop_backend_server,
            check_server_status
        ])
        .setup(|app, _api| {
            app.manage(ServerState {
                process: Mutex::new(None),
            });
            
            // Auto-start server in production
            #[cfg(not(debug_assertions))]
            {
                let app_handle = app.clone();
                let state = app.state::<ServerState>();
                if let Err(e) = start_backend_server(app_handle, state) {
                    eprintln!("Failed to start backend server: {}", e);
                }
            }
            
            Ok(())
        })
        .build()
}`;
}

/**
 * Create a wrapper script for the server to handle top-level await
 */
export async function createServerWrapper(
  inputFile: string,
  outputFile: string,
): Promise<void> {
  const wrapperCode = `
// Auto-generated server wrapper for Tauri sidecar
// This wrapper ensures compatibility with pkg bundling

async function main() {
  try {
    await import('./${path.basename(inputFile)}');
  } catch (_error) {
    console.error('Server failed to start:', _error);
    process.exit(1);
  }
}

main().catch(console.error);
`;

  await writeFile(outputFile, wrapperCode);
}

/**
 * CLI command to build sidecar for current project
 */
export async function buildSidecarCLI(args: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const packageJson = await readJson(path.join(projectRoot, "package.json"));

  // Default configuration
  const config: SidecarBuildOptions = {
    entryFile: "dist/server/index.js",
    outputDir: "src-tauri/binaries",
    compress: true,
    targets: DEFAULT_TARGETS,
  };

  // Override with package.json configuration
  if (packageJson.sidecar) {
    Object.assign(config, packageJson.sidecar);
  }

  // Parse CLI arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--entry":
        config.entryFile = args[++i];
        break;
      case "--output":
        config.outputDir = args[++i];
        break;
      case "--no-compress":
        config.compress = false;
        break;
      case "--target": {
        const [platform, arch] = args[++i].split("-") as [string, string];
        config.targets = [
          {
            platform: platform as any,
            arch: arch as any,
          },
        ];
        break;
      }
    }
  }

  console.log("Building Tauri sidecar with configuration:");
  console.log(JSON.stringify(config, null, 2));

  await buildSidecar(config);
}
