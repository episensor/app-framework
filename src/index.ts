/**
 * EpiSensor App Framework
 * Main entry point for the TypeScript framework
 */

// Core exports
export * from './core/index.js';
// API Response utilities are exported separately to avoid conflicts
export { 
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendBadRequest,
  sendCreated,
  sendNoContent,
  asyncHandler,
  apiErrorHandler,
  type ApiResponse,
  type ApiErrorResponse,
  type ApiSuccessResponse
} from './core/apiResponse.js';

// Service exports
export * from './services/index.js';

// Middleware exports
export * from './middleware/index.js';
export * from './middleware/auth.js';
export { configureSession, sessionUtils, createRedisStore } from './middleware/session.js';
export type { SessionConfig as FrameworkSessionConfig } from './middleware/session.js';

// Utility exports
export * from './utils/index.js';

// Re-export commonly used items at top level
export { createLogger, type Logger, type LogLevel } from './core/index.js';
export { StandardServer, createStandardServer } from './core/StandardServer.js';
export type { StandardServerConfig } from './core/StandardServer.js';
export { StorageService, getStorageService, SecureFileHandler, getSecureFileHandler } from './core/storageService.js';
export { createWebSocketServer, getWebSocketServer } from './services/websocketServer.js';
export { validate, schemas } from './middleware/validation.js';

// Testing utilities
export { 
  TestServer, 
  createTestServer, 
  setupTestServer, 
  teardownTestServer, 
  getTestServer 
} from './testing/TestServer.js';
export type { TestServerConfig } from './testing/TestServer.js';

// Standardized API routers
export { default as logsRouter } from './api/logsRouter.js';
export type { LogEntry as RouterLogEntry, LogFile } from './api/logsRouter.js';

// Desktop integration exports
export * from './desktop/index.js';

// System monitoring exports
export { getSystemMonitor } from './services/systemMonitor.js';
export type { SystemHealth, CPUInfo, MemoryInfo, DiskInfo, SystemInfo, ProcessInfo } from './services/systemMonitor.js';

// Health check exports
export { 
  createHealthCheckRouter, 
  getHealthCheckService,
  type SystemHealth as HealthStatus,
  type SystemMetrics,
  type HealthCheckOptions,
  type CustomHealthCheck,
  type HealthCheckResult,
  type DependencyHealth
} from './core/healthCheck.js';

// WebSocket Manager exports

// Configuration management exports
export {
  ConfigManager,
  getConfigManager,
  CommonSchemas,
  type ConfigManagerOptions,
  type ConfigChangeEvent
} from './core/configManager.js';

// Tauri build utilities
export {
  buildTauriSidecar,
  generateBuildSidecarScript,
  type TauriBundleOptions
} from './build/tauriBundler.js';

// Settings Schema exports - Consolidated implementation
export {
  createSettingsSchema,
  flattenSettings,
  unflattenSettings,
  flattenSettingsValues,
  unflattenSettingsValues,
  getRestartRequiredSettings,
  validateSettings,
  validateSetting,
  validateAllSettings,
  getSettingByKey,
  getDefaultSettingsValues,
  evaluateFieldVisibility,
  groupFields,
  applyToStorageTransform,
  applyFromStorageTransform,
  createSettingsFormState,
  Validators,
  type SettingsSchema,
  type SettingsCategory,
  type SettingDefinition,
  type SettingOption,
  type SettingsFormState,
  type SettingsValidationResult
} from './settings/SettingsSchema.js';

// Log Categories exports
export {
  LogLevels,
  defaultLogViewerConfig,
  parseLogEntry,
  formatLogEntry,
  calculateLogStats,
  filterLogEntries,
  type LogCategory,
  type LogFilter,
  type LogViewerConfig,
  type LogEntry,
  type LogStats
} from './logging/LogCategories.js';
