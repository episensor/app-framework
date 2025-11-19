/**
 * Logger Service
 * Provides centralized logging with rotation, compression, and management
 */

import winston, { Logger as WinstonLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs/promises";
import {
  createReadStream,
  createWriteStream,
  ReadStream,
  existsSync,
} from "fs";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import type { Request, Response } from "express";

// Use process.cwd() based paths for better compatibility
const getLogsDir = () => path.join(process.cwd(), "data", "logs");

interface LogLevels {
  levels: {
    error: number;
    warn: number;
    info: number;
    http: number;
    verbose: number;
    debug: number;
    silly: number;
  };
  colors: {
    error: string;
    warn: string;
    info: string;
    http: string;
    verbose: string;
    debug: string;
    silly: string;
  };
}

interface LoggerOptions {
  level?: string;
  console?: boolean;
  file?: boolean;
  maxSize?: string;
  maxFiles?: string;
  compress?: boolean;
}

interface LogStats {
  totalSize: number;
  fileCount: number;
  files: LogFileInfo[];
  oldestLog?: Date;
  newestLog?: Date;
  archivedCount?: number;
}

interface LogFileInfo {
  name: string;
  size: number;
  modified: Date;
  compressed: boolean;
}

export interface ExtendedWinstonLogger extends WinstonLogger {
  logRequest?: (req: Request, res: Response, duration: number) => void;
  logSimulator?: (simulatorId: string, action: string, data?: any) => void;
  logError?: (error: Error, context?: any) => void;
  // Management helpers (proxied to manager-level functions)
  compactLogs?: (daysToKeep?: number) => Promise<LogStats>;
  getLogStats?: () => Promise<LogStats>;
}

// Log levels with colors
const logLevels: LogLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  },
  colors: {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    verbose: "cyan",
    debug: "blue",
    silly: "gray",
  },
};

// Apply colors to winston
winston.addColors(logLevels.colors);

class Logger {
  private logsDir: string;
  private archiveDir: string;
  private loggers: Map<string, ExtendedWinstonLogger>;
  private initialized: boolean;
  private messageQueue: Array<{ name: string; level: string; args: any[] }>;
  private initPromise?: Promise<void>;

  constructor() {
    this.logsDir = getLogsDir(); // Now defaults to data/logs
    this.archiveDir = path.join(this.logsDir, "archive");
    this.loggers = new Map();
    this.initialized = false;
    this.messageQueue = [];
  }

  async initialize(options?: {
    appName?: string;
    logLevel?: string;
    consoleOutput?: boolean;
    fileOutput?: boolean;
    logsDir?: string;
  }): Promise<void> {
    if (this.initialized) return;

    // If already initializing, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = this._doInitialize(options);
    return this.initPromise;
  }

  private async _doInitialize(options?: {
    appName?: string;
    logLevel?: string;
    consoleOutput?: boolean;
    fileOutput?: boolean;
    logsDir?: string;
  }): Promise<void> {
    // Apply options if provided
    if (options?.logsDir) {
      this.logsDir = options.logsDir;
    }

    // Create log directories
    await this.ensureDirectories();

    // Clean up old root-level log files and subdirectories
    await this.cleanupOldLogs();
    await this.cleanupSubdirectories();

    // Create default logger with options
    this.createLogger(options?.appName || "system", {
      level: options?.logLevel || "info",
      console: options?.consoleOutput !== false,
      file: options?.fileOutput !== false,
    });

    this.initialized = true;

    // Process any queued messages after a small delay to ensure transports are ready
    setTimeout(() => this.processMessageQueue(), 100);
  }

  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const { name, level, args } of messages) {
      const logger = this.createLogger(name);
      if (logger) {
        // Use a type-safe way to call the logger method
        switch (level) {
          case "info":
            (logger.info as any).apply(logger, args);
            break;
          case "error":
            (logger.error as any).apply(logger, args);
            break;
          case "warn":
            (logger.warn as any).apply(logger, args);
            break;
          case "debug":
            (logger.debug as any).apply(logger, args);
            break;
          case "verbose":
            (logger.verbose as any).apply(logger, args);
            break;
          case "http":
            (logger.http as any).apply(logger, args);
            break;
          case "silly":
            (logger.silly as any).apply(logger, args);
            break;
        }
      }
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get recent log entries from memory or file
   */
  async getRecentLogs(
    limit: number = 100,
    level: string = "all",
  ): Promise<any[]> {
    const logsDir = this.logsDir;

    try {
      // Find the most recent log file
      const files = await fs.readdir(logsDir);
      const logFiles = files.filter(
        (f) => f.startsWith("app-") && f.endsWith(".log"),
      );

      if (logFiles.length === 0) {
        // Fallback to app.log if no dated files exist
        const fallbackFile = path.join(logsDir, "app.log");
        if (!existsSync(fallbackFile)) {
          return [];
        }
        logFiles.push("app.log");
      }

      // Sort to get most recent
      logFiles.sort().reverse();
      const logFile = path.join(logsDir, logFiles[0]);

      const content = await fs.readFile(logFile, "utf-8");
      const lines = content.split("\n").filter((line: string) => line.trim());

      // Parse log lines into structured format
      const logs = lines.map((line: string) => {
        // Try to parse JSON format first
        try {
          const jsonLog = JSON.parse(line);
          return {
            timestamp: jsonLog.timestamp || new Date().toISOString(),
            level: (jsonLog.level || "info").toLowerCase(),
            source: jsonLog.source || jsonLog.service || undefined,
            message: jsonLog.message || jsonLog.msg || line,
          };
        } catch {
          // Try to parse standard text format: [timestamp] [level] [source] message
          const match = line.match(
            /\[([\d-T:.Z]+)\]\s*\[(\w+)\]\s*(?:\[([^\]]+)\])?\s*(.*)/,
          );
          if (match) {
            return {
              timestamp: match[1],
              level: match[2].toLowerCase(),
              source: match[3] || undefined,
              message: match[4],
            };
          }
          // Fallback for non-standard format
          return {
            timestamp: new Date().toISOString(),
            level: "info",
            message: line,
          };
        }
      });

      // Filter by level if specified
      const filtered =
        level === "all"
          ? logs
          : logs.filter((log: any) => log.level === level.toLowerCase());

      // Return most recent entries, newest first
      return filtered.slice(-limit).reverse();
    } catch (_error) {
      console.error("Failed to read logs:", _error);
      return [];
    }
  }

  /**
   * Clear all log files
   */
  async clearLogs(): Promise<void> {
    const logsDir = this.logsDir;

    try {
      if (existsSync(logsDir)) {
        const files = await fs.readdir(logsDir);
        for (const file of files) {
          if (file.endsWith(".log") || file.endsWith(".txt")) {
            await fs.unlink(path.join(logsDir, file));
          }
        }
      }
    } catch (_error) {
      console.error("Failed to clear logs:", _error);
      throw _error;
    }
  }

  child(name: string): any {
    // Return a smart proxy that handles both pre and post initialization
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const logMethod = (level: string) => {
      return (...args: any[]) => {
        if (self.initialized) {
          // Use the real logger
          const logger = self.createLogger(name);
          if (logger) {
            const method = (logger as any)[level];
            if (typeof method === "function") {
              method.apply(logger, args);
            }
          }
        } else {
          // Log to console immediately
          const prefix =
            level === "error"
              ? `[${name} ERROR]`
              : level === "warn"
                ? `[${name} WARN]`
                : level === "debug"
                  ? `[${name} DEBUG]`
                  : `[${name}]`;
          const consoleFn =
            level === "error"
              ? console.error
              : level === "warn"
                ? console.warn
                : level === "debug"
                  ? console.debug
                  : console.log;
          consoleFn(prefix, ...args);

          // Queue for file logging
          self.messageQueue.push({ name, level, args });

          // Trigger initialization if not already started
          if (!self.initPromise) {
            self
              .initialize({
                appName: "app",
                logLevel: process.env.LOG_LEVEL || "info",
                consoleOutput: true,
                fileOutput: true,
                logsDir: path.join(process.cwd(), "data", "logs"),
              })
              .catch((err) => {
                console.error("[Logger] Failed to initialize:", err);
              });
          }
        }
      };
    };

    return {
      info: logMethod("info"),
      error: logMethod("error"),
      warn: logMethod("warn"),
      debug: logMethod("debug"),
      verbose: logMethod("verbose"),
      http: logMethod("http"),
      silly: logMethod("silly"),
      logRequest: (req: Request, res: Response, duration: number) => {
        if (self.initialized) {
          const real = self.createLogger(name);
          real?.logRequest?.(req, res, duration);
          return;
        }
        logMethod("info")(
          `Request ${req.method} ${req.url} completed in ${duration}ms`,
        );
      },
      logError: (error: Error, context: any = {}) => {
        if (self.initialized) {
          const real = self.createLogger(name);
          real?.logError?.(error, context);
          return;
        }
        logMethod("error")(error, context);
      },
      compactLogs: (daysToKeep?: number) => self.compactLogs(daysToKeep),
      getLogStats: () => self.getLogStats(),
    };
  }

  private async ensureDirectories(): Promise<void> {
    try {
      // Create only the main logs directory and archive subdirectory
      await fs.mkdir(this.logsDir, { recursive: true });
      await fs.mkdir(this.archiveDir, { recursive: true });
    } catch (_error) {
      console.error("Failed to create log directories:", _error);
    }
  }

  /**
   * Clean up subdirectories to maintain flat structure
   */
  private async cleanupSubdirectories(): Promise<void> {
    try {
      const items = await fs.readdir(this.logsDir);

      for (const item of items) {
        if (item === "archive") continue; // Keep archive directory

        const itemPath = path.join(this.logsDir, item);
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          // Remove empty subdirectories
          try {
            const contents = await fs.readdir(itemPath);
            if (contents.length === 0) {
              await fs.rmdir(itemPath);
              console.log(`Removed empty log subdirectory: ${item}`);
            }
          } catch (_err) {
            console.warn(`Could not clean up subdirectory ${item}:`, _err);
          }
        }
      }
    } catch (_error) {
      // Ignore errors during cleanup
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    const rootDir = process.cwd();
    const topLevelLogsDir = path.join(rootDir, "logs");

    // Check if there's a top-level logs directory
    if (existsSync(topLevelLogsDir)) {
      try {
        // Move any log files to data/logs
        const files = await fs.readdir(topLevelLogsDir);

        for (const file of files) {
          if (file.endsWith(".log") || file.endsWith(".txt")) {
            const oldPath = path.join(topLevelLogsDir, file);
            const newPath = path.join(this.logsDir, file);

            try {
              await fs.rename(oldPath, newPath);
              console.log(`Moved log file from /logs to /data/logs: ${file}`);
            } catch (_err) {
              // File might not exist or already moved
            }
          }
        }

        // Remove top-level logs directory if empty
        const remainingFiles = await fs.readdir(topLevelLogsDir);
        const hasOnlyDsStore =
          remainingFiles.length === 1 && remainingFiles[0] === ".DS_Store";

        if (remainingFiles.length === 0 || hasOnlyDsStore) {
          if (hasOnlyDsStore) {
            await fs
              .unlink(path.join(topLevelLogsDir, ".DS_Store"))
              .catch(() => {});
          }
          await fs.rmdir(topLevelLogsDir);
          console.log("Removed empty top-level logs directory");
        }
      } catch (_error) {
        // Directory might not exist or already cleaned
      }
    }
  }

  createLogger(
    category: string = "general",
    options: LoggerOptions = {},
  ): ExtendedWinstonLogger {
    const loggerKey = `${category}-${JSON.stringify(options)}`;

    if (this.loggers.has(loggerKey)) {
      return this.loggers.get(loggerKey)!;
    }

    // Use flat structure - all logs in data/logs directly
    const logDir = this.logsDir;
    const level = options.level || process.env.LOG_LEVEL || "info";

    // Console format with colors - no JSON output
    const consoleFormat = format.combine(
      format.timestamp({ format: "HH:mm:ss.SSS" }),
      format.colorize(),
      format.printf(({ timestamp, level, message, source, ...meta }) => {
        // Extract commonly used metadata
        const sourceStr = source ? ` [${source}]` : "";

        // For errors, show the error message inline
        if (meta.error && typeof meta.error === "string") {
          return `[${timestamp}] ${level}:${sourceStr} ${message}: ${meta.error}`;
        }

        // For other metadata, format key fields inline (no JSON)
        const importantMeta = [];

        // Handle all common metadata fields
        for (const [key, value] of Object.entries(meta)) {
          // Skip internal winston fields and stack traces
          if (
            key === "stack" ||
            key === "timestamp" ||
            key === "level" ||
            key === "message"
          )
            continue;

          // Format the value appropriately
          if (value !== undefined && value !== null) {
            importantMeta.push(`${key}=${value}`);
          }
        }

        const metaStr =
          importantMeta.length > 0 ? ` (${importantMeta.join(", ")})` : "";

        return `[${timestamp}] ${level}:${sourceStr} ${message}${metaStr}`;
      }),
    );

    // File format (structured JSON for machine parsing)
    // Strip ANSI codes from messages before writing to file
    const stripAnsi = format((info) => {
      if (info.message && typeof info.message === 'string') {
        info.message = info.message.replace(/\x1b\[[0-9;]*m/g, '');
      }
      if (info.source && typeof info.source === 'string') {
        info.source = info.source.replace(/\x1b\[[0-9;]*m/g, '');
      }
      return info;
    });

    const fileFormat = format.combine(
      stripAnsi(),
      format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
      format.errors({ stack: true }),
      format.json(),
    );

    // Create transports
    const logTransports: any[] = [];

    // Console transport
    if (
      options.console !== false &&
      (process.env.NODE_ENV !== "production" ||
        process.env.LOG_TO_CONSOLE === "true")
    ) {
      logTransports.push(
        new transports.Console({
          format: consoleFormat,
          level: level,
        }),
      );
    }

    // File transports - flat structure in data/logs
    if (options.file !== false) {
      // Daily rotating file transport for all logs
      logTransports.push(
        new DailyRotateFile({
          filename: path.join(logDir, "app-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          zippedArchive: options.compress !== false,
          maxSize: options.maxSize || "20m",
          maxFiles: options.maxFiles || "14d",
          format: fileFormat,
          level: level,
          auditFile: path.join(logDir, ".app-audit.json"),
        }),
      );

      // Separate error log file
      logTransports.push(
        new DailyRotateFile({
          filename: path.join(logDir, "error-%DATE%.log"),
          datePattern: "YYYY-MM-DD",
          zippedArchive: options.compress !== false,
          maxSize: options.maxSize || "20m",
          maxFiles: "30d",
          format: fileFormat,
          level: "error",
          auditFile: path.join(logDir, ".error-audit.json"),
        }),
      );
    }

    // Create the logger
    const logger = winston.createLogger({
      levels: logLevels.levels,
      transports: logTransports.filter(Boolean),
      exitOnError: false,
      defaultMeta: { source: category },
    }) as ExtendedWinstonLogger;

    // Add convenience methods
    logger.logRequest = (
      req: Request,
      res: Response,
      duration: number,
    ): void => {
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      };

      if (res.statusCode >= 400) {
        logger.error("Request failed", logData);
      } else {
        logger.http("Request completed", logData);
      }
    };

    logger.logSimulator = (
      simulatorId: string,
      action: string,
      data: any = {},
    ): void => {
      logger.info(`Simulator ${action}`, {
        simulatorId,
        action,
        ...data,
      });
    };

    logger.logError = (error: Error, context: any = {}): void => {
      logger.error(error.message, {
        stack: error.stack,
        name: error.name,
        ...context,
      });
    };

    this.loggers.set(loggerKey, logger);
    return logger;
  }

  async getLogStats(): Promise<LogStats> {
    const stats: LogStats = {
      totalSize: 0,
      fileCount: 0,
      files: [],
      oldestLog: undefined,
      newestLog: undefined,
    };

    try {
      const files = await fs.readdir(this.logsDir);

      for (const file of files) {
        // Skip directories and non-log files
        if (file === "archive" || file.startsWith(".")) continue;

        const filePath = path.join(this.logsDir, file);
        const stat = await fs.stat(filePath);

        if (stat.isFile() && (file.endsWith(".log") || file.endsWith(".gz"))) {
          const fileInfo: LogFileInfo = {
            name: file,
            size: stat.size,
            modified: stat.mtime,
            compressed: file.endsWith(".gz"),
          };

          stats.files.push(fileInfo);
          stats.totalSize += stat.size;
          stats.fileCount++;

          // Track oldest and newest
          if (!stats.oldestLog || stat.mtime < stats.oldestLog) {
            stats.oldestLog = stat.mtime;
          }
          if (!stats.newestLog || stat.mtime > stats.newestLog) {
            stats.newestLog = stat.mtime;
          }
        }
      }

      // Sort files by date (newest first)
      stats.files.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    } catch (_error) {
      console.error("Failed to get log stats:", _error);
    }

    return stats;
  }

  async archiveLogs(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      const files = await fs.readdir(this.logsDir);

      for (const file of files) {
        if (file === "archive" || file.startsWith(".")) continue;

        const filePath = path.join(this.logsDir, file);
        const stat = await fs.stat(filePath);

        if (stat.isFile() && stat.mtime < cutoffDate) {
          const archivePath = path.join(this.archiveDir, file);

          if (file.endsWith(".log")) {
            // Compress before archiving
            const gzipPath = `${archivePath}.gz`;
            const source = createReadStream(filePath);
            const destination = createWriteStream(gzipPath);
            const gzip = createGzip();

            await pipeline(source, gzip, destination);
            await fs.unlink(filePath);
          } else {
            // Already compressed, just move
            await fs.rename(filePath, archivePath);
          }
        }
      }
    } catch (_error) {
      console.error("Failed to archive logs:", _error);
    }
  }

  async downloadLogFile(filename: string): Promise<ReadStream | null> {
    const safeName = path.basename(filename); // Prevent path traversal
    const logPath = path.join(this.logsDir, safeName);
    const archivePath = path.join(this.archiveDir, safeName);

    // Check in main logs directory first
    if (existsSync(logPath)) {
      return createReadStream(logPath);
    }

    // Check in archive
    if (existsSync(archivePath)) {
      return createReadStream(archivePath);
    }

    return null;
  }

  /**
   * Compact logs by archiving old files
   */
  async compactLogs(daysToKeep: number = 7): Promise<LogStats> {
    await this.ensureDirectories();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let archivedCount = 0;
    let totalSize = 0;

    try {
      const files = await fs.readdir(this.logsDir);

      for (const file of files) {
        if (!file.endsWith(".log")) continue;

        const filePath = path.join(this.logsDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          // Archive the file
          const archivePath = path.join(this.archiveDir, `${file}.gz`);

          await pipeline(
            createReadStream(filePath),
            createGzip({ level: 9 }),
            createWriteStream(archivePath),
          );

          await fs.unlink(filePath);
          archivedCount++;
          totalSize += stats.size;
        }
      }

      // Get updated stats
      const updatedStats = await this.getLogStats();

      const appLogger = this.createLogger("system");
      appLogger.info(
        `Compacted ${archivedCount} log files (${totalSize} bytes)`,
      );

      return updatedStats;
    } catch (_error) {
      const appLogger = this.createLogger("system");
      appLogger.error("Failed to compact logs:", _error);
      throw _error;
    }
  }

  /**
   * Clean up zero-length files and corrupted archives
   */
  async cleanupZeroFiles(): Promise<{ removed: number }> {
    await this.ensureDirectories();

    let removed = 0;
    const directories = [this.logsDir, this.archiveDir];

    for (const dir of directories) {
      try {
        const files = await fs.readdir(dir);

        for (const file of files) {
          if (file.endsWith(".gz") || file.endsWith(".log")) {
            const filePath = path.join(dir, file);
            const stats = await fs.stat(filePath);

            if (stats.size === 0) {
              await fs.unlink(filePath);
              removed++;
            }
          }
        }
      } catch (_error) {
        const appLogger = this.createLogger("system");
        appLogger.warn(`Failed to clean directory ${dir}:`, _error);
      }
    }

    const appLogger = this.createLogger("system");
    appLogger.info(`Cleaned up ${removed} zero-length files`);

    return { removed };
  }

  /**
   * Purge all logs (dangerous operation)
   */
  async purgeAllLogs(): Promise<void> {
    const removeRecursive = async (dirPath: string) => {
      if (!existsSync(dirPath)) return;

      const entries = await fs.readdir(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
          await removeRecursive(fullPath);
          await fs.rmdir(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }
    };

    await removeRecursive(this.logsDir);

    // Recreate directories
    await this.ensureDirectories();

    const appLogger = this.createLogger("system");
    appLogger.warn("All logs have been purged");
  }

  /**
   * Export logs in various formats
   */
  async exportLogs(
    options: {
      level?: string;
      format?: "txt" | "json" | "csv";
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<string> {
    const { level = "all", format = "txt", startDate, endDate } = options;

    const currentLogFile = path.join(
      this.logsDir,
      `app-${new Date().toISOString().split("T")[0]}.log`,
    );

    if (!existsSync(currentLogFile)) {
      throw new Error("No logs found for export");
    }

    const content = await fs.readFile(currentLogFile, "utf8");
    const lines = content.split("\n").filter((line) => line.trim());

    // Filter by level if specified
    let filteredLines = lines;
    if (level !== "all") {
      const levelUpper = level.toUpperCase();
      filteredLines = lines.filter(
        (line) =>
          line.includes(`[${levelUpper}]`) || line.includes(` ${levelUpper} `),
      );
    }

    // Filter by date range if specified
    if (startDate || endDate) {
      filteredLines = filteredLines.filter((line) => {
        const timestampMatch = line.match(
          /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
        );
        if (!timestampMatch) return true;

        const lineDate = new Date(timestampMatch[0]);
        if (startDate && lineDate < startDate) return false;
        if (endDate && lineDate > endDate) return false;

        return true;
      });
    }

    // Format output based on requested format
    switch (format) {
      case "json": {
        const entries = filteredLines.map((line) => {
          try {
            // Try to parse as JSON first
            if (line.trim().startsWith("{")) {
              return JSON.parse(line);
            }

            // Parse text format
            const match = line.match(
              /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+\[(\w+)\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/,
            );
            if (match) {
              const [, timestamp, level, category, message] = match;
              return {
                timestamp,
                level: level.toLowerCase(),
                category: category || "general",
                message,
              };
            }

            return { message: line };
          } catch {
            return { message: line };
          }
        });

        return JSON.stringify(entries, null, 2);
      }

      case "csv": {
        const csv = ["Timestamp,Level,Category,Message"];

        filteredLines.forEach((line) => {
          const match = line.match(
            /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+\[(\w+)\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/,
          );
          if (match) {
            const [, timestamp, level, category, message] = match;
            csv.push(
              `"${timestamp}","${level}","${category || ""}","${message.replace(/"/g, '""')}"`,
            );
          }
        });

        return csv.join("\n");
      }

      case "txt":
      default:
        return filteredLines.join("\n");
    }
  }

  /**
   * Get list of all log files including archives
   */
  async getAllLogFiles(): Promise<LogFileInfo[]> {
    const files: LogFileInfo[] = [];

    // Get files from logs directory
    if (existsSync(this.logsDir)) {
      const logFiles = await fs.readdir(this.logsDir);
      for (const file of logFiles) {
        if (file.startsWith("app-") || file.startsWith("error-")) {
          const fullPath = path.join(this.logsDir, file);
          const stats = await fs.stat(fullPath);
          files.push({
            name: file,
            size: stats.size,
            modified: stats.mtime,
            compressed: false,
          });
        }
      }
    }

    // Get files from archive directory
    if (existsSync(this.archiveDir)) {
      const archiveFiles = await fs.readdir(this.archiveDir);
      for (const file of archiveFiles) {
        const fullPath = path.join(this.archiveDir, file);
        const stats = await fs.stat(fullPath);
        files.push({
          name: `archive/${file}`,
          size: stats.size,
          modified: stats.mtime,
          compressed: file.endsWith(".gz"),
        });
      }
    }

    // Sort by modified date (newest first)
    files.sort((a, b) => b.modified.getTime() - a.modified.getTime());

    return files;
  }

  /**
   * Get all logger instances (for rotation)
   */
  getLoggers(): Map<string, ExtendedWinstonLogger> {
    return this.loggers;
  }
}

// Export singleton instance and functions
const logger = new Logger();

export function createLogger(name?: string): any {
  if (!name) {
    return logger.child("App");
  }
  return logger.child(name);
}

export function initializeLogger(options?: any): Promise<void> {
  return logger.initialize(options);
}

export function configureLogging(options?: any): void {
  // For backward compatibility - just trigger initialization
  logger.initialize(options).catch((err) => {
    console.error("Failed to configure logging:", err);
  });
}

export async function getLogStats(): Promise<LogStats> {
  return logger.getLogStats();
}

export async function archiveLogs(olderThanDays?: number): Promise<void> {
  return logger.archiveLogs(olderThanDays);
}

export async function downloadLogFile(
  filename: string,
): Promise<ReadStream | null> {
  return logger.downloadLogFile(filename);
}

export async function getRecentLogs(
  limit?: number,
  level?: string,
): Promise<any[]> {
  return logger.getRecentLogs(limit, level);
}

export async function clearLogs(): Promise<void> {
  return logger.clearLogs();
}

// Export both as default and named export
export default logger;
export { logger as getLogger };
