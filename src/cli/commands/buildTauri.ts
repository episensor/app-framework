#!/usr/bin/env node

/**
 * CLI command for building Tauri sidecars
 */

import { Command } from 'commander';
import { buildTauriSidecar, generateBuildSidecarScript } from '../../build/tauriBundler.js';
import fs from 'fs-extra';
import path from 'path';

export const buildTauriCommand = new Command('build-tauri')
  .description('Build Tauri desktop app sidecar binaries')
  .option('-e, --entry <path>', 'Entry point for the server', 'dist/index.js')
  .option('-o, --output <path>', 'Output directory for binaries', 'src-tauri/binaries')
  .option('--node-version <version>', 'Node.js version to target', '18')
  .option('--platforms <platforms>', 'Comma-separated list of platforms', 'macos-arm64,win-x64,linux-x64')
  .option('--no-compress', 'Disable GZip compression')
  .option('--externals <modules>', 'Additional external modules (comma-separated)', '')
  .option('--generate-script', 'Generate package.json script instead of building')
  .action(async (options) => {
    try {
      const platforms = options.platforms.split(',').filter(Boolean);
      const externals = options.externals ? options.externals.split(',').filter(Boolean) : [];
      
      const config = {
        entryPoint: options.entry,
        binaryOutput: options.output,
        nodeVersion: options.nodeVersion,
        platforms,
        compress: options.compress,
        externals
      };
      
      if (options.generateScript) {
        // Generate the script for package.json
        const script = generateBuildSidecarScript(config);
        console.log('\n📝 Add this to your package.json scripts:\n');
        console.log('"build:sidecar": "' + script + '"');
        console.log('\n');
      } else {
        // Build the sidecar
        await buildTauriSidecar(config);
        
        // Check if Tauri config exists and provide helpful info
        const tauriConfigPath = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json');
        if (await fs.pathExists(tauriConfigPath)) {
          console.log('\n📋 Next steps:');
          console.log('1. Test the binary: ./src-tauri/binaries/server-aarch64-apple-darwin');
          console.log('2. Run Tauri dev: npm run tauri:dev');
          console.log('3. Build Tauri app: npm run tauri:build');
        }
      }
    } catch (error) {
      console.error('❌ Build failed:', error);
      process.exit(1);
    }
  });

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildTauriCommand.parse(process.argv);
}