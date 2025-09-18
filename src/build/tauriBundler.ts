/**
 * Tauri Desktop App Bundler
 * Centralized utilities for building Tauri sidecars with proper handling of native modules
 */

import { execSync } from "child_process";
import path from "path";
import { ensureDir, pathExists, move } from "../utils/fs-utils.js";
import { createLogger } from "../core/logger.js";
const logger = createLogger('tauriBundler');

export interface TauriBundleOptions {
  /** Entry point for the server (e.g., 'dist/index.js' or 'dist/server/index.js') */
  entryPoint?: string;
  /** Output directory for the bundled CJS file */
  bundleOutput?: string;
  /** Target Node.js version */
  nodeVersion?: string;
  /** Additional external modules to exclude from bundling */
  externals?: string[];
  /** Platforms to build for */
  platforms?: ("macos-arm64" | "win-x64" | "linux-x64")[];
  /** Output directory for binaries */
  binaryOutput?: string;
  /** Whether to use compression */
  compress?: boolean;
}

const DEFAULT_OPTIONS: Required<TauriBundleOptions> = {
  entryPoint: "dist/index.js",
  bundleOutput: "dist/server/bundle.cjs",
  nodeVersion: "18",
  externals: [],
  platforms: ["macos-arm64", "win-x64", "linux-x64"],
  binaryOutput: "src-tauri/binaries",
  compress: true,
};

/**
 * Standard external modules that should not be bundled
 */
const STANDARD_EXTERNALS = [
  "sharp",
  "canvas",
  "bufferutil",
  "utf-8-validate",
  "serialport",
];

/**
 * Platform-specific binary names for Tauri
 */
const PLATFORM_BINARY_NAMES = {
  "macos-arm64": "server-aarch64-apple-darwin",
  "win-x64": "server-x86_64-pc-windows-msvc.exe",
  "linux-x64": "server-x86_64-unknown-linux-gnu",
};

/**
 * Build Tauri sidecar binaries for all platforms
 */
export async function buildTauriSidecar(
  options: TauriBundleOptions = {},
): Promise<void> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  logger.info("🚀 Building Tauri sidecar...");

  // Step 1: Bundle with esbuild
  await bundleWithEsbuild(config);

  // Step 2: Compile with pkg
  await compileWithPkg(config);

  // Step 3: Rename binaries for Tauri
  await renameBinariesForTauri(config);

  logger.info("✅ Tauri sidecar build complete!");
}

/**
 * Bundle the application with esbuild
 */
async function bundleWithEsbuild(
  config: Required<TauriBundleOptions>,
): Promise<void> {
  logger.info("📦 Bundling with esbuild...");

  const allExternals = [...STANDARD_EXTERNALS, ...config.externals];
  const externalFlags = allExternals
    .map((ext) => `--external:${ext}`)
    .join(" ");

  const command = `npx esbuild ${config.entryPoint} --bundle --platform=node --target=node${config.nodeVersion} --format=cjs --outfile=${config.bundleOutput} ${externalFlags}`;

  try {
    execSync(command, { stdio: "inherit" });
    logger.info("✅ Bundle created successfully");
  } catch (_error) {
    logger.error("❌ Failed to bundle with esbuild");
    throw _error;
  }
}

/**
 * Compile the bundle with pkg
 */
async function compileWithPkg(
  config: Required<TauriBundleOptions>,
): Promise<void> {
  logger.info("🔨 Compiling with pkg...");

  const targets = config.platforms
    .map((platform) => {
      const [os, arch] = platform.split("-");
      const osMap: Record<string, string> = {
        macos: "macos",
        win: "win",
        linux: "linux",
      };
      return `node${config.nodeVersion}-${osMap[os]}-${arch}`;
    })
    .join(",");

  const compressFlag = config.compress ? "--compress GZip" : "";

  const command = `npx pkg ${config.bundleOutput} --targets ${targets} --out-path ${config.binaryOutput} ${compressFlag}`;

  try {
    // Ensure output directory exists
    await ensureDir(config.binaryOutput);

    execSync(command, { stdio: "inherit" });
    logger.info("✅ Binaries compiled successfully");
  } catch (_error) {
    logger.error("❌ Failed to compile with pkg");
    throw _error;
  }
}

/**
 * Rename binaries to match Tauri's expected names
 */
async function renameBinariesForTauri(
  config: Required<TauriBundleOptions>,
): Promise<void> {
  logger.info("🏷️  Renaming binaries for Tauri...");

  for (const platform of config.platforms) {
    const pkgName = getPkgOutputName(config.bundleOutput, platform);
    const tauriName = PLATFORM_BINARY_NAMES[platform];

    const sourcePath = path.join(config.binaryOutput, pkgName);
    const targetPath = path.join(config.binaryOutput, tauriName);

    if (await pathExists(sourcePath)) {
      await move(sourcePath, targetPath);
      logger.info(`  ✅ ${platform}: ${tauriName}`);
    } else {
      logger.warn(`  ⚠️  ${platform}: Binary not found at ${sourcePath}`);
    }
  }
}

/**
 * Get the output name that pkg generates for a given platform
 */
function getPkgOutputName(bundlePath: string, platform: string): string {
  const baseName = path.basename(bundlePath, ".cjs");

  switch (platform) {
    case "macos-arm64":
      return `${baseName}-macos-arm64`;
    case "win-x64":
      return `${baseName}-win-x64.exe`;
    case "linux-x64":
      return `${baseName}-linux-x64`;
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

/**
 * Generate the build:sidecar script for package.json
 */
export function generateBuildSidecarScript(
  options: TauriBundleOptions = {},
): string {
  const config = { ...DEFAULT_OPTIONS, ...options };

  const allExternals = [...STANDARD_EXTERNALS, ...config.externals];
  const externalFlags = allExternals
    .map((ext) => `--external:${ext}`)
    .join(" ");

  const targets = config.platforms
    .map((platform) => {
      const [os, arch] = platform.split("-");
      const osMap: Record<string, string> = {
        macos: "macos",
        win: "win",
        linux: "linux",
      };
      return `node${config.nodeVersion}-${osMap[os]}-${arch}`;
    })
    .join(",");

  const compressFlag = config.compress ? "--compress GZip" : "";

  // Build the rename commands
  const renameCommands: string[] = [];
  for (const platform of config.platforms) {
    const pkgName = getPkgOutputName(config.bundleOutput, platform);
    const tauriName = PLATFORM_BINARY_NAMES[platform];
    renameCommands.push(
      `[ -f ${pkgName} ] && mv ${pkgName} ${tauriName} || true`,
    );
  }

  return [
    "npm run build:backend",
    `npx esbuild ${config.entryPoint} --bundle --platform=node --target=node${config.nodeVersion} --format=cjs --outfile=${config.bundleOutput} ${externalFlags}`,
    `npx pkg ${config.bundleOutput} --targets ${targets} --out-path ${config.binaryOutput} ${compressFlag}`,
    `cd ${config.binaryOutput}`,
    ...renameCommands,
  ].join(" && ");
}
