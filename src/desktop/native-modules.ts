/**
 * Native Module Handler for Desktop Bundling
 * Manages native Node.js modules that can't be bundled
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

export interface NativeModuleConfig {
  /**
   * List of native modules to copy to resources
   */
  modules: string[];
  
  /**
   * Source node_modules directory
   */
  sourceDir: string;
  
  /**
   * Target resources directory
   */
  targetDir: string;
  
  /**
   * Whether to rebuild native modules for target platform
   */
  rebuild?: boolean;
  
  /**
   * Electron version (if rebuilding for Electron)
   */
  electronVersion?: string;
}

/**
 * Default native modules that commonly need special handling
 */
export const COMMON_NATIVE_MODULES = [
  'serialport',
  '@serialport/bindings-cpp',
  'node-pty',
  'bcrypt',
  'better-sqlite3',
  'canvas',
  'sharp',
  'fsevents',
  'usb',
  'node-hid'
];

/**
 * Copy native modules to resources directory
 */
export async function copyNativeModules(config: NativeModuleConfig): Promise<void> {
  const { modules, sourceDir, targetDir } = config;
  
  // Ensure target directory exists
  await fs.ensureDir(path.join(targetDir, 'node_modules'));
  
  for (const moduleName of modules) {
    const sourcePath = path.join(sourceDir, 'node_modules', moduleName);
    const targetPath = path.join(targetDir, 'node_modules', moduleName);
    
    if (await fs.pathExists(sourcePath)) {
      console.log(`📦 Copying native module: ${moduleName}`);
      await fs.copy(sourcePath, targetPath, {
        overwrite: true,
        dereference: true
      });
    } else {
      console.warn(`⚠️  Native module not found: ${moduleName}`);
    }
  }
}

/**
 * Rebuild native modules for target platform
 */
export async function rebuildNativeModules(
  targetDir: string,
  electronVersion?: string
): Promise<void> {
  console.log('🔨 Rebuilding native modules...');
  
  const cwd = targetDir;
  
  if (electronVersion) {
    // Rebuild for Electron
    try {
      execSync(
        `npx electron-rebuild -v ${electronVersion}`,
        { cwd, stdio: 'inherit' }
      );
    } catch (_error) {
      console.error('Failed to rebuild for Electron:', _error);
      throw error;
    }
  } else {
    // Rebuild for Node.js
    try {
      execSync('npm rebuild', { cwd, stdio: 'inherit' });
    } catch (_error) {
      console.error('Failed to rebuild native modules:', _error);
      throw error;
    }
  }
}

/**
 * Create a loader script that sets up paths for native modules
 */
export async function createNativeModuleLoader(
  outputPath: string,
  nativeModules: string[]
): Promise<void> {
  const loaderScript = `/**
 * Native Module Loader
 * Sets up require paths for native modules in desktop app
 */

const path = require('path');
const Module = require('module');

// Add native modules directory to Node module paths
const nativeModulesPath = path.join(__dirname, 'node_modules');
Module.globalPaths.push(nativeModulesPath);

// Patch require to handle native modules
const originalRequire = Module.prototype.require;
const nativeModules = ${JSON.stringify(nativeModules)};

Module.prototype.require = function(id) {
  // Check if this is a native module
  if (nativeModules.includes(id) || nativeModules.some(m => id.startsWith(m + '/'))) {
    try {
      // Try to load from native modules directory
      return originalRequire.apply(this, [path.join(nativeModulesPath, id)]);
    } catch (_error) {
      // Fall back to original require
      return originalRequire.apply(this, arguments);
    }
  }
  
  return originalRequire.apply(this, arguments);
};

// Export for use in main bundle
module.exports = { nativeModulesPath };
`;

  await fs.writeFile(outputPath, loaderScript, 'utf8');
}

/**
 * Check if a module is a native module
 */
export function isNativeModule(moduleName: string): boolean {
  try {
    const packageJsonPath = require.resolve(`${moduleName}/package.json`);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Check for common indicators of native modules
    return !!(
      packageJson.gypfile ||
      packageJson.binary ||
      packageJson.scripts?.install ||
      packageJson.scripts?.postinstall?.includes('node-gyp') ||
      packageJson.dependencies?.['node-addon-api'] ||
      packageJson.dependencies?.['nan']
    );
  } catch {
    return false;
  }
}

/**
 * Detect all native modules in a project
 */
export async function detectNativeModules(projectDir: string): Promise<string[]> {
  const nodeModulesDir = path.join(projectDir, 'node_modules');
  const nativeModules: string[] = [];
  
  if (!await fs.pathExists(nodeModulesDir)) {
    return nativeModules;
  }
  
  const modules = await fs.readdir(nodeModulesDir);
  
  for (const moduleName of modules) {
    if (moduleName.startsWith('.')) continue;
    
    const modulePath = path.join(nodeModulesDir, moduleName);
    const stat = await fs.stat(modulePath);
    
    if (stat.isDirectory()) {
      if (moduleName.startsWith('@')) {
        // Scoped package
        const scopedModules = await fs.readdir(modulePath);
        for (const scopedModule of scopedModules) {
          const fullName = `${moduleName}/${scopedModule}`;
          if (isNativeModule(fullName)) {
            nativeModules.push(fullName);
          }
        }
      } else {
        // Regular package
        if (isNativeModule(moduleName)) {
          nativeModules.push(moduleName);
        }
      }
    }
  }
  
  return nativeModules;
}

/**
 * Bundle configuration that handles native modules
 */
export interface BundleWithNativeModulesOptions {
  entryPoint: string;
  outputPath: string;
  nativeModules?: string[];
  autoDetect?: boolean;
  rebuild?: boolean;
  electronVersion?: string;
}

/**
 * Create a bundle that properly handles native modules
 */
export async function bundleWithNativeModules(
  options: BundleWithNativeModulesOptions
): Promise<void> {
  const {
    entryPoint,
    outputPath,
    autoDetect = true,
    rebuild = false,
    electronVersion
  } = options;
  
  const projectDir = path.dirname(entryPoint);
  const outputDir = path.dirname(outputPath);
  
  // Detect or use provided native modules
  let nativeModules = options.nativeModules || [];
  if (autoDetect) {
    const detected = await detectNativeModules(projectDir);
    nativeModules = [...new Set([...nativeModules, ...detected])];
    console.log(`🔍 Detected native modules: ${nativeModules.join(', ')}`);
  }
  
  // Copy native modules
  if (nativeModules.length > 0) {
    await copyNativeModules({
      modules: nativeModules,
      sourceDir: projectDir,
      targetDir: outputDir
    });
    
    // Create loader script
    await createNativeModuleLoader(
      path.join(outputDir, 'native-loader.js'),
      nativeModules
    );
    
    // Rebuild if requested
    if (rebuild) {
      await rebuildNativeModules(outputDir, electronVersion);
    }
  }
  
  console.log('✅ Native modules prepared for bundling');
}