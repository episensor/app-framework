/**
 * Standard Server Implementation
 * A simplified, consistent server pattern for all EpiSensor applications
 * Combines the best of StartupOrchestrator with the simplicity apps need
 */

import express, { Express } from "express";
import { createServer, Server as HttpServer } from "http";
import { Server as HttpsServer } from "https";
import cors from "cors";
import { createWebSocketServer } from "../services/websocketServer.js";
import { displayStartupBanner } from "../utils/startupBanner.js";
import { getProcessOnPort } from "./portUtils.js";
import { createLogger, getLogger } from "./index.js";
import { aiErrorHandler } from "../middleware/aiErrorHandler.js";
import { apiErrorHandler } from "./apiResponse.js";
import { createRequestLoggingMiddleware } from "../middleware/requestLogging.js";
import {
  getAppDataPath,
  getLogsPath,
  isDesktopApp,
} from "../utils/appPaths.js";

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger("Server");
  }
  return logger;
}

export interface StandardServerConfig {
  appName: string;
  appVersion: string;
  description?: string;
  port?: number;
  webPort?: number; // Optional separate web UI port
  host?: string;
  environment?: string;
  enableWebSocket?: boolean;
  /**
   * When true (default), startup failures will terminate the Node process.
   * Disable in test environments to surface errors as rejections instead.
   */
  exitOnStartupError?: boolean;
  // Optional logging configuration (not all fields are used yet)
  logging?: {
    level?: string;
    maxSize?: string;
    maxFiles?: string | number;
    datePattern?: string;
    zippedArchive?: boolean;
  };
  // Desktop app specific
  appId?: string; // App identifier for desktop (e.g. 'com.episensor.appname')
  enableDesktopIntegration?: boolean; // Auto-configure for desktop apps
  desktopDataPath?: string; // Override desktop data path
  corsOrigins?: string[]; // Additional CORS origins for desktop apps
  onInitialize?: (app: Express, io?: any) => Promise<void>;
  onStart?: () => Promise<void>;
  /**
   * Request payload size limit passed to express.json/urlencoded
   */
  bodyLimit?: string | number;
  /**
   * Whether to log requests using the framework logger (defaults to true)
   */
  enableRequestLogging?: boolean;
  /**
   * Options forwarded to the request logging middleware
   */
  requestLogging?: Parameters<typeof createRequestLoggingMiddleware>[0];
  /**
   * Configure trust proxy setting for Express (defaults to true for prod)
   */
  trustProxy?: boolean | string;
  /**
   * Custom timeouts for the underlying HTTP server
   */
  requestTimeoutMs?: number;
  headersTimeoutMs?: number;
  keepAliveTimeoutMs?: number;
  /**
   * Signals that should trigger a graceful shutdown. Set to [] to disable.
   */
  gracefulShutdownSignals?: NodeJS.Signals[];
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
  private shuttingDown = false;
  private signalsBound = false;

  constructor(config: StandardServerConfig) {
    const environment = process.env.NODE_ENV || "development";
    // Default to localhost for development, 0.0.0.0 for production/containerized environments
    const defaultHost = environment === "development" ? "127.0.0.1" : "0.0.0.0";

    // Auto-enable desktop integration if running in Tauri or explicitly enabled
    const enableDesktopIntegration =
      config.enableDesktopIntegration ?? isDesktopApp();

    this.config = {
      port: 8080,
      host: process.env.HOST || config.host || defaultHost,
      environment,
      enableWebSocket: true,
      bodyLimit: "10mb",
      requestTimeoutMs: 120_000,
      headersTimeoutMs: 65_000,
      keepAliveTimeoutMs: 60_000,
      gracefulShutdownSignals: ["SIGTERM", "SIGINT"],
      enableRequestLogging: true,
      enableDesktopIntegration,
      appId:
        config.appId ||
        `com.company.${config.appName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      exitOnStartupError:
        config.exitOnStartupError ?? process.env.NODE_ENV !== "test",
      ...config,
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
      // Setup desktop-specific paths, CORS, and logging if running as desktop app
      if (this.config.enableDesktopIntegration) {
        await this.setupDesktopIntegration();
      }

      // Initialize the logger first to ensure file output works
      const logger = getLogger;
      if (logger && typeof logger.isInitialized === "function" && !logger.isInitialized()) {
        // Use proper logs directory for desktop apps
        const logsDir = this.config.enableDesktopIntegration
          ? getLogsPath(this.config.appId!, this.config.appName)
          : "./data/logs";

        await logger.initialize({
          appName: this.config.appName,
          logLevel:
            this.config.logging?.level || process.env.LOG_LEVEL || "info",
          consoleOutput: true,
          fileOutput: true,
          logsDir,
        });
      }

      // Setup default middleware
      this.setupDefaultMiddleware();

      // Initialize WebSocket if enabled (before onInitialize so it can be passed)
      if (this.config.enableWebSocket) {
        this.wsServer = createWebSocketServer(this.httpServer);
      }

      // Call custom initialization if provided, passing the WebSocket server
      if (this.config.onInitialize) {
        await this.config.onInitialize(this.app, this.wsServer);
      }

      // Setup error handlers (should be last)
      this.setupErrorHandlers();

      this.isInitialized = true;
    } catch (_error: any) {
      ensureLogger().error("Server initialization failed:", _error);
      throw _error;
    }
  }

  /**
   * Setup desktop app integration (CORS, data paths, logging, etc.)
   */
  private async setupDesktopIntegration(): Promise<void> {
    ensureLogger().info("Setting up desktop app integration", {
      appId: this.config.appId,
      isDesktopApp: isDesktopApp(),
      dataPath:
        this.config.desktopDataPath ||
        getAppDataPath(this.config.appId!, this.config.appName),
    });

    // Initialize logging for desktop apps
    const logger = getLogger;
    if (!logger.isInitialized()) {
      const logsDir = getLogsPath(this.config.appId!, this.config.appName);
      await logger.initialize({
        appName: this.config.appName,
        logLevel: process.env.LOG_LEVEL || "info",
        consoleOutput: true,
        fileOutput: true,
        logsDir,
      });
      ensureLogger().info("Logging initialized for desktop app", { logsDir });
    }

    // Setup CORS for desktop apps
    const corsOrigins: string[] = [...(this.config.corsOrigins || [])];

    // Add localhost origins based on webPort if specified
    if (this.config.webPort) {
      corsOrigins.push(
        `http://localhost:${this.config.webPort}`,
        `http://localhost:${this.config.webPort + 1}`, // Common development pattern
      );
    }

    // Add Tauri origins when running in desktop mode
    if (isDesktopApp()) {
      corsOrigins.push("tauri://localhost", "https://tauri.localhost");
    }

    this.app.use(
      cors({
        origin: corsOrigins,
        credentials: true,
      }),
    );
  }

  /**
   * Setup default middleware for all applications
   */
  private setupDefaultMiddleware(): void {
    // Basic middleware that should be present in all apps
    this.app.use(express.json({ limit: this.config.bodyLimit }));
    this.app.use(
      express.urlencoded({ extended: true, limit: this.config.bodyLimit }),
    );

    // CORS setup for non-desktop apps (desktop setup happens in setupDesktopIntegration)
    if (!this.config.enableDesktopIntegration) {
      const corsOrigins = [...(this.config.corsOrigins || [])];

      // Add localhost origins based on webPort if specified
      if (this.config.webPort) {
        corsOrigins.push(
          `http://localhost:${this.config.webPort}`,
          `http://localhost:${this.config.webPort + 1}`, // Common development pattern
        );
      }

      if (corsOrigins.length > 0) {
        this.app.use(
          cors({
            origin: corsOrigins,
            credentials: true,
          }),
        );
      } else {
        this.app.use(cors());
      }
    }

    // Request logging (can be disabled)
    if (this.config.enableRequestLogging) {
      this.app.use(
        createRequestLoggingMiddleware({
          logger: ensureLogger(),
          ...this.config.requestLogging,
        }),
      );
    }

    // Trust proxy to respect X-Forwarded-* headers in containerized/proxy envs
    const trustProxy =
      this.config.trustProxy ??
      (this.config.environment !== "development" ? true : false);
    if (typeof this.app.set === "function") {
      this.app.set("trust proxy", trustProxy);
    }
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
      throw new Error("Server not initialized. Call initialize() first.");
    }

    const port = this.config.port!;
    const host = this.config.host!;
    const exitOnError = this.config.exitOnStartupError !== false;

    // Check if API port is available
    const processOnPort = await getProcessOnPort(port);
    if (processOnPort) {
      const message = `API port ${port} is already in use by: PID ${processOnPort.pid} (${processOnPort.command})`;
      ensureLogger().error(message);
      if (exitOnError) {
        process.exit(1);
      }
      throw new Error(message);
    }

    return new Promise((resolve, reject) => {
      const fail = (error: Error) => {
        ensureLogger().error("Server error:", error);
        if (exitOnError) {
          process.exit(1);
        }
        reject(error);
      };

      // Handle server errors
      this.httpServer.on("error", (error: any) => {
        if (error.code === "EADDRINUSE") {
          const message = `Port ${port} is already in use`;
          ensureLogger().error(message);
          if (exitOnError) {
            process.exit(1);
          }
          reject(new Error(message));
          return;
        } else if (error.code === "EACCES") {
          const message = `Port ${port} requires elevated privileges`;
          ensureLogger().error(message);
          if (exitOnError) {
            process.exit(1);
          }
          reject(new Error(message));
          return;
        } else {
          fail(error instanceof Error ? error : new Error(String(error)));
          return;
        }
      });

      // Start listening
      // Apply safer timeouts for production workloads
      this.httpServer.requestTimeout = this.config.requestTimeoutMs!;
      this.httpServer.headersTimeout = this.config.headersTimeoutMs!;
      this.httpServer.keepAliveTimeout = this.config.keepAliveTimeoutMs!;

      this.httpServer.listen(port, host, async () => {
        // Display banner only after successful binding
        // Note: In production, webPort is typically not used because the API server
        // serves the UI assets directly from the main port. However, if webPort
        // is explicitly configured, respect it.

        // Only display banner if not suppressed
        if (process.env.SUPPRESS_STARTUP_BANNER !== "true") {
          displayStartupBanner({
            appName: this.config.appName,
            appVersion: this.config.appVersion,
            description: this.config.description,
            port: this.config.port!,
            webPort: this.config.webPort, // Pass the actual configured webPort
            environment: this.config.environment,
            startTime: this.startTime,
          });
        }

        // Call custom start handler if provided
        if (this.config.onStart) {
          try {
            await this.config.onStart();
          } catch (_error) {
            const error =
              _error instanceof Error ? _error : new Error(String(_error));
            ensureLogger().error("Custom start handler failed:", error);
            if (exitOnError) {
              process.exit(1);
            }
            reject(error);
            return;
          }
        }

        // Bind graceful shutdown signals once per instance
        this.bindShutdownSignals();

        resolve();
      });
    });
  }

  /**
   * Get the data path for desktop apps (platform-specific)
   */
  public getDataPath(): string {
    if (this.config.enableDesktopIntegration) {
      return (
        this.config.desktopDataPath ||
        getAppDataPath(this.config.appId!, this.config.appName)
      );
    }
    return "./data";
  }

  /**
   * Check if running as desktop app
   */
  public isDesktopApp(): boolean {
    return this.config.enableDesktopIntegration || false;
  }

  /**
   * Attach signal listeners for graceful shutdown
   */
  private bindShutdownSignals(): void {
    if (this.signalsBound) return;
    if (!this.config.gracefulShutdownSignals?.length) return;

    const signals = this.config.gracefulShutdownSignals;
    signals.forEach((signal) => {
      process.on(signal, async () => {
        ensureLogger().info(`Received ${signal}, shutting down gracefully...`);
        try {
          await this.stop();
          process.exit(0);
        } catch (error) {
          ensureLogger().error("Graceful shutdown failed", error);
          process.exit(1);
        }
      });
    });

    this.signalsBound = true;
  }

  /**
   * Stop the server gracefully
   */
  public async stop(): Promise<void> {
    if (this.shuttingDown) return Promise.resolve();
    this.shuttingDown = true;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ensureLogger().warn("Force closing server after timeout");
        resolve();
      }, 10_000);

      const close = () => {
        clearTimeout(timeout);
        ensureLogger().info("Server stopped");
        resolve();
      };

      try {
        if (this.wsServer?.shutdown) {
          this.wsServer.shutdown();
        }

        this.httpServer.close((err?: Error) => {
          if (err) {
            ensureLogger().error("Error while stopping server", err);
            reject(err);
            return;
          }
          close();
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}

/**
 * Convenience function to create and start a standard server
 */
export async function createStandardServer(
  config: StandardServerConfig,
): Promise<StandardServer> {
  const server = new StandardServer(config);
  await server.initialize();
  await server.start();
  return server;
}
