#!/usr/bin/env node

/**
 * CLI tool for building Tauri sidecar binaries from Node.js servers
 */

import { buildSidecarCLI } from '../desktop/sidecar.js';

// Run the CLI with command line arguments
buildSidecarCLI(process.argv.slice(2))
  .then(() => {
    console.log('✅ Sidecar build complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Sidecar build failed:', error);
    process.exit(1);
  });