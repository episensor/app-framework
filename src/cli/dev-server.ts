#!/usr/bin/env node

/**
 * Development server orchestrator for framework apps
 * Manages both backend and frontend processes with unified output
 */

import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import net from "net";
import chalk from "chalk";
import boxen from "boxen";
import { displayStartupBanner } from "../utils/startupBanner.js";
import { createLogger } from "../core/logger.js";
const logger = createLogger('dev-server');

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
  private frontendError: string | null = null;

  constructor() {
    // Load config from package.json
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

    // Smart defaults based on common patterns
    const defaultBackendCommand = fs.existsSync("src/server/index.ts")
      ? "tsx watch src/server/index.ts"
      : fs.existsSync("src/index.ts")
        ? "tsx watch src/index.ts"
        : "tsx watch src/server.ts";

    const defaultFrontendCommand = fs.existsSync("web/package.json")
      ? "cd web && npm run dev"
      : "vite";

    // Get ports from environment or package.json or defaults
    const defaultBackendPort = process.env.PORT
      ? parseInt(process.env.PORT)
      : packageJson.devServer?.backendPort || 3000;

    this.config = {
      appName: packageJson.name || "EpiSensor App",
      appVersion: packageJson.version || "0.0.0",
      packageName: packageJson.name,
      description: packageJson.description,
      backendPort: defaultBackendPort,
      frontendPort: packageJson.devServer?.frontendPort || 5173,
      webSocketPort: packageJson.devServer?.webSocketPort || defaultBackendPort,
      backendCommand:
        packageJson.devServer?.backendCommand || defaultBackendCommand,
      frontendCommand:
        packageJson.devServer?.frontendCommand || defaultFrontendCommand,
    };

    // Set process title for easier identification
    process.title = `dev-server:${this.config.appName}:${this.config.backendPort}`;

    this.startTime = Date.now();
  }

  private showStartupBanner() {
    // Only print once both services are ready
    if (!this.isBackendReady || !this.isFrontendReady || this.hasShownBanner)
      return;

    logger.info("Clearing console for startup banner");
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
      environment: process.env.NODE_ENV || "development",
      startTime: this.startTime,
    });

    this.hasShownBanner = true;

    // Show any buffered important messages
    if (this.outputBuffer.length > 0) {
      logger.info("\n" + chalk.gray("Recent activity:"));
      this.outputBuffer.forEach((msg) => logger.info(msg));
      this.outputBuffer = [];
    }
  }

  private parseCommand(command: string): { cmd: string; args: string[] } {
    const parts = command.split(" ");
    return {
      cmd: parts[0],
      args: parts.slice(1),
    };
  }

  private startBackend() {
    logger.info(
      chalk.gray("Starting backend on port " + this.config.backendPort + "..."),
    );

    const { cmd, args } = this.parseCommand(this.config.backendCommand!);

    this.backendProcess = spawn(cmd, args, {
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
      detached: true, // Create a new process group
      env: {
        ...process.env,
        LOG_LEVEL: "warn", // Only show warnings and errors
        NODE_ENV: "development",
        FORCE_COLOR: "3",
        PORT: this.config.backendPort.toString(),
        APP_NAME: this.config.appName,
        APP_PORT: this.config.backendPort.toString(),
      },
    });

    this.backendProcess.stdout?.on("data", (data) => {
      const output = data.toString();

      // Look for ANY indication the server is ready
      if (!this.hasDetectedBackendReady) {
        // Check for various ready indicators
        if (
          output.includes("Ready in") ||
          output.includes("Server is running") ||
          output.includes("Server started") ||
          output.includes("Listening on") ||
          output.includes(`${this.config.backendPort}`) ||
          output.includes("✓")
        ) {
          this.hasDetectedBackendReady = true;
          this.isBackendReady = true;
          this.showStartupBanner();
          return;
        }
      }

      // Check for port conflict and show enhanced error
      if (output.includes("EADDRINUSE") || output.includes("already in use")) {
        this.showPortConflictError(this.config.backendPort, 'backend');
      }

      // Show errors
      if (
        output.toLowerCase().includes("error") &&
        !output.includes("ExperimentalWarning")
      ) {
        const lines = output.trim().split("\n");
        lines.forEach((line: string) => {
          if (line.trim()) {
            const msg = chalk.red(`[Backend] ${line.trim()}`);
            if (this.hasShownBanner) {
              logger.error(msg);
            } else {
              this.outputBuffer.push(msg);
            }
          }
        });
      }
    });

    this.backendProcess.stderr?.on("data", (data) => {
      const output = data.toString();

      // Check for port conflict
      if (
        output.includes("EADDRINUSE") ||
        output.includes("address already in use")
      ) {
        this.showPortConflictError(this.config.backendPort, 'backend');
      }

      // For backend stderr, just pass it through as-is to preserve formatting
      // The backend logger already handles coloring appropriately
      if (output.trim() && !output.includes("ExperimentalWarning")) {
        process.stderr.write(output);
      }
    });

    this.backendProcess.on("error", (error) => {
      logger.error(chalk.red(`[Backend] Failed to start: ${error.message}`));
    });

    this.backendProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        logger.error(chalk.red(`[Backend] Exited with code ${code}`));
      }
    });

    // Fallback: Mark as ready after timeout if we haven't detected it
    setTimeout(() => {
      if (!this.hasDetectedBackendReady && this.isBackendReady !== false) {
        logger.warn(
          chalk.yellow("Backend ready detection timeout - assuming ready"),
        );
        this.hasDetectedBackendReady = true;
        this.isBackendReady = true;
        this.showStartupBanner();
      } else if (this.isBackendReady === false) {
        logger.error(
          chalk.red(
            "\nBackend failed to start. Check the error messages above.",
          ),
        );
        this.cleanup();
        process.exit(1);
      }
    }, 5000);
  }

  private async startFrontend() {
    logger.info(
      chalk.gray(
        "Starting frontend on port " + this.config.frontendPort + "...",
      ),
    );

    // Quick check if port is available before spawning process
    // This helps catch port conflicts faster than waiting for Vite to report them
    const portAvailable = await this.checkPort(this.config.frontendPort);
    if (!portAvailable) {
      this.frontendError = `Port ${this.config.frontendPort} is already in use`;
      // Don't call showPortConflictError here as it exits immediately
      // Instead, simulate a frontend exit to trigger the error banner
      setTimeout(() => {
        if (this.frontendProcess) {
          this.frontendProcess.emit("exit", 1);
        } else {
          // If no process created yet, show error directly
          console.clear();
          logger.error(
            boxen(
              chalk.red("⚠️  Frontend Failed to Start!\n\n") +
                chalk.white(this.frontendError + "\n\n") +
                chalk.gray("To fix this issue:\n") +
                chalk.gray(
                  `1. Stop the other process using port ${this.config.frontendPort}\n`,
                ) +
                chalk.gray(
                  `2. Check what's using it: ${chalk.cyan(`lsof -i :${this.config.frontendPort}`)}\n`,
                ) +
                chalk.gray(
                  `3. Kill it with: ${chalk.cyan(`kill -9 <PID>`)}\n`,
                ) +
                chalk.gray(`4. Or use a different port in your configuration`),
              {
                padding: 1,
                margin: 1,
                borderStyle: "round",
                borderColor: "red",
              },
            ),
          );
          this.cleanup();
          process.exit(1);
        }
      }, 100);
      return;
    }

    // Handle different frontend command formats
    let cmd: string;
    let args: string[];

    if (this.config.frontendCommand!.includes("cd ")) {
      // Complex command like "cd web && npm run dev"
      // Extract the directory and command
      const cdMatch = this.config.frontendCommand!.match(/cd\s+([^\s&]+)\s*&&\s*(.+)/);
      if (cdMatch) {
        const [, dir, actualCmd] = cdMatch;
        // Run the command in the specified directory
        const parsed = this.parseCommand(actualCmd);
        cmd = parsed.cmd;
        args = parsed.args;
        // Override cwd below to run in the subdirectory
        this.frontendProcess = spawn(cmd, args, {
          stdio: ["inherit", "pipe", "pipe"],
          shell: true,
          detached: true,
          cwd: path.join(process.cwd(), dir), // Run in the subdirectory
          env: {
            ...process.env,
            NODE_ENV: "development",
            FORCE_COLOR: "3",
          },
        });
      } else {
        // Fallback to sh -c for complex commands
        cmd = "sh";
        args = ["-c", this.config.frontendCommand!];
        logger.info(chalk.gray(`Frontend command: ${cmd} ${args.join(" ")}`));
        this.frontendProcess = spawn(cmd, args, {
          stdio: ["inherit", "pipe", "pipe"],
          shell: true,
          detached: true,
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: "development",
            FORCE_COLOR: "3",
          },
        });
      }
    } else if (this.config.frontendCommand === "vite") {
      // Direct vite command
      cmd = "npx";
      args = ["vite", "--port", this.config.frontendPort.toString()];
    } else {
      // Parse other commands
      const parsed = this.parseCommand(this.config.frontendCommand!);
      cmd = parsed.cmd;
      args = parsed.args;
    }

    // Only spawn if not already created above for cd commands
    if (!this.frontendProcess) {
      this.frontendProcess = spawn(cmd, args, {
        stdio: ["inherit", "pipe", "pipe"],
        shell: true,
        detached: true, // Create a new process group
        cwd: process.cwd(), // Explicitly set working directory
        env: {
          ...process.env,
          NODE_ENV: "development",
          FORCE_COLOR: "3",
        },
      });
    }

    this.frontendProcess.stdout?.on("data", (data) => {
      const output = data.toString();

      // Debug: Log all frontend output
      if (process.env.DEBUG_DEV_SERVER) {
        logger.info(chalk.blue(`[Frontend stdout] ${output.trim()}`));
      }

      // Detect when frontend is ready
      if (!this.hasDetectedFrontendReady) {
        if (
          output.includes("ready in") ||
          output.includes("Local:") ||
          output.includes("➜") ||
          output.includes(`${this.config.frontendPort}`)
        ) {
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
      if (output.includes("EADDRINUSE") || output.includes("already in use") ||
          output.includes("Please stop the other process")) {
        // Store error for the exit handler
        this.frontendError = `Port ${this.config.frontendPort} is already in use`;
        logger.error(
          chalk.red(
            `\n⚠️  Port ${this.config.frontendPort} is already in use!`,
          ),
        );
        logger.error(chalk.yellow("Please stop the other process or use a different port.\n"));
        this.cleanup();
        process.exit(1);
      }

      // Show errors
      if (output.toLowerCase().includes("error")) {
        const lines = output.trim().split("\n");
        lines.forEach((line: string) => {
          if (line.trim() && !line.includes("➜")) {
            // Strip existing ANSI codes to prevent corruption
            // eslint-disable-next-line no-control-regex
            const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, "").trim();
            const msg = chalk.red(`[Frontend] ${cleanLine}`);
            if (this.hasShownBanner) {
              logger.error(msg);
            } else {
              this.outputBuffer.push(msg);
            }
          }
        });
      }
    });

    this.frontendProcess.stderr?.on("data", (data) => {
      const output = data.toString().trim();
      if (output) {
        // Debug: Log all frontend stderr
        if (process.env.DEBUG_DEV_SERVER) {
          logger.info(chalk.yellow(`[Frontend stderr] ${output}`));
        }

        // Check for Vite's port conflict error message
        // Vite outputs: "Error: Port XXXX is already in use"
        if (output.includes("Error:") && output.includes("is already in use")) {
          // Extract port number from error message if possible
          const portMatch = output.match(/Port (\d+)/);
          const port = portMatch ? parseInt(portMatch[1]) : this.config.frontendPort;
          this.frontendError = `Port ${port} is already in use`;
          // Don't call showPortConflictError immediately as Vite will exit
          // The exit handler will show the proper error banner
          return;
        }

        // Check for other port conflict formats
        if ((output.includes("Port") && output.includes("is in use")) ||
            output.includes("EADDRINUSE")) {
          // Store error for the exit handler
          this.frontendError = `Port ${this.config.frontendPort} is already in use`;
          // Try to show the error immediately, but Vite might exit first
          this.showPortConflictError(this.config.frontendPort, 'frontend');
          return;
        }

        // Check if Vite is outputting its ready message to stderr
        if (!this.hasDetectedFrontendReady) {
          if (
            output.includes("ready in") ||
            output.includes("Local:") ||
            output.includes("➜") ||
            output.includes(`${this.config.frontendPort}`)
          ) {
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

        // For important errors, show them immediately
        if (output.toLowerCase().includes("error") && !output.includes("ExperimentalWarning")) {
          logger.error(chalk.red(`[Frontend] ${output}`));
        } else if (!this.hasShownBanner) {
          // Buffer other output until banner is shown
          this.outputBuffer.push(output);
        } else {
          // After banner, pass through as-is
          process.stderr.write(output + "\n");
        }
      }
    });

    this.frontendProcess.on("error", (error: any) => {
      // EAGAIN errors are temporary resource issues, retry
      if (error.code === "EAGAIN" && this.retryCount < 3) {
        this.retryCount++;
        logger.warn(
          chalk.yellow(
            `[Frontend] Resource temporarily unavailable, retrying (${this.retryCount}/3)...`,
          ),
        );
        setTimeout(async () => await this.startFrontend(), 1000 * this.retryCount);
        return;
      }

      // For other errors, show in yellow (warning) not red (error) since it might still work
      logger.warn(
        chalk.yellow(`[Frontend] Process spawn warning: ${error.message}`),
      );
      if (process.env.DEBUG_DEV_SERVER) {
        logger.info(chalk.gray(`[Frontend] Command: ${cmd} ${args.join(" ")}`));
        logger.info(chalk.gray(`[Frontend] Directory: ${process.cwd()}`));
      }
    });

    this.frontendProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        // Show specific error if we captured one
        if (this.frontendError) {
          console.clear();
          logger.error(
            boxen(
              chalk.red("⚠️  Frontend Failed to Start!\n\n") +
                chalk.white(this.frontendError + "\n\n") +
                chalk.gray("To fix this issue:\n") +
                chalk.gray(
                  `1. Stop the other process using port ${this.config.frontendPort}\n`,
                ) +
                chalk.gray(
                  `2. Check what's using it: ${chalk.cyan(`lsof -i :${this.config.frontendPort}`)}\n`,
                ) +
                chalk.gray(
                  `3. Kill it with: ${chalk.cyan(`kill -9 <PID>`)}\n`,
                ) +
                chalk.gray(`4. Or use a different port in your configuration`),
              {
                padding: 1,
                margin: 1,
                borderStyle: "round",
                borderColor: "red",
              },
            ),
          );
        } else {
          logger.error(chalk.red(`[Frontend] Exited with code ${code}`));
          if (!this.hasDetectedFrontendReady) {
            logger.error(
              chalk.red(
                `[Frontend] Failed to start properly. Check that the frontend command works manually.`,
              ),
            );
          }
        }
        // Exit the dev-server if frontend fails to start
        if (!this.hasDetectedFrontendReady) {
          this.cleanup();
          process.exit(1);
        }
      }
    });

    // Fallback: Mark as ready after timeout if we haven't detected it
    setTimeout(() => {
      if (!this.hasDetectedFrontendReady) {
        logger.warn(
          chalk.yellow("Frontend ready detection timeout - assuming ready"),
        );
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
        process.kill(-this.backendProcess.pid, "SIGTERM");
      } catch (_e) {
        // Fallback to regular kill
        try {
          this.backendProcess.kill("SIGTERM");
        } catch (_err) {
          // Process might already be dead
        }
      }
      this.backendProcess = null;
    }

    if (this.frontendProcess && this.frontendProcess.pid) {
      try {
        // Kill the entire process group (negative PID)
        process.kill(-this.frontendProcess.pid, "SIGTERM");
      } catch (_e) {
        // Fallback to regular kill
        try {
          this.frontendProcess.kill("SIGTERM");
        } catch (_err) {
          // Process might already be dead
        }
      }
      this.frontendProcess = null;
    }
  }

  private async checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(false);
        } else {
          resolve(true);
        }
      });
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  }

  private async getProcessUsingPort(port: number): Promise<{ pid: string; command: string } | null> {
    try {
      const { execSync } = await import('child_process');
      // Get PID using the port
      const pidOutput = execSync(`lsof -i :${port} -P -t -sTCP:LISTEN 2>/dev/null || true`, { encoding: 'utf-8' });
      const pid = pidOutput.trim().split('\n')[0]; // Get first PID if multiple

      if (!pid) return null;

      // Get full process command
      const commandOutput = execSync(`ps -p ${pid} -o command= 2>/dev/null || echo "unknown"`, { encoding: 'utf-8' }).trim();

      // Simplify the command for display
      let command = commandOutput;
      if (command.includes('node')) {
        if (command.includes('tsx')) command = 'tsx (TypeScript)';
        else if (command.includes('vite')) command = 'vite (dev server)';
        else if (command.includes('nodemon')) command = 'nodemon';
        else command = 'node process';
      }

      return { pid, command };
    } catch {
      return null;
    }
  }

  private async showPortConflictError(port: number, portType: 'backend' | 'frontend' = 'backend') {
    const processInfo = await this.getProcessUsingPort(port);

    console.clear();

    // Build the error message with subtle gray styling like the startup banner
    let lines: string[] = [];
    lines.push('');
    lines.push(`⚠️  ${chalk.yellow(portType.charAt(0).toUpperCase() + portType.slice(1))} port ${chalk.yellow(port)} is already in use!`);
    lines.push('');

    if (processInfo) {
      lines.push(chalk.gray(`Process: ${chalk.yellow(processInfo.command)}`));
      lines.push(chalk.gray(`PID: ${chalk.yellow(processInfo.pid)}`));
      lines.push('');
      lines.push(chalk.gray('🔧 To fix this, run:'));
      lines.push('');
      lines.push(chalk.cyan(`   kill -9 ${processInfo.pid}`));
      lines.push('');
    } else {
      lines.push(chalk.gray('Could not identify the process using this port.'));
      lines.push('');
    }

    lines.push(chalk.gray('Other options:'));
    lines.push(chalk.gray(`• Check what's using it: ${chalk.cyan(`lsof -i :${port}`)}`));
    lines.push(chalk.gray(`• Kill all Node processes: ${chalk.cyan('pkill -f node')}`));
    lines.push(chalk.gray(`• Use a different port in your package.json`));
    lines.push('');

    // Use subtle gray box like the startup banner
    logger.error(boxen(lines.join('\n'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'gray',
      dimBorder: true
    }));

    this.cleanup();
    process.exit(1);
  }

  async start() {
    logger.info(
      chalk.cyan(`\nStarting ${this.config.appName} development server...\n`),
    );

    // Check if backend port is available
    const backendAvailable = await this.checkPort(this.config.backendPort);
    if (!backendAvailable) {
      await this.showPortConflictError(this.config.backendPort, 'backend');
      return;
    }

    // Check if frontend port is available
    const frontendAvailable = await this.checkPort(this.config.frontendPort);
    if (!frontendAvailable) {
      await this.showPortConflictError(this.config.frontendPort, 'frontend');
      return;
    }

    // Start both processes
    this.startBackend();

    // Give backend a moment to start before frontend
    setTimeout(async () => await this.startFrontend(), 1000);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      logger.info(chalk.yellow("\n\nShutting down..."));
      this.cleanup();
      // Force exit after a delay if processes don't terminate
      setTimeout(() => process.exit(0), 1000);
    });

    process.on("SIGTERM", () => {
      this.cleanup();
      process.exit(0);
    });
  }
}

// Run the orchestrator
const orchestrator = new DevServerOrchestrator();
orchestrator.start();
