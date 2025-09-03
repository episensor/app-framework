/**
 * Standardized Startup Banner for EpiSensor Applications
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Force colors to ensure consistent output
chalk.level = 3; // Full color support

// Get framework version dynamically
let version = 'unknown'; // Will be determined from package.json
try {
  // First try to get framework version from its own package.json
  const frameworkPackageJson = path.join(__dirname, '../../package.json');
  if (fs.existsSync(frameworkPackageJson)) {
    const packageJson = JSON.parse(fs.readFileSync(frameworkPackageJson, 'utf-8'));
    version = packageJson.version || version;
  } else {
    // Fallback: try to read from node_modules
    const nodeModulesPath = path.join(process.cwd(), 'node_modules', '@episensor', 'app-framework', 'package.json');
    if (fs.existsSync(nodeModulesPath)) {
      const packageJson = JSON.parse(fs.readFileSync(nodeModulesPath, 'utf-8'));
      version = packageJson.version || version;
    }
  }
} catch (error) {
  // Use default version if unable to read package.json
}

export interface BannerOptions {
  appName: string;
  appVersion: string;
  environment?: string;
  port?: number;
  additionalInfo?: string[];
  showTips?: boolean;
  showCredits?: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}

export interface StartupBannerOptions extends BannerOptions {
  appName: string;
  appVersion: string;
  description?: string;
  port: number;  // API port
  webPort?: number;  // Optional separate web UI port
  environment?: string;
  startTime?: number;
}

/**
 * Display a standardized startup banner for EpiSensor applications
 * All apps should use this exact same format for consistency
 */
export function displayStartupBanner(options: StartupBannerOptions): void {
  const {
    appName,
    appVersion,
    description,
    port,
    webPort,  // Use separate web port if provided
    environment = process.env.NODE_ENV || 'development',
    startTime
  } = options;

  const width = 60;
  const border = '═'.repeat(width);
  
  // Calculate startup time if provided
  const startupTime = startTime ? `${((Date.now() - startTime) / 1000).toFixed(1)}s` : '0.0s';

  // Helper to create a line with proper padding
  const makeLine = (content: string, align: 'center' | 'left' = 'center'): string => {
    // eslint-disable-next-line no-control-regex
    const visibleLength = content.replace(/\x1b\[[0-9;]*m/g, '').length; // Strip ANSI codes for length calculation
    if (align === 'center') {
      const leftPad = Math.max(0, Math.floor((width - visibleLength) / 2));
      const rightPad = Math.max(0, width - visibleLength - leftPad);
      return chalk.cyan('║') + ' '.repeat(leftPad) + content + ' '.repeat(rightPad) + chalk.cyan('║');
    } else {
      const padding = Math.max(0, width - visibleLength);
      return chalk.cyan('║') + content + ' '.repeat(padding) + chalk.cyan('║');
    }
  };

  const emptyLine = chalk.cyan('║') + ' '.repeat(width) + chalk.cyan('║');
  const separator = chalk.cyan('║') + ' '.repeat(10) + chalk.gray('─'.repeat(40)) + ' '.repeat(10) + chalk.cyan('║');

  // Build the banner
  console.log('');
  console.log(chalk.cyan('╔' + border + '╗'));
  
  // Title and version
  console.log(makeLine(chalk.bold.white(`🚀 ${appName.toUpperCase()}`)));
  console.log(makeLine(chalk.gray(`Version ${appVersion}`)));
  
  // Description
  if (description) {
    console.log(emptyLine);
    console.log(makeLine(chalk.white(description)));
  }
  
  console.log(emptyLine);
  console.log(separator);
  console.log(emptyLine);
  
  // URLs - intelligently show what's actually running
  if (webPort && webPort !== port) {
    // Both web UI and API are configured on different ports
    console.log(makeLine(`  🌐 Web UI    : ${chalk.cyan(`http://localhost:${webPort}`)}`, 'left'));
    console.log(makeLine(`  📊 API       : ${chalk.cyan(`http://localhost:${port}/api`)}`, 'left'));
  } else if (webPort === port) {
    // Web UI and API share the same port (production mode)
    console.log(makeLine(`  🌐 Server     : ${chalk.cyan(`http://localhost:${port}`)}`, 'left'));
    console.log(makeLine(`  📍 API        : ${chalk.cyan(`http://localhost:${port}/api`)}`, 'left'));
  } else {
    // API-only mode
    console.log(makeLine(`  📊 API Server : ${chalk.cyan(`http://localhost:${port}`)}`, 'left'));
    console.log(makeLine(`  📍 Endpoints  : ${chalk.cyan(`http://localhost:${port}/api/*`)}`, 'left'));
  }
  console.log(makeLine(`  🔌 WebSocket  : ${chalk.cyan(`ws://localhost:${port}`)}`, 'left'));
  
  console.log(emptyLine);
  console.log(separator);
  console.log(emptyLine);
  
  // Status line - consistent format for all apps
  console.log(makeLine(`  ✓ Ready in ${chalk.green(startupTime)} • Environment: ${chalk.blue(environment)}`, 'left'));
  console.log(makeLine(`  📦 Framework: ${chalk.gray(`@episensor/app-framework v${version}`)}`, 'left'));
  console.log(makeLine(`  Press ${chalk.yellow('Ctrl+C')} to stop`, 'left'));
  
  console.log(chalk.cyan('╚' + border + '╝'));
  console.log('');
}

/**
 * Display a minimal startup message (for silent mode)
 */
export function displayMinimalStartup(appName: string, port: number): void {
  console.log(chalk.green('✓'), chalk.bold(appName), 'started on port', chalk.cyan(port));
}