/**
 * Shared TypeScript Type Definitions
 */

/**
 * Field validation error detail
 */
export interface FieldValidationError {
  field: string;
  message: string;
}

/**
 * Standardized API response structure for all applications
 * Supports both legacy string errors and new structured errors
 * @template T - The type of the data payload
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string | {
    code: string;
    message: string;
    details?: any;
    stack?: string; // Only in development
  };
  message?: string; // Optional success message
  errors?: FieldValidationError[]; // For validation errors
  metadata?: {
    timestamp: string;
    version?: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
  timestamp?: string; // Legacy field for backward compatibility
}

/**
 * Legacy simple error format (deprecated - for backward compatibility)
 * @deprecated Use structured error object instead
 */
export interface ApiResponseLegacy<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

/**
 * Configuration options
 */
export interface ConfigOptions {
  configPath?: string;
  defaultConfig?: any;
  watchChanges?: boolean;
}

/**
 * Network interface information
 */
export interface NetworkInterface {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
  mac?: string;
}

/**
 * Update check result
 */
export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
}

/**
 * WebSocket client information
 */
export interface ClientInfo {
  id: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
}

/**
 * Logger interface
 */
export interface Logger {
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface SimulatorUpdateMessage extends WebSocketMessage {
  type: 'simulator:started' | 'simulator:stopped' | 'simulator:data';
  data: Simulator;
}

export interface TemplateUpdateMessage extends WebSocketMessage {
  type: 'template:created' | 'template:updated' | 'template:deleted';
  data: Template;
}

export interface DataUpdateMessage extends WebSocketMessage {
  type: 'data:update';
  data: {
    simulatorId: string;
    values: Record<string, any>;
  };
}

export interface Simulator {
  id: string;
  name: string;
  status: string;
  [key: string]: any;
}

export interface Template {
  id: string;
  name: string;
  [key: string]: any;
}

export interface AppConfig {
  [key: string]: any;
}

export interface ValidationError extends Error {
  details?: any[];
}
