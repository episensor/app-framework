/**
 * Configuration Management Service
 * Provides schema validation, file watching, and environment variable merging
 */

import fs from 'fs/promises';
import { existsSync, watch, FSWatcher } from 'fs';
import path from 'path';
import { z, ZodSchema } from 'zod';
import dotenv from 'dotenv';
import { EventEmitter } from 'events';
import { createLogger } from './logger.js';

const logger = createLogger('ConfigManager');

export interface ConfigManagerOptions {
  configPath?: string;
  envPath?: string;
  schema?: ZodSchema;
  watchFile?: boolean;
  defaults?: any;
  mergeEnv?: boolean;
}

export interface ConfigChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

export class ConfigManager extends EventEmitter {
  private config: any = {};
  private configPath: string;
  private envPath?: string;
  private schema?: ZodSchema;
  private watcher?: FSWatcher;
  private defaults: any;
  private mergeEnv: boolean;
  private isInitialized: boolean = false;
  private debounceTimer?: NodeJS.Timeout;

  constructor(options: ConfigManagerOptions = {}) {
    super();
    this.configPath = options.configPath || path.join(process.cwd(), 'data', 'config', 'app.json');
    this.envPath = options.envPath;
    this.schema = options.schema;
    this.defaults = options.defaults || {};
    this.mergeEnv = options.mergeEnv !== false;

    if (options.watchFile) {
      this.startWatching();
    }
  }

  /**
   * Initialize configuration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load environment variables first
      if (this.mergeEnv) {
        this.loadEnvironmentVariables();
      }

      // Load configuration file
      await this.loadConfig();

      this.isInitialized = true;
      logger.debug('Configuration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize configuration:', error);
      throw error;
    }
  }

  /**
   * Load environment variables
   */
  private loadEnvironmentVariables(): void {
    // Load from .env file if specified
    if (this.envPath && existsSync(this.envPath)) {
      const result = dotenv.config({ path: this.envPath });
      if (result.error) {
        logger.warn('Failed to load .env file:', result.error);
      } else {
        logger.info(`Loaded environment variables from ${this.envPath}`);
      }
    }

    // Also check for default .env file
    const defaultEnvPath = path.join(process.cwd(), '.env');
    if (existsSync(defaultEnvPath) && defaultEnvPath !== this.envPath) {
      dotenv.config({ path: defaultEnvPath });
    }
  }

  /**
   * Load configuration from file
   */
  async loadConfig(): Promise<void> {
    try {
      // Start with defaults
      let config = { ...this.defaults };

      // Load from file if it exists
      if (existsSync(this.configPath)) {
        const fileContent = await fs.readFile(this.configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        config = this.deepMerge(config, fileConfig);
        logger.debug(`Loaded configuration from ${this.configPath}`);
      } else {
        logger.debug(`Configuration file not found at ${this.configPath}, using defaults`);
        // Create the config directory if it doesn't exist
        const configDir = path.dirname(this.configPath);
        if (!existsSync(configDir)) {
          await fs.mkdir(configDir, { recursive: true });
        }
        // Save defaults to file
        await this.saveConfig(config);
      }

      // Merge with environment variables
      if (this.mergeEnv) {
        config = this.mergeWithEnvironment(config);
      }

      // Validate against schema if provided
      if (this.schema) {
        const validationResult = this.schema.safeParse(config);
        if (!validationResult.success) {
          logger.error('Configuration validation failed:', validationResult.error);
          throw new Error(`Invalid configuration: ${validationResult.error.message}`);
        }
        config = validationResult.data;
      }

      // Store the config
      const oldConfig = this.config;
      this.config = config;

      // Emit change events for differences
      if (oldConfig && Object.keys(oldConfig).length > 0) {
        this.detectAndEmitChanges(oldConfig, config);
      }
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  async saveConfig(config?: any): Promise<void> {
    const configToSave = config || this.config;
    
    try {
      // Ensure directory exists
      const configDir = path.dirname(this.configPath);
      if (!existsSync(configDir)) {
        await fs.mkdir(configDir, { recursive: true });
      }

      // Write config file
      await fs.writeFile(
        this.configPath,
        JSON.stringify(configToSave, null, 2),
        'utf-8'
      );

      logger.info(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      logger.error('Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Get configuration value by key (supports dot notation)
   */
  get<T = any>(key?: string): T {
    if (!key) {
      return this.config as T;
    }

    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined as T;
      }
    }

    return value as T;
  }

  /**
   * Set configuration value by key (supports dot notation)
   */
  async set(key: string, value: any): Promise<void> {
    const keys = key.split('.');
    const lastKey = keys.pop()!;
    
    let target = this.config;
    for (const k of keys) {
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }

    const oldValue = target[lastKey];
    target[lastKey] = value;

    // Validate if schema is present
    if (this.schema) {
      const validationResult = this.schema.safeParse(this.config);
      if (!validationResult.success) {
        // Revert the change
        target[lastKey] = oldValue;
        throw new Error(`Invalid configuration: ${validationResult.error.message}`);
      }
    }

    // Save to file
    await this.saveConfig();

    // Emit change event
    this.emit('configChanged', {
      key,
      oldValue,
      newValue: value,
      timestamp: new Date()
    } as ConfigChangeEvent);
  }

  /**
   * Update multiple configuration values
   */
  async update(updates: Record<string, any>): Promise<void> {
    const oldConfig = { ...this.config };

    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      await this.set(key, value);
    }

    // Detect and emit changes
    this.detectAndEmitChanges(oldConfig, this.config);
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    this.config = { ...this.defaults };
    await this.saveConfig();
    this.emit('configReset', { timestamp: new Date() });
  }

  /**
   * Reload configuration from file
   */
  async reload(): Promise<void> {
    await this.loadConfig();
    this.emit('configReloaded', { timestamp: new Date() });
  }

  /**
   * Get typed configuration
   */
  getTyped<T>(): T {
    if (!this.schema) {
      throw new Error('Schema is required for typed configuration');
    }
    return this.config as T;
  }

  /**
   * Validate configuration against schema
   */
  validate(config?: any): { valid: boolean; errors?: any } {
    if (!this.schema) {
      return { valid: true };
    }

    const configToValidate = config || this.config;
    const result = this.schema.safeParse(configToValidate);

    if (result.success) {
      return { valid: true };
    } else {
      return { 
        valid: false, 
        errors: result.error.format() 
      };
    }
  }

  /**
   * Start watching configuration file for changes
   */
  private startWatching(): void {
    if (this.watcher) return;

    if (existsSync(this.configPath)) {
      this.watcher = watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          // Debounce file changes
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
          }

          this.debounceTimer = setTimeout(async () => {
            logger.info('Configuration file changed, reloading...');
            try {
              await this.reload();
            } catch (error) {
              logger.error('Failed to reload configuration:', error);
            }
          }, 500);
        }
      });

      logger.debug('Started watching configuration file');
    }
  }

  /**
   * Stop watching configuration file
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
      logger.debug('Stopped watching configuration file');
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  /**
   * Merge configuration with environment variables
   * Environment variables take precedence
   */
  private mergeWithEnvironment(config: any): any {
    const merged = { ...config };

    // Common environment variable mappings
    const envMappings: Record<string, string[]> = {
      'NODE_ENV': ['environment'],
      'PORT': ['server.port'],
      'HOST': ['server.host'],
      'LOG_LEVEL': ['logging.level'],
      'DATABASE_URL': ['database.url'],
      'REDIS_URL': ['redis.url'],
      'SESSION_SECRET': ['session.secret'],
      'CORS_ORIGIN': ['cors.origin']
    };

    // Apply environment variable overrides
    for (const [envKey, configPath] of Object.entries(envMappings)) {
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        this.setNestedValue(merged, configPath, this.parseEnvValue(envValue));
      }
    }

    // Also check for prefixed environment variables (e.g., APP_CONFIG_)
    const prefix = process.env.CONFIG_PREFIX || 'APP_CONFIG_';
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key
          .substring(prefix.length)
          .toLowerCase()
          .replace(/_/g, '.');
        this.setNestedValue(merged, configKey.split('.'), this.parseEnvValue(value!));
      }
    }

    return merged;
  }

  /**
   * Parse environment variable value
   */
  private parseEnvValue(value: string): any {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Check for boolean
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      
      // Check for number
      const num = Number(value);
      if (!isNaN(num)) return num;
      
      // Return as string
      return value;
    }
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: any, path: string[], value: any): void {
    const lastKey = path.pop()!;
    let target = obj;

    for (const key of path) {
      if (!(key in target) || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }

    target[lastKey] = value;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  /**
   * Detect and emit change events
   */
  private detectAndEmitChanges(oldConfig: any, newConfig: any, prefix: string = ''): void {
    const allKeys = new Set([...Object.keys(oldConfig || {}), ...Object.keys(newConfig || {})]);

    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const oldValue = oldConfig?.[key];
      const newValue = newConfig?.[key];

      if (isObject(oldValue) && isObject(newValue)) {
        this.detectAndEmitChanges(oldValue, newValue, fullKey);
      } else if (oldValue !== newValue) {
        this.emit('configChanged', {
          key: fullKey,
          oldValue,
          newValue,
          timestamp: new Date()
        } as ConfigChangeEvent);
      }
    }
  }
}

/**
 * Helper function to check if value is an object
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Create a singleton config manager instance
 */
let defaultManager: ConfigManager | null = null;

export function getConfigManager(options?: ConfigManagerOptions): ConfigManager {
  if (!defaultManager) {
    defaultManager = new ConfigManager(options);
  }
  return defaultManager;
}

/**
 * Common configuration schemas
 */
export const CommonSchemas = {
  // Server configuration schema
  serverConfig: z.object({
    port: z.number().min(1).max(65535),
    host: z.string().default('0.0.0.0'),
    https: z.boolean().optional(),
    cors: z.object({
      enabled: z.boolean().default(true),
      origin: z.union([z.string(), z.array(z.string())]).optional()
    }).optional()
  }),

  // Logging configuration schema
  loggingConfig: z.object({
    level: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
    file: z.boolean().default(true),
    console: z.boolean().default(true),
    maxSize: z.string().default('20m'),
    maxFiles: z.string().default('14d')
  }),

  // Database configuration schema
  databaseConfig: z.object({
    type: z.enum(['postgres', 'mysql', 'sqlite', 'mongodb']).optional(),
    url: z.string().optional(),
    host: z.string().optional(),
    port: z.number().optional(),
    database: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    ssl: z.boolean().optional()
  }),

  // Redis configuration schema
  redisConfig: z.object({
    url: z.string().optional(),
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(0)
  }),

  // Session configuration schema
  sessionConfig: z.object({
    secret: z.string(),
    resave: z.boolean().default(false),
    saveUninitialized: z.boolean().default(false),
    cookie: z.object({
      secure: z.boolean().default(false),
      httpOnly: z.boolean().default(true),
      maxAge: z.number().default(86400000), // 24 hours
      sameSite: z.enum(['lax', 'strict', 'none']).optional()
    }).optional(),
    store: z.enum(['memory', 'redis', 'file']).default('memory')
  })
};

