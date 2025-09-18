#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const cliDir = path.join(__dirname, '..', 'dist', 'cli');

async function ensureExecutables() {
  let entries;
  try {
    entries = await fs.promises.readdir(cliDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('[postbuild] dist/cli directory not found, skipping executable fix.');
      return;
    }
    throw error;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map(async (entry) => {
        const filePath = path.join(cliDir, entry.name);
        const stat = await fs.promises.stat(filePath);
        const desiredMode = stat.mode | 0o111; // ensure executable bits
        if ((stat.mode & 0o111) !== 0o111) {
          await fs.promises.chmod(filePath, desiredMode);
          console.log(`[postbuild] Set executable permissions on ${entry.name}`);
        }
      })
  );
}

ensureExecutables().catch((error) => {
  console.error('[postbuild] Failed to ensure CLI executables:', error);
  process.exit(1);
});
