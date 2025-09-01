/**
 * Standard Server Implementation
 * A simplified, consistent server pattern for all EpiSensor applications
 * Combines the best of StartupOrchestrator with the simplicity apps need
 */

import express, { Express } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { createWebSocketServer } from '../services/websocketServer.js';
import { displayStartupBanner } from '../utils/startupBanner.js';
import { getProcessOnPort } from './portUtils.js';
import { createLogger, getEnhancedLogger } from './index.js';
import { aiErrorHandler } from '../middleware/aiErrorHandler.js';
import { apiErrorHandler } from './apiResponse.js';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('Server');
  }
  return logger;
}

export interface StandardServerConfig {
  appName: string;
  appVersion: string;
  description?: string;
  port?: number;
  webPort?: number;  // Optional separate web UI port
  host?: string;
  environment?: string;
  enableWebSocket?: boolean;
  onInitialize?: (app: Express) => Promise<void>;
  onStart?: () => Promise<void>;
}

/**
 * Standard server implementation that all apps should use
 * Handles startup, error handling, and banner display consistently
 */
export class StandardServer {
  private app: Express;
  private httpServer: HttpServer | HttpsServer;
  private config: StandardServerConfig;
  private wsServer: any;
  private startTime: number;
  private isInitialized: boolean = false;

  constructor(config: StandardServerConfig) {
    const environment = process.env.NODE_ENV || 'development';
    // Default to localhost for development, 0.0.0.0 for production/containerized environments
    const defaultHost = environment === 'development' ? '127.0.0.1' : '0.0.0.0';
    
    this.config = {
      port: 8080,
      host: process.env.HOST || config.host || defaultHost,
      environment,
      enableWebSocket: true,
      ...config
    };
    
    this.app = express();
    this.httpServer = createServer(this.app);
    this.startTime = Date.now();
  }

  /**
   * Get the Express app instance for middleware setup
   */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Get the HTTP server instance
   */
  public getServer(): HttpServer | HttpsServer {
    return this.httpServer;
  }

  /**
   * Initialize the server (setup middleware, routes, etc.)
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize the logger first to ensure file output works
      const enhancedLogger = getEnhancedLogger;
      if (!enhancedLogger.isInitialized()) {
        await enhancedLogger.initialize({
          appName: this.config.appName,
          logLevel: process.env.LOG_LEVEL || 'info',
          consoleOutput: true,
          fileOutput: true,
          logsDir: './data/logs'
        });
      }

      // Setup default middleware
      this.setupDefaultMiddleware();

      // Call custom initialization if provided
      if (this.config.onInitialize) {
        await this.config.onInitialize(this.app);
      }

      // Setup error handlers (should be last)
      this.setupErrorHandlers();

      // Initialize WebSocket if enabled
      if (this.config.enableWebSocket) {
        this.wsServer = createWebSocketServer(this.httpServer);
      }

      this.isInitialized = true;
    } catch (_error: any) {
      ensureLogger().error('Server initialization failed:', _error);
      throw _error;
    }
  }

  /**
   * Setup default middleware for all applications
   */
  private setupDefaultMiddleware(): void {
    // Basic middleware that should be present in all apps
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  /**
   * Setup error handlers (should be last in middleware chain)
   */
  private setupErrorHandlers(): void {
    // AI error handler for AI service errors
    this.app.use(aiErrorHandler);
    
    // Standardized API error handler
    this.app.use(apiErrorHandler);
  }

  /**
   * Start the server and listen on the configured port
   */
  public async start(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Server not initialized. Call initialize() first.');
    }

    const port = this.config.port!;
    const host = this.config.host!;

    // Check if API port is available
    const processOnPort = await getProcessOnPort(port);
    if (processOnPort) {
      ensureLogger().error(`API port ${port} is already in use by: PID ${processOnPort.pid} (${processOnPort.command})`);
      process.exit(1);
    }

    return new Promise((resolve) => {
      // Handle server errors
      this.httpServer.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          ensureLogger().error(`Port ${port} is already in use`);
          process.exit(1);
        } else if (error.code === 'EACCES') {
          ensureLogger().error(`Port ${port} requires elevated privileges`);
          process.exit(1);
        } else {
          ensureLogger().error('Server error:', error);
          process.exit(1);
        }
      });

      // Start listening
      this.httpServer.listen(port, host, async () => {
        // Display banner only after successful binding
        // Note: In production, webPort is typically not used because the API server 
        // serves the UI assets directly from the main port. However, if webPort
        // is explicitly configured, respect it.
        
        // Only display banner if not suppressed
        if (process.env.SUPPRESS_STARTUP_BANNER !== 'true') {
          displayStartupBanner({
            appName: this.config.appName,
            appVersion: this.config.appVersion,
            description: this.config.description,
            port: this.config.port!,
            webPort: this.config.webPort,  // Pass the actual configured webPort
            environment: this.config.environment,
            startTime: this.startTime
          });
        }

        // Call custom start handler if provided
        if (this.config.onStart) {
          try {
            await this.config.onStart();
          } catch (_error) {
            ensureLogger().error('Custom start handler failed:', _error);
            process.exit(1);
          }
        }

        resolve();
      });
    });
  }

  /**
   * Stop the server gracefully
   */
  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wsServer) {
        this.wsServer.shutdown();
      }

      this.httpServer.close(() => {
        ensureLogger().info('Server stopped');
        resolve();
      });
    });
  }
}

/**
 * Convenience function to create and start a standard server
 */
export async function createStandardServer(config: StandardServerConfig): Promise<StandardServer> {
  const server = new StandardServer(config);
  await server.initialize();
  await server.start();
  return server;
}
