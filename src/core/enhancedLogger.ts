/**
 * Enhanced Logger Service
 * Provides centralized logging with rotation, compression, and management
 */

import winston, { Logger as WinstonLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream, ReadStream, existsSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Request, Response } from 'express';

// Use process.cwd() based paths for better compatibility
const getLogsDir = () => path.join(process.cwd(), 'data', 'logs');

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
}

interface LogFileInfo {
  name: string;
  size: number;
  modified: Date;
  compressed: boolean;
}

interface EnhancedWinstonLogger extends WinstonLogger {
  logRequest?: (req: Request, res: Response, duration: number) => void;
  logSimulator?: (simulatorId: string, action: string, data?: any) => void;
  logError?: (error: Error, context?: any) => void;
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
    silly: 6
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'gray'
  }
};

// Apply colors to winston
winston.addColors(logLevels.colors);

class EnhancedLogger {
  private logsDir: string;
  private archiveDir: string;
  private loggers: Map<string, EnhancedWinstonLogger>;
  private initialized: boolean;
  private messageQueue: Array<{ name: string; level: string; args: any[] }>;
  private initPromise?: Promise<void>;

  constructor() {
    this.logsDir = getLogsDir();  // Now defaults to data/logs
    this.archiveDir = path.join(this.logsDir, 'archive');
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
    this.createLogger(options?.appName || 'system', {
      level: options?.logLevel || 'info',
      console: options?.consoleOutput !== false,
      file: options?.fileOutput !== false
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
          case 'info':
            (logger.info as any).apply(logger, args);
            break;
          case 'error':
            (logger.error as any).apply(logger, args);
            break;
          case 'warn':
            (logger.warn as any).apply(logger, args);
            break;
          case 'debug':
            (logger.debug as any).apply(logger, args);
            break;
          case 'verbose':
            (logger.verbose as any).apply(logger, args);
            break;
          case 'http':
            (logger.http as any).apply(logger, args);
            break;
          case 'silly':
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
  async getRecentLogs(limit: number = 100, level: string = 'all'): Promise<any[]> {
    const logsDir = this.logsDir;
    
    try {
      // Find the most recent log file
      const files = await fs.readdir(logsDir);
      const logFiles = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));
      
      if (logFiles.length === 0) {
        // Fallback to app.log if no dated files exist
        const fallbackFile = path.join(logsDir, 'app.log');
        if (!existsSync(fallbackFile)) {
          return [];
        }
        logFiles.push('app.log');
      }
      
      // Sort to get most recent
      logFiles.sort().reverse();
      const logFile = path.join(logsDir, logFiles[0]);

      const content = await fs.readFile(logFile, 'utf-8');
      const lines = content.split('\n').filter((line: string) => line.trim());
      
      // Parse log lines into structured format
      const logs = lines.map((line: string) => {
        // Try to parse JSON format first
        try {
          const jsonLog = JSON.parse(line);
          return {
            timestamp: jsonLog.timestamp || new Date().toISOString(),
            level: (jsonLog.level || 'info').toLowerCase(),
            source: jsonLog.source || jsonLog.service || undefined,
            message: jsonLog.message || jsonLog.msg || line
          };
        } catch {
          // Try to parse standard text format: [timestamp] [level] [source] message
          const match = line.match(/\[([\d-T:.Z]+)\]\s*\[(\w+)\]\s*(?:\[([^\]]+)\])?\s*(.*)/);
          if (match) {
            return {
              timestamp: match[1],
              level: match[2].toLowerCase(),
              source: match[3] || undefined,
              message: match[4]
            };
          }
          // Fallback for non-standard format
          return {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: line
          };
        }
      });

      // Filter by level if specified
      const filtered = level === 'all' 
        ? logs 
        : logs.filter((log: any) => log.level === level.toLowerCase());

      // Return most recent entries, newest first
      return filtered.slice(-limit).reverse();
    } catch (error) {
      console.error('Failed to read logs:', error);
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
          if (file.endsWith('.log') || file.endsWith('.txt')) {
            await fs.unlink(path.join(logsDir, file));
          }
        }
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
      throw error;
    }
  }

  child(name: string): any {
    // Return a smart proxy that handles both pre and post initialization
    const self = this;
    
    const logMethod = (level: string) => {
      return (...args: any[]) => {
        if (self.initialized) {
          // Use the real logger
          const logger = self.createLogger(name);
          if (logger) {
            const method = (logger as any)[level];
            if (typeof method === 'function') {
              method.apply(logger, args);
            }
          }
        } else {
          // Log to console immediately
          const prefix = level === 'error' ? `[${name} ERROR]` : 
                         level === 'warn' ? `[${name} WARN]` : 
                         level === 'debug' ? `[${name} DEBUG]` : 
                         `[${name}]`;
          const consoleFn = level === 'error' ? console.error :
                           level === 'warn' ? console.warn :
                           level === 'debug' ? console.debug :
                           console.log;
          consoleFn(prefix, ...args);
          
          // Queue for file logging
          self.messageQueue.push({ name, level, args });
          
          // Trigger initialization if not already started
          if (!self.initPromise) {
            self.initialize({
              appName: 'app',
              logLevel: process.env.LOG_LEVEL || 'info',
              consoleOutput: true,
              fileOutput: true,
              logsDir: path.join(process.cwd(), 'data', 'logs')
            }).catch(err => {
              console.error('[EnhancedLogger] Failed to initialize:', err);
            });
          }
        }
      };
    };
    
    return {
      info: logMethod('info'),
      error: logMethod('error'),
      warn: logMethod('warn'),
      debug: logMethod('debug'),
      verbose: logMethod('verbose'),
      http: logMethod('http'),
      silly: logMethod('silly')
    };
  }

  private async ensureDirectories(): Promise<void> {
    try {
      // Create only the main logs directory and archive subdirectory
      await fs.mkdir(this.logsDir, { recursive: true });
      await fs.mkdir(this.archiveDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directories:', error);
    }
  }

  /**
   * Clean up subdirectories to maintain flat structure
   */
  private async cleanupSubdirectories(): Promise<void> {
    try {
      const items = await fs.readdir(this.logsDir);
      
      for (const item of items) {
        if (item === 'archive') continue; // Keep archive directory
        
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
          } catch (err) {
            console.warn(`Could not clean up subdirectory ${item}:`, err);
          }
        }
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    const rootDir = process.cwd();
    const topLevelLogsDir = path.join(rootDir, 'logs');
    
    // Check if there's a top-level logs directory
    if (existsSync(topLevelLogsDir)) {
      try {
        // Move any log files to data/logs
        const files = await fs.readdir(topLevelLogsDir);
        
        for (const file of files) {
          if (file.endsWith('.log') || file.endsWith('.txt')) {
            const oldPath = path.join(topLevelLogsDir, file);
            const newPath = path.join(this.logsDir, file);
            
            try {
              await fs.rename(oldPath, newPath);
              console.log(`Moved log file from /logs to /data/logs: ${file}`);
            } catch (err) {
              // File might not exist or already moved
            }
          }
        }
        
        // Remove top-level logs directory if empty
        const remainingFiles = await fs.readdir(topLevelLogsDir);
        const hasOnlyDsStore = remainingFiles.length === 1 && remainingFiles[0] === '.DS_Store';
        
        if (remainingFiles.length === 0 || hasOnlyDsStore) {
          if (hasOnlyDsStore) {
            await fs.unlink(path.join(topLevelLogsDir, '.DS_Store')).catch(() => {});
          }
          await fs.rmdir(topLevelLogsDir);
          console.log('Removed empty top-level logs directory');
        }
      } catch (error) {
        // Directory might not exist or already cleaned
      }
    }
  }

  createLogger(category: string = 'general', options: LoggerOptions = {}): EnhancedWinstonLogger {
    const loggerKey = `${category}-${JSON.stringify(options)}`;
    
    if (this.loggers.has(loggerKey)) {
      return this.loggers.get(loggerKey)!;
    }

    // Use flat structure - all logs in data/logs directly
    const logDir = this.logsDir;
    const level = options.level || process.env.LOG_LEVEL || 'info';

    // Console format with colors
    const consoleFormat = format.combine(
      format.timestamp({ format: 'HH:mm:ss.SSS' }),
      format.colorize(),
      format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
      })
    );

    // File format (plain text for readability and standard log tools)
    const fileFormat = format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.printf(({ timestamp, level, message, source, ...meta }) => {
        const sourceStr = source || category !== 'general' ? ` [${source || category}]` : '';
        const metaStr = Object.keys(meta).length > 0 && !meta.stack ? ` ${JSON.stringify(meta)}` : '';
        const stackStr = meta.stack ? `\n${meta.stack}` : '';
        return `[${timestamp}] [${level.toUpperCase()}]${sourceStr} ${message}${metaStr}${stackStr}`;
      })
    );

    // Create transports
    const logTransports: any[] = [];

    // Console transport
    if (options.console !== false && (process.env.NODE_ENV !== 'production' || process.env.LOG_TO_CONSOLE === 'true')) {
      logTransports.push(
        new transports.Console({
          format: consoleFormat,
          level: level
        })
      );
    }

    // File transports - flat structure in data/logs
    if (options.file !== false) {
      // Daily rotating file transport for all logs
      logTransports.push(
        new DailyRotateFile({
          filename: path.join(logDir, 'app-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: options.compress !== false,
          maxSize: options.maxSize || '20m',
          maxFiles: options.maxFiles || '14d',
          format: fileFormat,
          level: level,
          auditFile: path.join(logDir, '.app-audit.json')
        })
      );

      // Separate error log file
      logTransports.push(
        new DailyRotateFile({
          filename: path.join(logDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: options.compress !== false,
          maxSize: options.maxSize || '20m',
          maxFiles: '30d',
          format: fileFormat,
          level: 'error',
          auditFile: path.join(logDir, '.error-audit.json')
        })
      );
    }

    // Create the logger
    const logger = winston.createLogger({
      levels: logLevels.levels,
      transports: logTransports,
      exitOnError: false,
      defaultMeta: { source: category }
    }) as EnhancedWinstonLogger;

    // Add convenience methods
    logger.logRequest = (req: Request, res: Response, duration: number): void => {
      const logData = {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent')
      };
      
      if (res.statusCode >= 400) {
        logger.error('Request failed', logData);
      } else {
        logger.http('Request completed', logData);
      }
    };

    logger.logSimulator = (simulatorId: string, action: string, data: any = {}): void => {
      logger.info(`Simulator ${action}`, {
        simulatorId,
        action,
        ...data
      });
    };

    logger.logError = (error: Error, context: any = {}): void => {
      logger.error(error.message, {
        stack: error.stack,
        name: error.name,
        ...context
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
      newestLog: undefined
    };

    try {
      const files = await fs.readdir(this.logsDir);
      
      for (const file of files) {
        // Skip directories and non-log files
        if (file === 'archive' || file.startsWith('.')) continue;
        
        const filePath = path.join(this.logsDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile() && (file.endsWith('.log') || file.endsWith('.gz'))) {
          const fileInfo: LogFileInfo = {
            name: file,
            size: stat.size,
            modified: stat.mtime,
            compressed: file.endsWith('.gz')
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
    } catch (error) {
      console.error('Failed to get log stats:', error);
    }

    return stats;
  }

  async archiveLogs(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      const files = await fs.readdir(this.logsDir);
      
      for (const file of files) {
        if (file === 'archive' || file.startsWith('.')) continue;
        
        const filePath = path.join(this.logsDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile() && stat.mtime < cutoffDate) {
          const archivePath = path.join(this.archiveDir, file);
          
          if (file.endsWith('.log')) {
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
    } catch (error) {
      console.error('Failed to archive logs:', error);
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
}

// Export singleton instance and functions
const logger = new EnhancedLogger();

export function createLogger(name?: string): any {
  if (!name) {
    return logger.child('App');
  }
  return logger.child(name);
}

export function initializeLogger(options?: any): Promise<void> {
  return logger.initialize(options);
}

export function configureLogging(options?: any): void {
  // For backward compatibility - just trigger initialization
  logger.initialize(options).catch(err => {
    console.error('Failed to configure logging:', err);
  });
}

export async function getLogStats(): Promise<LogStats> {
  return logger.getLogStats();
}

export async function archiveLogs(olderThanDays?: number): Promise<void> {
  return logger.archiveLogs(olderThanDays);
}

export async function downloadLogFile(filename: string): Promise<ReadStream | null> {
  return logger.downloadLogFile(filename);
}

export async function getRecentLogs(limit?: number, level?: string): Promise<any[]> {
  return logger.getRecentLogs(limit, level);
}

export async function clearLogs(): Promise<void> {
  return logger.clearLogs();
}

// Export both as default and named export
export default logger;
export { logger as getEnhancedLogger };