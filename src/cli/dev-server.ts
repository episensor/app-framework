#!/usr/bin/env node

/**
 * Development server orchestrator for framework apps
 * Manages both backend and frontend processes with unified output
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import chalk from 'chalk';
import boxen from 'boxen';
import { displayStartupBanner } from '../utils/startupBanner.js';

interface DevServerConfig {
  appName: string;
  appVersion: string;
  packageName?: string;
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
  private retryCount = 0;
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
      packageName: packageJson.name,
      description: packageJson.description,
      backendPort: defaultBackendPort,
      frontendPort: packageJson.devServer?.frontendPort || 5173,
      webSocketPort: packageJson.devServer?.webSocketPort || defaultBackendPort,
      backendCommand: packageJson.devServer?.backendCommand || defaultBackendCommand,
      frontendCommand: packageJson.devServer?.frontendCommand || defaultFrontendCommand,
    };

    // Set process title for easier identification
    process.title = `dev-server:${this.config.appName}:${this.config.backendPort}`;

    this.startTime = Date.now();
  }


  private showStartupBanner() {
    // Only print once both services are ready
    if (!this.isBackendReady || !this.isFrontendReady || this.hasShownBanner) return;

    console.clear();
    
    // Use the standardized banner from utils
    displayStartupBanner({
      appName: this.config.appName,
      appVersion: this.config.appVersion,
      packageName: this.config.packageName,
      description: this.config.description,
      port: this.config.backendPort,
      webPort: this.config.frontendPort,
      webSocketPort: this.config.webSocketPort,
      environment: process.env.NODE_ENV || 'development',
      startTime: this.startTime
    });
    
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
      detached: true, // Create a new process group
      env: {
        ...process.env,
        LOG_LEVEL: 'warn', // Only show warnings and errors
        NODE_ENV: 'development',
        FORCE_COLOR: '3',
        PORT: this.config.backendPort.toString(),
        APP_NAME: this.config.appName,
        APP_PORT: this.config.backendPort.toString()
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
          this.showStartupBanner();
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
      
      // For backend stderr, just pass it through as-is to preserve formatting
      // The backend logger already handles coloring appropriately
      if (output.trim() && !output.includes('ExperimentalWarning')) {
        process.stderr.write(output);
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
        this.showStartupBanner();
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
      console.log(chalk.gray(`Frontend command: ${cmd} ${args.join(' ')}`));
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
      detached: true, // Create a new process group
      cwd: process.cwd(), // Explicitly set working directory
      env: {
        ...process.env,
        NODE_ENV: 'development',
        FORCE_COLOR: '3'
      }
    });

    this.frontendProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      
      // Debug: Log all frontend output
      if (process.env.DEBUG_DEV_SERVER) {
        console.log(chalk.blue(`[Frontend stdout] ${output.trim()}`));
      }
      
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
          this.showStartupBanner();
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
            // eslint-disable-next-line no-control-regex
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
        // Debug: Log all frontend stderr
        if (process.env.DEBUG_DEV_SERVER) {
          console.log(chalk.yellow(`[Frontend stderr] ${output}`));
        }
        
        // Check if Vite is outputting its ready message to stderr
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
            this.showStartupBanner();
            return;
          }
        }
        
        // For Vite, most stderr output is normal (like the startup messages)
        // Just pass it through as-is to preserve formatting
        process.stderr.write(output);
      }
    });

    this.frontendProcess.on('error', (error: any) => {
      // EAGAIN errors are temporary resource issues, retry
      if (error.code === 'EAGAIN' && this.retryCount < 3) {
        this.retryCount++;
        console.log(chalk.yellow(`[Frontend] Resource temporarily unavailable, retrying (${this.retryCount}/3)...`));
        setTimeout(() => this.startFrontend(), 1000 * this.retryCount);
        return;
      }
      
      // For other errors, show in yellow (warning) not red (error) since it might still work
      console.log(chalk.yellow(`[Frontend] Process spawn warning: ${error.message}`));
      if (process.env.DEBUG_DEV_SERVER) {
        console.log(chalk.gray(`[Frontend] Command: ${cmd} ${args.join(' ')}`));
        console.log(chalk.gray(`[Frontend] Directory: ${process.cwd()}`));
      }
    });

    this.frontendProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(chalk.red(`[Frontend] Exited with code ${code}`));
        if (!this.hasDetectedFrontendReady) {
          console.error(chalk.red(`[Frontend] Failed to start properly. Check that 'cd web && npm run dev' works manually.`));
        }
      }
    });
    
    // Fallback: Mark as ready after timeout if we haven't detected it
    setTimeout(() => {
      if (!this.hasDetectedFrontendReady) {
        console.log(chalk.yellow('Frontend ready detection timeout - assuming ready'));
        this.hasDetectedFrontendReady = true;
        this.isFrontendReady = true;
        this.showStartupBanner();
      }
    }, 5000);
  }

  private cleanup() {
    // Kill process groups to ensure all child processes are terminated
    if (this.backendProcess && this.backendProcess.pid) {
      try {
        // Kill the entire process group (negative PID)
        process.kill(-this.backendProcess.pid, 'SIGTERM');
      } catch (_e) {
        // Fallback to regular kill
        try {
          this.backendProcess.kill('SIGTERM');
        } catch (_err) {
          // Process might already be dead
        }
      }
      this.backendProcess = null;
    }
    
    if (this.frontendProcess && this.frontendProcess.pid) {
      try {
        // Kill the entire process group (negative PID)
        process.kill(-this.frontendProcess.pid, 'SIGTERM');
      } catch (_e) {
        // Fallback to regular kill
        try {
          this.frontendProcess.kill('SIGTERM');
        } catch (_err) {
          // Process might already be dead
        }
      }
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