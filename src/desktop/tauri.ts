/**
 * Tauri Integration Module
 * Provides utilities for integrating Node.js backends with Tauri desktop apps
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { createLogger } from '../core/index.js';
import net from 'net';

const logger = createLogger('TauriIntegration');

export interface BackendConfig {
  executable: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  port: number;
  host?: string;
  healthEndpoint?: string;
  startupTimeout?: number;
}

export class BackendManager {
  private process: ChildProcess | null = null;
  private config: BackendConfig;
  private isRunning: boolean = false;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 3;

  constructor(config: BackendConfig) {
    this.config = {
      host: '127.0.0.1',
      healthEndpoint: '/health',
      startupTimeout: 30000,
      ...config
    };
  }

  /**
   * Start the backend process
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Backend is already running');
      return;
    }

    logger.info('Starting backend process...');

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        NODE_ENV: 'production',
        DESKTOP_MODE: 'true',
        PORT: String(this.config.port),
        HOST: this.config.host,
        ...this.config.env
      };

      this.process = spawn(this.config.executable, this.config.args || [], {
        env,
        cwd: this.config.cwd,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Handle stdout
      this.process.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        if (message) {
          logger.info(`Backend: ${message}`);
        }
      });

      // Handle stderr
      this.process.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message && !message.includes('DEBUG')) {
          logger.error(`Backend Error: ${message}`);
        }
      });

      // Handle process exit
      this.process.on('exit', (code) => {
        this.isRunning = false;
        if (code !== 0) {
          logger.error(`Backend exited with code ${code}`);
          this.handleCrash();
        }
      });

      // Handle process error
      this.process.on('error', (error) => {
        this.isRunning = false;
        logger.error('Failed to start backend:', error);
        reject(error);
      });

      // Wait for backend to be ready
      this.waitForBackend()
        .then(() => {
          this.isRunning = true;
          this.restartAttempts = 0;
          logger.info('Backend started successfully');
          resolve();
        })
        .catch(reject);
    });
  }

  /**
   * Stop the backend process
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    logger.info('Stopping backend process...');

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      this.process.once('exit', () => {
        this.isRunning = false;
        this.process = null;
        logger.info('Backend stopped');
        resolve();
      });

      // Try graceful shutdown first
      this.process.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Restart the backend process
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Check if backend is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const url = `http://${this.config.host}:${this.config.port}${this.config.healthEndpoint}`;
      const response = await fetch(url);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Wait for backend to be ready
   */
  private async waitForBackend(): Promise<void> {
    const startTime = Date.now();
    const timeout = this.config.startupTimeout!;

    while (Date.now() - startTime < timeout) {
      if (await this.isPortOpen(this.config.port)) {
        // Port is open, check health endpoint
        if (await this.checkHealth()) {
          return;
        }
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Backend failed to start within ${timeout}ms`);
  }

  /**
   * Check if a port is open
   */
  private isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.once('error', () => {
        resolve(false);
      });

      socket.connect(port, this.config.host || '127.0.0.1');
    });
  }

  /**
   * Handle backend crash with auto-restart
   */
  private async handleCrash(): Promise<void> {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      logger.error('Max restart attempts reached. Backend will not be restarted.');
      return;
    }

    this.restartAttempts++;
    logger.info(`Attempting to restart backend (attempt ${this.restartAttempts}/${this.maxRestartAttempts})...`);

    setTimeout(() => {
      this.start().catch((_error) => {
        logger.error('Failed to restart backend:', _error);
      });
    }, 2000 * this.restartAttempts); // Exponential backoff
  }

  /**
   * Get process information
   */
  getProcessInfo(): { pid?: number; isRunning: boolean } {
    return {
      pid: this.process?.pid,
      isRunning: this.isRunning
    };
  }
}

/**
 * IPC Communication Helper
 * Facilitates communication between Tauri frontend and Node.js backend
 */
export class IPCBridge {
  private handlers: Map<string, (...args: any[]) => any> = new Map();

  /**
   * Register a handler for an IPC message
   */
  on(event: string, handler: (...args: any[]) => any): void {
    this.handlers.set(event, handler);
  }

  /**
   * Send a message through IPC
   */
  async send(event: string, data?: any): Promise<any> {
    // This would integrate with Tauri's IPC system
    // For now, we'll use HTTP as the transport
    const handler = this.handlers.get(event);
    if (handler) {
      return handler(data);
    }
  }

  /**
   * Remove a handler
   */
  off(event: string): void {
    this.handlers.delete(event);
  }
}

/**
 * App Data Directory Manager
 * Handles application data storage in platform-specific locations
 */
export class AppDataManager {
  private appName: string;
  private dataDir: string;

  constructor(appName: string) {
    this.appName = appName;
    this.dataDir = this.getDataDirectory();
  }

  /**
   * Get platform-specific data directory
   */
  private getDataDirectory(): string {
    const platform = process.platform;
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';

    switch (platform) {
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', this.appName);
      case 'win32':
        return path.join(process.env.APPDATA || '', this.appName);
      case 'linux':
        return path.join(homeDir, '.config', this.appName);
      default:
        return path.join(homeDir, `.${this.appName}`);
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDir(): Promise<void> {
    await fs.ensureDir(this.dataDir);
  }

  /**
   * Get path to a file in the data directory
   */
  getPath(...segments: string[]): string {
    return path.join(this.dataDir, ...segments);
  }

  /**
   * Read a JSON file from the data directory
   */
  async readJson(filename: string): Promise<any> {
    const filepath = this.getPath(filename);
    if (await fs.pathExists(filepath)) {
      return fs.readJson(filepath);
    }
    return null;
  }

  /**
   * Write a JSON file to the data directory
   */
  async writeJson(filename: string, data: any): Promise<void> {
    await this.ensureDataDir();
    const filepath = this.getPath(filename);
    await fs.writeJson(filepath, data, { spaces: 2 });
  }

  /**
   * Check if a file exists in the data directory
   */
  async exists(filename: string): Promise<boolean> {
    const filepath = this.getPath(filename);
    return fs.pathExists(filepath);
  }

  /**
   * Delete a file from the data directory
   */
  async delete(filename: string): Promise<void> {
    const filepath = this.getPath(filename);
    if (await fs.pathExists(filepath)) {
      await fs.remove(filepath);
    }
  }

  /**
   * Get the full data directory path
   */
  getDataDir(): string {
    return this.dataDir;
  }
}

/**
 * Auto-updater integration for Tauri apps
 */
export class AutoUpdater {
  private updateUrl: string;
  private currentVersion: string;
  private checkInterval: number = 3600000; // 1 hour
  private intervalId: NodeJS.Timeout | null = null;

  constructor(updateUrl: string, currentVersion: string) {
    this.updateUrl = updateUrl;
    this.currentVersion = currentVersion;
  }

  /**
   * Start checking for updates
   */
  startChecking(): void {
    this.checkForUpdates();
    this.intervalId = setInterval(() => {
      this.checkForUpdates();
    }, this.checkInterval);
  }

  /**
   * Stop checking for updates
   */
  stopChecking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check for available updates
   */
  async checkForUpdates(): Promise<{ available: boolean; version?: string }> {
    try {
      const response = await fetch(this.updateUrl);
      const data = await response.json() as { version?: string };

      if (data.version && data.version !== this.currentVersion) {
        logger.info(`Update available: ${data.version}`);
        return { available: true, version: data.version };
      }

      return { available: false };
    } catch (_error) {
      logger.error('Failed to check for updates:', _error);
      return { available: false };
    }
  }

  /**
   * Download and install update
   */
  async downloadUpdate(version: string): Promise<void> {
    // This would integrate with Tauri's updater
    // For now, we'll just log the action
    logger.info(`Downloading update ${version}...`);
    // Implementation would depend on Tauri's update mechanism
  }
}

/**
 * Window state manager for remembering window position and size
 */
export class WindowStateManager {
  private appData: AppDataManager;
  private stateFile: string = 'window-state.json';

  constructor(appName: string) {
    this.appData = new AppDataManager(appName);
  }

  /**
   * Save window state
   */
  async saveState(state: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    isMaximized?: boolean;
    isFullscreen?: boolean;
  }): Promise<void> {
    await this.appData.writeJson(this.stateFile, state);
  }

  /**
   * Load window state
   */
  async loadState(): Promise<any> {
    return this.appData.readJson(this.stateFile);
  }

  /**
   * Clear saved state
   */
  async clearState(): Promise<void> {
    await this.appData.delete(this.stateFile);
  }
}

export default {
  BackendManager,
  IPCBridge,
  AppDataManager,
  AutoUpdater,
  WindowStateManager
};