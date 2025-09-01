/**
 * Test Server Utility
 * Provides standardized test server management for all EpiSensor applications
 */

import { spawn, ChildProcess } from 'child_process';
import { execSync } from 'child_process';
import { createLogger } from '../core/index.js';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('TestServer');
  }
  return logger;
}

export interface TestServerConfig {
  /** Path to the application entry point */
  entryPoint: string;
  /** Port to run the server on */
  port: number;
  /** API base URL */
  apiBase?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout for server startup (ms) */
  startupTimeout?: number;
  /** Health check endpoint */
  healthEndpoint?: string;
  /** Whether to suppress server output */
  silent?: boolean;
}

export class TestServer {
  private process: ChildProcess | null = null;
  private config: Required<TestServerConfig>;
  private startPromise: Promise<void> | null = null;
  public port: number;

  constructor(config: TestServerConfig) {
    this.port = config.port;
    this.config = {
      apiBase: `http://localhost:${config.port}`,
      env: {},
      startupTimeout: 30000,
      healthEndpoint: '/api/health',
      silent: true,
      ...config
    };
  }

  /**
   * Clean up any existing processes on the port
   */
  private cleanupPort(): void {
    try {
      if (process.platform === 'win32') {
        // Windows: Find and kill process using the port
        execSync(`netstat -ano | findstr :${this.config.port} | findstr LISTENING`, { stdio: 'ignore' });
        const result = execSync(`netstat -ano | findstr :${this.config.port} | findstr LISTENING`).toString();
        const lines = result.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          }
        }
      } else {
        // Unix-like: Use lsof to find and kill process
        execSync(`lsof -ti:${this.config.port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
      }
    } catch (_error) {
      // Port might already be free, ignore errors
    }
  }

  /**
   * Wait for the server to be ready
   */
  private async waitForServer(): Promise<void> {
    const startTime = Date.now();
    const { apiBase, healthEndpoint, startupTimeout } = this.config;
    const healthUrl = `${apiBase}${healthEndpoint}`;
    
    if (!this.config.silent) {
      console.log(`Waiting for server at ${healthUrl}...`);
    }
    
    while (Date.now() - startTime < startupTimeout) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const response = await fetch(healthUrl, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          if (!this.config.silent) {
            console.log(`Server is ready at ${healthUrl}`);
          }
          return; // Server is ready
        }
      } catch (_error) {
        // Server not ready yet
      }
      
      // Check if process has exited
      if (this.process && this.process.exitCode !== null) {
        throw new Error(`Server process exited with code ${this.process.exitCode}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Server failed to start within ${startupTimeout}ms`);
  }

  /**
   * Start the test server
   */
  async start(): Promise<void> {
    // Return existing promise if already starting
    if (this.startPromise) {
      return this.startPromise;
    }

    // Already running
    if (this.process) {
      return;
    }

    this.startPromise = this._start();
    return this.startPromise;
  }

  private async _start(): Promise<void> {
    // Clean up any existing processes
    this.cleanupPort();

    // Determine command based on entry point extension
    const { entryPoint } = this.config;
    const isTypeScript = entryPoint.endsWith('.ts');
    const command = isTypeScript ? 'npx' : 'node';
    const args = isTypeScript ? ['tsx', entryPoint] : [entryPoint];

    // Start the server process
    this.process = spawn(command, args, {
      env: {
        ...process.env,
        ...this.config.env,
        NODE_ENV: 'test',
        PORT: String(this.config.port),
        API_PORT: String(this.config.port),
        SILENT_STARTUP: '1'
      },
      stdio: this.config.silent ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    });

    // Handle process output if not silent
    if (this.config.silent && this.process.stdout && this.process.stderr) {
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        // Only log errors or important messages
        if (output.includes('ERROR') || output.includes('WARN')) {
          ensureLogger().debug(`Server output: ${output}`);
        }
      });

      this.process.stderr.on('data', (data) => {
        ensureLogger().error(`Server error: ${data}`);
      });
    }

    // Handle process exit
    this.process.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        ensureLogger().error(`Server process exited with code ${code}`);
      }
    });

    // Wait for server to be ready
    await this.waitForServer();
    ensureLogger().debug(`Test server started on port ${this.config.port}`);
  }

  /**
   * Stop the test server
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const cleanup = () => {
        this.process = null;
        this.startPromise = null;
        resolve();
      };

      // Set a timeout for graceful shutdown
      const killTimeout = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
        cleanup();
      }, 5000);

      this.process.on('exit', () => {
        clearTimeout(killTimeout);
        cleanup();
      });

      // Try graceful shutdown first
      this.process.kill('SIGTERM');
    });
  }

  /**
   * Get the API base URL
   */
  getApiBase(): string {
    return this.config.apiBase;
  }

  /**
   * Make a request to the test server
   */
  async request(endpoint: string, options: any = {}): Promise<any> {
    const url = `${this.config.apiBase}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
      response
    };
  }
}

/**
 * Create a test server instance
 */
export function createTestServer(config: TestServerConfig): TestServer {
  return new TestServer(config);
}

/**
 * Global test server instance for Jest
 */
let globalTestServer: TestServer | null = null;

/**
 * Setup function for Jest beforeAll
 */
export async function setupTestServer(config: TestServerConfig): Promise<void> {
  globalTestServer = new TestServer(config);
  await globalTestServer.start();
}

/**
 * Teardown function for Jest afterAll
 */
export async function teardownTestServer(): Promise<void> {
  if (globalTestServer) {
    await globalTestServer.stop();
    globalTestServer = null;
  }
}

/**
 * Get the global test server instance
 */
export function getTestServer(): TestServer | null {
  return globalTestServer;
}
