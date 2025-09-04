/**
 * Standardized Startup Banner for EpiSensor Applications
 */

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

// Force colors to ensure consistent output
chalk.level = 3; // Full color support

// Get framework version dynamically
function getFrameworkVersion(): string {
  // Try multiple strategies to find the framework version
  const strategies = [
    // Strategy 1: Check if we're in the framework itself (during development)
    () => {
      const localPkg = path.join(__dirname, '../../package.json');
      if (fs.existsSync(localPkg)) {
        const pkg = JSON.parse(fs.readFileSync(localPkg, 'utf-8'));
        if (pkg.name === '@episensor/app-framework') {
          return pkg.version;
        }
      }
      return null;
    },
    // Strategy 2: Check node_modules in current working directory
    () => {
      const nodeModulesPath = path.join(process.cwd(), 'node_modules', '@episensor', 'app-framework', 'package.json');
      if (fs.existsSync(nodeModulesPath)) {
        const pkg = JSON.parse(fs.readFileSync(nodeModulesPath, 'utf-8'));
        return pkg.version;
      }
      return null;
    },
    // Strategy 3: Try require.resolve to find the module
    () => {
      try {
        const pkgPath = require.resolve('@episensor/app-framework/package.json', { paths: [process.cwd()] });
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        return pkg.version;
      } catch {
        return null;
      }
    }
  ];

  for (const strategy of strategies) {
    try {
      const version = strategy();
      if (version) return version;
    } catch {
      // Try next strategy
    }
  }
  
  return 'unknown';
}

const version = getFrameworkVersion();

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