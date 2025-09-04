#!/usr/bin/env node

/**
 * EpiSensor App Framework CLI
 * Provides utilities for building and managing EpiSensor applications
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildTauriCommand } from './commands/buildTauri.js';

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const program = new Command();

program
  .name('app-framework')
  .description('Node.js Application Framework CLI')
  .version(packageJson.version);

// Add commands
program.addCommand(buildTauriCommand);

// Parse arguments
program.parse(process.argv);

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}