/**
 * Core Framework Components
 *
 * These are generic, reusable components that could be extracted
 * into a separate npm package for use in other applications.
 */

// Framework version
export const FRAMEWORK_VERSION = "3.1.0";

// Process Management
export { StandardServer, createStandardServer } from "./StandardServer.js";
export type { StandardServerConfig } from "./StandardServer.js";
export {
  clearPort,
  isPortAvailable,
  getPortInfo,
  getProcessOnPort,
  findAvailablePort,
  checkRequiredPorts,
  formatPortStatus,
  waitForPort,
  getPortsInUse,
  type ProcessInfo,
  type PortStatus,
  type PortClearResult,
  type PortStatusResult,
} from "./portUtils.js";

// Logging - Consolidated logger implementation
export {
  getLogger,
  default as Logger,
  createLogger as createLoggerBase,
} from "./logger.js";

import { createLogger as createLoggerImport } from "./logger.js";

/**
 * Create a logger instance with automatic file output
 * @param name - The name/category for this logger
 * @returns A logger instance that writes to console and files
 */
export function createLogger(name: string) {
  // Use the createLogger function from logger
  return createLoggerImport(name);
}

// Export types for backward compatibility
export interface Logger {
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

// Security
export {
  getStorageService,
  StorageService,
  getSecureFileHandler,
  SecureFileHandler,
} from "./storageService.js";

/**
 * Usage Example:
 *
 * import { StandardServer, createLogger } from '@/core';
 *
 * const logger = createLogger('MyApp');
 * const server = new StandardServer({
 *   appName: 'MyApp',
 *   appVersion: '1.0.0',
 *   port: 8080
 * });
 * await server.initialize();
 * await server.start();
 */
