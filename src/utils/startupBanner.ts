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
  packageName?: string;  // Optional package name
  description?: string;
  port: number;  // API port
  webPort?: number;  // Optional separate web UI port
  webSocketPort?: number;  // Optional WebSocket port
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
    webSocketPort,  // WebSocket port
    environment = process.env.NODE_ENV || 'development',
    startTime
  } = options;

  const width = 50;  // Reduced width to match horizontal dividers
  const border = '─'.repeat(width);  // Full width for top/bottom borders
  
  // Calculate startup time if provided
  const startupTime = startTime ? `${((Date.now() - startTime) / 1000).toFixed(1)}s` : '0.0s';

  // Helper to create a line with proper padding
  const makeLine = (content: string, align: 'center' | 'left' = 'center'): string => {
    // eslint-disable-next-line no-control-regex
    const visibleLength = content.replace(/\x1b\[[0-9;]*m/g, '').length; // Strip ANSI codes for length calculation
    if (align === 'center') {
      const leftPad = Math.max(0, Math.floor((width - visibleLength) / 2));
      const rightPad = Math.max(0, width - visibleLength - leftPad);
      return chalk.gray('│') + ' '.repeat(leftPad) + content + ' '.repeat(rightPad) + chalk.gray('│');
    } else {
      const padding = Math.max(0, width - visibleLength);
      return chalk.gray('│') + content + ' '.repeat(padding) + chalk.gray('│');
    }
  };

  // Helper to wrap text
  const wrapText = (text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxWidth) {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    
    return lines;
  };

  const emptyLine = chalk.gray('│') + ' '.repeat(width) + chalk.gray('│');
  const separator = chalk.gray('│ ') + chalk.gray('─'.repeat(width - 2)) + chalk.gray(' │');

  // Build the banner
  console.log('');
  console.log(chalk.gray('╭' + border + '╮'));
  console.log(chalk.gray(emptyLine));
  
  // App name in light gray
  console.log(makeLine(chalk.gray(appName)));
  console.log(emptyLine);
  
  // Version in amber to match Ctrl+C
  console.log(makeLine(chalk.yellow(`v${appVersion}`)));
  console.log(emptyLine);
  
  // Description (wrapped if needed)
  if (description) {
    const wrappedLines = wrapText(description, width - 4);
    for (const line of wrappedLines) {
      console.log(makeLine(line));
    }
    console.log(emptyLine);
  }
  
  console.log(separator);
  console.log(emptyLine);
  
  // URLs - no emojis, keys dark gray, values light gray
  if (webPort && webPort !== port) {
    // Both web UI and API are configured on different ports
    console.log(makeLine(`${chalk.gray(' Web UI     :')} ${chalk.gray(`http://localhost:${webPort}`)}`, 'left'));
    console.log(makeLine(`${chalk.gray(' API        :')} ${chalk.gray(`http://localhost:${port}/api`)}`, 'left'));
  } else if (webPort === port) {
    // Web UI and API share the same port (production mode)
    console.log(makeLine(`${chalk.gray(' Web UI     :')} ${chalk.gray(`http://localhost:${port}`)}`, 'left'));
    console.log(makeLine(`${chalk.gray(' API        :')} ${chalk.gray(`http://localhost:${port}/api`)}`, 'left'));
  } else {
    // API-only mode
    console.log(makeLine(`${chalk.gray(' API Server :')} ${chalk.gray(`http://localhost:${port}`)}`, 'left'));
    console.log(makeLine(`${chalk.gray(' Endpoints  :')} ${chalk.gray(`http://localhost:${port}/api/*`)}`, 'left'));
  }
  console.log(makeLine(`${chalk.gray(' WebSocket  :')} ${chalk.gray(`ws://localhost:${webSocketPort || port}`)}`, 'left'));
  
  console.log(emptyLine);
  console.log(separator);
  console.log(emptyLine);
  
  // Status lines
  console.log(makeLine(`${chalk.gray(' Ready in')} ${chalk.green(startupTime)}`, 'left'));
  console.log(makeLine(`${chalk.gray(' Environment:')} ${chalk.gray(environment)}`, 'left'));
  console.log(makeLine(`${chalk.gray(' Framework:')} ${chalk.gray(`@episensor/app-framework v${version}`)}`, 'left'));
  
  console.log(emptyLine);
  console.log(separator);
  console.log(emptyLine);
  
  console.log(makeLine(`${chalk.gray(' Press')} ${chalk.yellow('Ctrl+C')} ${chalk.gray('to stop')}`, 'left'));
  
  console.log(chalk.gray(emptyLine));
  console.log(chalk.gray('╰' + border + '╯'));
  console.log('');
}

/**
 * Display a minimal startup message (for silent mode)
 */
export function displayMinimalStartup(appName: string, port: number): void {
  console.log(chalk.green('✓'), chalk.bold(appName), 'started on port', chalk.cyan(port));
}