/**
 * Configuration Manager
 * Centralized configuration management with validation, schema support, and environment handling
 */

import fs from 'fs';
import path from 'path';
import { z, ZodSchema } from 'zod';
import { createLogger } from '../core/index.js';
import dotenv from 'dotenv';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('ConfigManager');
  }
  return logger;
}

export interface ConfigOptions {
  configPath?: string;
  envPath?: string;
  schema?: ZodSchema;
  defaults?: Record<string, any>;
  required?: string[];
  watchForChanges?: boolean;
  mergeEnv?: boolean;
}

export class ConfigManager<T = any> {
  private config: T;
  private schema?: ZodSchema;
  private configPath?: string;
  private defaults: Record<string, any>;
  private watchers: Map<string, (value: any) => void> = new Map();
  private fileWatcher?: fs.FSWatcher;

  constructor(private options: ConfigOptions = {}) {
    this.schema = options.schema;
    this.configPath = options.configPath;
    this.defaults = options.defaults || {};
    this.config = {} as T;
  }

  /**
   * Load configuration from file and environment
   */
  async load(): Promise<T> {
    try {
      // Load environment variables
      if (this.options.envPath) {
        const result = dotenv.config({ path: this.options.envPath });
        if (result.error) {
          ensureLogger().warn(`Failed to load env file: ${result.error.message}`);
        } else {
          ensureLogger().debug(`Loaded environment from ${this.options.envPath}`);
        }
      }

      // Load base configuration
      let baseConfig = { ...this.defaults };

      // Load from JSON file if specified
      if (this.configPath) {
        const loadedConfig = await this.loadJsonConfig(this.configPath);
        baseConfig = this.deepMerge(baseConfig, loadedConfig);
      }

      // Merge environment variables if requested
      if (this.options.mergeEnv) {
        baseConfig = this.mergeEnvironmentVariables(baseConfig);
      }

      // Validate against schema if provided
      if (this.schema) {
        const result = this.schema.safeParse(baseConfig);
        if (!result.success) {
          const errors = result.error.format();
          ensureLogger().error('Configuration validation failed:', errors);
          throw new Error(`Invalid configuration: ${JSON.stringify(errors)}`);
        }
        this.config = result.data as T;
      } else {
        this.config = baseConfig as T;
      }

      // Check required fields
      if (this.options.required) {
        this.checkRequiredFields(this.config, this.options.required);
      }

      // Setup file watching if requested
      if (this.options.watchForChanges && this.configPath) {
        this.setupFileWatcher();
      }

      ensureLogger().debug('Configuration loaded successfully');
      return this.config;
    } catch (error: any) {
      ensureLogger().error('Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Load JSON configuration file
   */
  private async loadJsonConfig(filePath: string): Promise<any> {
    try {
      const resolvedPath = path.resolve(filePath);
      
      if (!fs.existsSync(resolvedPath)) {
        ensureLogger().warn(`Config file not found: ${resolvedPath}, using defaults`);
        return { ...this.defaults };
      }

      const content = await fs.promises.readFile(resolvedPath, 'utf-8');
      const config = JSON.parse(content);
      
      // Merge with defaults
      return this.deepMerge(this.defaults, config);
    } catch (error: any) {
      ensureLogger().error(`Failed to load config file ${filePath}:`, error);
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Merge environment variables into configuration
   */
  private mergeEnvironmentVariables(config: any): any {
    const result = { ...config };

    // Map common environment variables to config paths
    const envMappings: Record<string, string[]> = {
      'PORT': ['port', 'server.port', 'web.port'],
      'HOST': ['host', 'server.host', 'web.host'],
      'NODE_ENV': ['environment', 'env'],
      'LOG_LEVEL': ['logging.level', 'logLevel'],
      'DATABASE_URL': ['database.url', 'db.connectionString'],
      'REDIS_URL': ['redis.url', 'cache.url'],
      'SESSION_SECRET': ['session.secret', 'web.sessionSecret'],
      'API_KEY': ['api.key', 'apiKey'],
      'JWT_SECRET': ['jwt.secret', 'auth.jwtSecret']
    };

    // Apply environment variable mappings
    for (const [envVar, paths] of Object.entries(envMappings)) {
      const value = process.env[envVar];
      if (value !== undefined && value !== '') {
        // Convert to appropriate type for known numeric fields
        const numericPaths = ['port', 'server.port', 'web.port'];
        for (const path of paths) {
          let convertedValue: any = value;
          // Check if this path should be numeric
          if (numericPaths.some(np => path.includes(np))) {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              convertedValue = numValue;
            }
          }
          this.setNestedValue(result, path, convertedValue);
        }
      }
    }

    // Also check for prefixed environment variables (e.g., APP_CONFIG_*)
    const prefix = process.env.CONFIG_PREFIX || 'APP_CONFIG_';
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configPath = key
          .substring(prefix.length)
          .toLowerCase()
          .replace(/_/g, '.');
        this.setNestedValue(result, configPath, value);
      }
    }

    return result;
  }

  /**
   * Check that required fields are present
   */
  private checkRequiredFields(config: any, required: string[]): void {
    const missing: string[] = [];

    for (const field of required) {
      const value = this.getNestedValue(config, field);
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Setup file watcher for configuration changes
   */
  private setupFileWatcher(): void {
    if (!this.configPath) return;

    try {
      this.fileWatcher = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          ensureLogger().info('Configuration file changed, reloading...');
          try {
            await this.load();
            this.notifyWatchers();
          } catch (error: any) {
            ensureLogger().error('Failed to reload configuration:', error);
          }
        }
      });
    } catch (error: any) {
      ensureLogger().warn('Failed to setup config file watcher:', error.message);
    }
  }

  /**
   * Get configuration value
   */
  get<K extends keyof T>(key: K): T[K];
  get(path: string): any;
  get(keyOrPath: any): any {
    if (typeof keyOrPath === 'string' && keyOrPath.includes('.')) {
      return this.getNestedValue(this.config, keyOrPath);
    }
    return this.config[keyOrPath as keyof T];
  }

  /**
   * Set configuration value
   */
  set<K extends keyof T>(key: K, value: T[K]): void;
  set(path: string, value: any): void;
  set(keyOrPath: any, value: any): void {
    if (typeof keyOrPath === 'string' && keyOrPath.includes('.')) {
      this.setNestedValue(this.config as any, keyOrPath, value);
    } else {
      (this.config as any)[keyOrPath] = value;
    }
    this.notifyWatchers();
  }

  /**
   * Get all configuration
   */
  getAll(): T {
    return { ...this.config };
  }

  /**
   * Merge configuration
   */
  merge(partial: Partial<T>): void {
    this.config = this.deepMerge(this.config, partial) as T;
    
    // Revalidate if schema exists
    if (this.schema) {
      const result = this.schema.safeParse(this.config);
      if (!result.success) {
        throw new Error(`Invalid configuration after merge: ${result.error.message}`);
      }
    }
    
    this.notifyWatchers();
  }

  /**
   * Save configuration to file
   */
  async save(filePath?: string): Promise<void> {
    const targetPath = filePath || this.configPath;
    if (!targetPath) {
      throw new Error('No file path specified for saving configuration');
    }

    try {
      const content = JSON.stringify(this.config, null, 2);
      await fs.promises.writeFile(targetPath, content, 'utf-8');
      ensureLogger().info(`Configuration saved to ${targetPath}`);
    } catch (error: any) {
      ensureLogger().error(`Failed to save configuration:`, error);
      throw error;
    }
  }

  /**
   * Watch for configuration changes
   */
  watch(path: string, callback: (value: any) => void): () => void {
    const id = `${path}-${Date.now()}`;
    this.watchers.set(id, () => {
      const value = this.get(path);
      callback(value);
    });

    // Return unsubscribe function
    return () => {
      this.watchers.delete(id);
    };
  }

  /**
   * Validate configuration against schema
   */
  validate(): boolean {
    if (!this.schema) {
      return true;
    }

    const result = this.schema.safeParse(this.config);
    if (!result.success) {
      ensureLogger().error('Configuration validation failed:', result.error.format());
      return false;
    }

    return true;
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.config = { ...this.defaults } as T;
    this.notifyWatchers();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }
    this.watchers.clear();
  }

  // Utility methods

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  private notifyWatchers(): void {
    for (const callback of this.watchers.values()) {
      callback(this.config);
    }
  }
}

/**
 * Create a typed configuration manager
 */
export function createConfigManager<T>(options: ConfigOptions & { schema: ZodSchema<T> }): ConfigManager<T> {
  return new ConfigManager<T>(options);
}

/**
 * Common configuration schemas
 */
export const ConfigSchemas = {
  // Server configuration
  server: z.object({
    port: z.number().min(1).max(65535).default(3000),
    host: z.string().default('localhost'),
    https: z.object({
      enabled: z.boolean().default(false),
      cert: z.string().optional(),
      key: z.string().optional()
    }).optional()
  }),

  // Database configuration
  database: z.object({
    url: z.string(),
    pool: z.object({
      min: z.number().default(2),
      max: z.number().default(10)
    }).optional()
  }),

  // Logging configuration
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'text']).default('text'),
    file: z.string().optional()
  }),

  // Session configuration
  session: z.object({
    secret: z.string().min(32),
    maxAge: z.number().default(3600000),
    secure: z.boolean().default(false)
  }),

  // API configuration
  api: z.object({
    baseUrl: z.string().url().optional(),
    timeout: z.number().default(30000),
    retries: z.number().default(3)
  })
};

export default ConfigManager;
