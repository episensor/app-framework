/**
 * Startup logger for clean console output
 */

import chalk from 'chalk';
import boxen from 'boxen';

// Suppress dotenv's default logging
process.env.DOTENV_CONFIG_QUIET = 'true';

// Suppress punycode deprecation warning
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return; // Ignore punycode deprecation
  }
  console.warn(warning);
});

// Store original console.log to restore later
const originalConsoleLog = console.log;

interface Step {
  icon: string;
  message: string;
  timestamp: number;
}

interface ConflictInfo {
  port: number;
  process?: {
    pid: number;
    command: string;
  };
}

interface StartupConfig {
  get?: (key: string) => any;
  app_title?: string;
  appTitle?: string;
  version?: string;
  webStarted?: boolean;
  webPort?: number;
  apiPort?: number;
}

class StartupLogger {
  private startTime: number;
  private steps: Step[];
  private concise: boolean;

  constructor() {
    this.startTime = Date.now();
    this.steps = [];
    this.concise = true; // default to concise, beautiful output
  }
  
  startSuppression(): void {
    // Suppression no longer needed
    // Override console.log to suppress external logs
    console.log = (...args: any[]) => {
      // Only show our formatted logs, suppress others
      const message = args.join(' ');
      if (!message.includes('[ConfigService]') && 
          !message.includes('[SecureFileHandler]') && 
          !message.includes('[ConversationStorage]') &&
          !message.includes('[WebSocket]') &&
          !message.includes('[API]')) {
        originalConsoleLog(...args);
      }
    };
  }
  
  stopSuppression(): void {
    // Restore original console.log
    console.log = originalConsoleLog;
  }

  banner(config: StartupConfig | null = null): void {
    // Concise mode: no verbose banner; the summary box will contain all info
    if (!this.concise) {
      const appTitle = config?.get?.('app_title') || config?.app_title || 'Device Simulator';
      const version = config?.get?.('version') || config?.version || '2.0.0';
      const description = 'Cross-Platform Industrial Device Simulation';
      const banner = boxen(
        chalk.bold.cyan(`🚀 ${appTitle} v${version}\n`) +
        chalk.gray(description),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
          borderColor: 'cyan',
          align: 'center'
        }
      );
      console.log(banner);
    }
  }

  section(title: string): void {
    if (this.concise) return;
    console.log(chalk.bold.white(`\n${title}`));
    console.log(chalk.gray('─'.repeat(50)));
  }

  step(icon: string, message: string, details?: string): void {
    if (this.concise) return;
    const timestamp = chalk.gray(`[${this.getElapsedTime()}s]`);
    console.log(`${timestamp} ${icon}  ${message}`);
    if (details) {
      console.log(chalk.gray(`     ${details}`));
    }
    this.steps.push({ icon, message, timestamp: Date.now() });
  }

  success(message: string, details?: string): void {
    this.step('✅', chalk.green(message), details);
  }

  warning(message: string, details?: string): void {
    this.step('⚠️ ', chalk.yellow(message), details);
  }

  error(message: string, details?: string): void {
    this.step('❌', chalk.red(message), details);
  }

  info(message: string, details?: string): void {
    this.step('ℹ️ ', chalk.blue(message), details);
  }

  loading(message: string): void {
    this.step('⏳', chalk.gray(message));
  }

  getElapsedTime(): string {
    const elapsed = (Date.now() - this.startTime) / 1000;
    return elapsed.toFixed(1).padStart(4, ' ');
  }

  summary(config: StartupConfig): void {
    if (process.env.SILENT_STARTUP === '1') return; // Orchestrator will print final summary
    const appTitle = (config?.get?.('app_title') || config?.appTitle || 'Device Simulator');
    const version = (config?.get?.('version') || config?.version || '2.0.0');

    const labelPad = (label: string) => label.padEnd(10, ' ');
    let webValue: string;
    // If started via npm start (vite preview picks free port), avoid showing a possibly wrong port
    const isPreview = ['start', 'start:api'].includes(process.env.npm_lifecycle_event || '');
    if (config.webStarted && isPreview) {
      webValue = chalk.white('Vite preview (see above)');
    } else if (config.webStarted) {
      webValue = chalk.white(`http://localhost:${config.webPort}`);
    } else {
      webValue = chalk.white('Not started');
    }

    const lines = [
      `${chalk.cyan(labelPad('Web UI'))}${webValue}`,
      `${chalk.cyan(labelPad('API'))}${chalk.white(`http://localhost:${config.apiPort}`)}`,
      `${chalk.cyan(labelPad('WebSocket'))}${chalk.white(`ws://localhost:${config.apiPort}`)}`,
      '',
      `${chalk.green('✔ All systems ready')}${chalk.gray(` • ${this.getElapsedTime()}s`)}`,
      chalk.gray('Press Ctrl+C to quit'),
    ];

    const summaryBox = boxen(lines.join('\n'), {
      padding: { top: 1, right: 2, bottom: 1, left: 2 },
      borderStyle: 'round',
      borderColor: 'green',
      align: 'left',
      title: chalk.bold(`${appTitle} v${version}`),
      titleAlignment: 'center',
    });

    console.log('\n' + summaryBox + '\n');
  }

  portConflict(conflicts: ConflictInfo[]): void {
    const items = conflicts.map(c => {
      const lines: string[] = [];
      lines.push(`  Port ${chalk.yellow(c.port)}`);
      if (c.process) {
        lines.push(`    ${chalk.gray('PID:')} ${c.process.pid}`);
        lines.push(`    ${chalk.gray('Process:')} ${c.process.command.substring(0, 80)}${c.process.command.length > 80 ? '...' : ''}`);
        lines.push(`    ${chalk.gray('Kill:')} ${chalk.cyan(`kill -9 ${c.process.pid}`)}`);
      } else {
        lines.push(`    ${chalk.gray('Kill:')} ${chalk.cyan(`lsof -ti:${c.port} | xargs kill -9`)}`);
      }
      return lines.join('\n');
    }).join('\n\n');

    const body = (
      chalk.bold.red('Port conflict detected') + '\n\n' +
      items + '\n\n' +
      chalk.bold('To resolve:') + '\n' +
      '  1. Kill the process using the command above\n' +
      '  2. Or change the port in settings (server.port)\n' +
      `  3. Restart: ${chalk.cyan('npm start')}`
    );

    const conflictBox = boxen(body, {
      padding: { top: 1, right: 2, bottom: 1, left: 2 },
      borderStyle: 'round',
      borderColor: 'red',
      align: 'left',
      title: chalk.bold('Startup blocked'),
      titleAlignment: 'center',
    });

    console.log('\n' + conflictBox + '\n');
  }

  table(title: string, data: Record<string, any>): void {
    console.log(chalk.bold.white(`\n${title}`));
    console.log(chalk.gray('─'.repeat(50)));
    
    for (const [key, value] of Object.entries(data)) {
      const paddedKey = key.padEnd(20, ' ');
      console.log(`  ${chalk.cyan(paddedKey)} ${value}`);
    }
  }

  setConcise(concise: boolean): void {
    this.concise = concise;
  }

  isConcise(): boolean {
    return this.concise;
  }
}

// Export singleton instance with lazy initialization
let _logger: StartupLogger | null = null;

export function getStartupLogger(): StartupLogger {
  if (!_logger) {
    _logger = new StartupLogger();
  }
  return _logger;
}

// For backward compatibility
export const logger = new Proxy({} as StartupLogger, {
  get(_target, prop) {
    return (getStartupLogger() as any)[prop];
  }
});
export default logger;
