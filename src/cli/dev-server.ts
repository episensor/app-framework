#!/usr/bin/env node

/**
 * Development server orchestrator for EpiSensor apps
 * Manages both backend and frontend processes with unified output
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
// @ts-ignore - chalk and boxen are CLI dependencies
import chalk from 'chalk';
// @ts-ignore
import boxen from 'boxen';

interface DevServerConfig {
  appName: string;
  appVersion: string;
  description?: string;
  backendPort: number;
  frontendPort: number;
  webSocketPort?: number;
  backendCommand?: string;
  frontendCommand?: string;
}

class DevServerOrchestrator {
  private config: DevServerConfig;
  private backendProcess: ChildProcess | null = null;
  private frontendProcess: ChildProcess | null = null;
  private startTime: number;
  private isBackendReady = false;
  private isFrontendReady = false;
  private hasDetectedBackendReady = false;
  private hasDetectedFrontendReady = false;
  private hasShownBanner = false;
  private outputBuffer: string[] = [];

  constructor() {
    // Load config from package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    // Smart defaults based on common patterns
    const defaultBackendCommand = fs.existsSync('src/server/index.ts') 
      ? 'tsx watch src/server/index.ts'
      : fs.existsSync('src/index.ts')
      ? 'tsx watch src/index.ts'
      : 'tsx watch src/server.ts';
      
    const defaultFrontendCommand = fs.existsSync('web/package.json')
      ? 'cd web && npm run dev'
      : 'vite';
    
    // Get ports from environment or package.json or defaults
    const defaultBackendPort = process.env.PORT ? parseInt(process.env.PORT) : 
      packageJson.devServer?.backendPort || 3000;
    
    this.config = {
      appName: packageJson.name || 'EpiSensor App',
      appVersion: packageJson.version || '0.0.0',
      description: packageJson.description,
      backendPort: defaultBackendPort,
      frontendPort: packageJson.devServer?.frontendPort || 5173,
      webSocketPort: packageJson.devServer?.webSocketPort || defaultBackendPort,
      backendCommand: packageJson.devServer?.backendCommand || defaultBackendCommand,
      frontendCommand: packageJson.devServer?.frontendCommand || defaultFrontendCommand,
    };

    this.startTime = Date.now();
  }

  private getFrameworkVersion(): string {
    try {
      const frameworkPath = path.join(process.cwd(), 'node_modules', '@episensor', 'app-framework', 'package.json');
      const frameworkPackage = JSON.parse(fs.readFileSync(frameworkPath, 'utf8'));
      return frameworkPackage.version;
    } catch {
      return 'unknown';
    }
  }

  private printBanner() {
    // Only print once both services are ready
    if (!this.isBackendReady || !this.isFrontendReady || this.hasShownBanner) return;

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const frameworkVersion = this.getFrameworkVersion();

    // Build the banner content
    const lines = [
      '',
      chalk.white(this.config.appName),
      chalk.gray(`v${this.config.appVersion}`),
    ];
    
    if (this.config.description) {
      lines.push(chalk.gray(this.config.description));
    }
    
    lines.push(
      '',
      chalk.gray('─'.repeat(48)),
      '',
      chalk.gray('  🌐 Web UI     : ') + chalk.gray(`http://localhost:${this.config.frontendPort}`),
      chalk.gray('  📊 API        : ') + chalk.gray(`http://localhost:${this.config.backendPort}/api`),
      chalk.gray('  🔌 WebSocket  : ') + chalk.gray(`ws://localhost:${this.config.webSocketPort}`),
      '',
      chalk.gray('─'.repeat(48)),
      '',
      chalk.gray('  Ready in ') + chalk.green(elapsed + 's'),
      chalk.gray('  Environment: ') + chalk.gray(process.env.NODE_ENV || 'development'),
      chalk.gray('  Framework: ') + chalk.gray(`@episensor/app-framework v${frameworkVersion}`),
      '',
      chalk.gray('─'.repeat(48)),
      '',
      chalk.gray('  Press ') + chalk.yellow('Ctrl+C') + chalk.gray(' to stop'),
      ''
    );

    const banner = boxen(
      lines.join('\n'),
      {
        padding: { top: 0, right: 1, bottom: 0, left: 1 },
        margin: 1,
        borderStyle: 'round',
        borderColor: 'gray',
        dimBorder: true
      }
    );

    console.clear();
    console.log(banner);
    this.hasShownBanner = true;

    // Show any buffered important messages
    if (this.outputBuffer.length > 0) {
      console.log('\n' + chalk.gray('Recent activity:'));
      this.outputBuffer.forEach(msg => console.log(msg));
      this.outputBuffer = [];
    }
  }

  private parseCommand(command: string): { cmd: string; args: string[] } {
    const parts = command.split(' ');
    return {
      cmd: parts[0],
      args: parts.slice(1)
    };
  }

  private startBackend() {
    console.log(chalk.gray('Starting backend on port ' + this.config.backendPort + '...'));
    
    const { cmd, args } = this.parseCommand(this.config.backendCommand!);
    
    this.backendProcess = spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        LOG_LEVEL: 'warn', // Only show warnings and errors
        NODE_ENV: 'development',
        FORCE_COLOR: '3',
        PORT: this.config.backendPort.toString()
      }
    });

    this.backendProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      
      // Look for ANY indication the server is ready
      if (!this.hasDetectedBackendReady) {
        // Check for various ready indicators
        if (output.includes('Ready in') || 
            output.includes('Server is running') || 
            output.includes('Server started') ||
            output.includes('Listening on') ||
            output.includes(`${this.config.backendPort}`) ||
            output.includes('✓')) {
          this.hasDetectedBackendReady = true;
          this.isBackendReady = true;
          this.printBanner();
          return;
        }
      }
      
      // Check for port conflict
      if (output.includes('EADDRINUSE') || output.includes('already in use')) {
        console.error(chalk.red(`\n⚠️  Port ${this.config.backendPort} is already in use!`));
        console.error(chalk.yellow('Please stop the other process or use a different port.\n'));
        this.cleanup();
        process.exit(1);
      }
      
      // Show errors
      if (output.toLowerCase().includes('error') && !output.includes('ExperimentalWarning')) {
        const lines = output.trim().split('\n');
        lines.forEach((line: string) => {
          if (line.trim()) {
            const msg = chalk.red(`[Backend] ${line.trim()}`);
            if (this.hasShownBanner) {
              console.log(msg);
            } else {
              this.outputBuffer.push(msg);
            }
          }
        });
      }
    });

    this.backendProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      
      // Check for port conflict
      if (output.includes('EADDRINUSE') || output.includes('address already in use')) {
        console.clear();
        console.error(boxen(
          chalk.red('⚠️  Port Conflict Detected!\n\n') +
          chalk.white(`Port ${chalk.yellow(this.config.backendPort)} is already in use.\n\n`) +
          chalk.gray('To fix this issue:\n') +
          chalk.gray(`1. Stop the other process using port ${this.config.backendPort}\n`) +
          chalk.gray(`2. Or check what's using it: ${chalk.cyan(`lsof -i :${this.config.backendPort}`)}\n`) +
          chalk.gray(`3. Or use a different port in your configuration`),
          {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'red'
          }
        ));
        this.cleanup();
        process.exit(1);
      }
      
      // Log other errors but don't fail on ExperimentalWarnings
      if (output.trim() && !output.includes('ExperimentalWarning')) {
        // Check if it's actually an error worth showing
        if (output.includes('Error') || output.includes('error')) {
          // Strip existing ANSI codes to prevent corruption
          const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '').trim();
          console.error(chalk.red(`[Backend Error] ${cleanOutput}`));
          
          // If we get a real error early, prevent showing success banner
          if (!this.hasDetectedBackendReady) {
            this.isBackendReady = false;
          }
        }
      }
    });

    this.backendProcess.on('error', (error) => {
      console.error(chalk.red(`[Backend] Failed to start: ${error.message}`));
    });

    this.backendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.red(`[Backend] Exited with code ${code}`));
      }
    });
    
    // Fallback: Mark as ready after timeout if we haven't detected it
    setTimeout(() => {
      if (!this.hasDetectedBackendReady && this.isBackendReady !== false) {
        console.log(chalk.yellow('Backend ready detection timeout - assuming ready'));
        this.hasDetectedBackendReady = true;
        this.isBackendReady = true;
        this.printBanner();
      } else if (this.isBackendReady === false) {
        console.error(chalk.red('\nBackend failed to start. Check the error messages above.'));
        this.cleanup();
        process.exit(1);
      }
    }, 5000);
  }

  private startFrontend() {
    console.log(chalk.gray('Starting frontend on port ' + this.config.frontendPort + '...'));
    
    // Handle different frontend command formats
    let cmd: string;
    let args: string[];
    
    if (this.config.frontendCommand!.includes('cd ')) {
      // Complex command like "cd web && npm run dev"
      cmd = 'sh';
      args = ['-c', this.config.frontendCommand!];
    } else if (this.config.frontendCommand === 'vite') {
      // Direct vite command
      cmd = 'npx';
      args = ['vite', '--port', this.config.frontendPort.toString()];
    } else {
      // Parse other commands
      const parsed = this.parseCommand(this.config.frontendCommand!);
      cmd = parsed.cmd;
      args = parsed.args;
    }
    
    this.frontendProcess = spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        FORCE_COLOR: '3'
      }
    });

    this.frontendProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      
      // Detect when frontend is ready
      if (!this.hasDetectedFrontendReady) {
        if (output.includes('ready in') || 
            output.includes('Local:') || 
            output.includes('➜') ||
            output.includes(`${this.config.frontendPort}`)) {
          // Extract actual port if different
          const portMatch = output.match(/localhost:(\d+)/);
          if (portMatch) {
            this.config.frontendPort = parseInt(portMatch[1]);
          }
          this.hasDetectedFrontendReady = true;
          this.isFrontendReady = true;
          this.printBanner();
          return;
        }
      }
      
      // Check for port conflict
      if (output.includes('EADDRINUSE') || output.includes('already in use')) {
        console.error(chalk.red(`\n⚠️  Port ${this.config.frontendPort} is already in use!`));
        console.error(chalk.yellow('Vite will try to find another port...\n'));
      }
      
      // Show errors
      if (output.toLowerCase().includes('error')) {
        const lines = output.trim().split('\n');
        lines.forEach((line: string) => {
          if (line.trim() && !line.includes('➜')) {
            // Strip existing ANSI codes to prevent corruption
            const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
            const msg = chalk.red(`[Frontend] ${cleanLine}`);
            if (this.hasShownBanner) {
              console.log(msg);
            } else {
              this.outputBuffer.push(msg);
            }
          }
        });
      }
    });

    this.frontendProcess.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        // Strip existing ANSI codes to prevent corruption
        const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
        console.error(chalk.red(`[Frontend Error] ${cleanOutput}`));
      }
    });

    this.frontendProcess.on('error', (error) => {
      console.error(chalk.red(`[Frontend] Failed to start: ${error.message}`));
    });

    this.frontendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.red(`[Frontend] Exited with code ${code}`));
      }
    });
    
    // Fallback: Mark as ready after timeout if we haven't detected it
    setTimeout(() => {
      if (!this.hasDetectedFrontendReady) {
        console.log(chalk.yellow('Frontend ready detection timeout - assuming ready'));
        this.hasDetectedFrontendReady = true;
        this.isFrontendReady = true;
        this.printBanner();
      }
    }, 5000);
  }

  private cleanup() {
    if (this.backendProcess) {
      this.backendProcess.kill('SIGTERM');
      this.backendProcess = null;
    }
    if (this.frontendProcess) {
      this.frontendProcess.kill('SIGTERM');
      this.frontendProcess = null;
    }
  }

  async start() {
    console.log(chalk.cyan(`\nStarting ${this.config.appName} development server...\n`));
    
    // Start both processes
    this.startBackend();
    
    // Give backend a moment to start before frontend
    setTimeout(() => this.startFrontend(), 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nShutting down...'));
      this.cleanup();
      // Force exit after a delay if processes don't terminate
      setTimeout(() => process.exit(0), 1000);
    });

    process.on('SIGTERM', () => {
      this.cleanup();
      process.exit(0);
    });
  }
}

// Run the orchestrator
const orchestrator = new DevServerOrchestrator();
orchestrator.start();