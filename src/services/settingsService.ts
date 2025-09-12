/**
 * Settings Service
 * Manages application settings with persistence, validation, and real-time updates
 */

import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { ZodSchema } from "zod";
import { createLogger } from "../core/index.js";

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger("SettingsService");
  }
  return logger;
}

export interface SettingsCategory {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  schema?: ZodSchema;
  fields: SettingsField[];
  order?: number;
}

export interface SettingsField {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "boolean"
    | "select"
    | "multiselect"
    | "json"
    | "password"
    | "email"
    | "url"
    | "color"
    | "date"
    | "time"
    | "datetime";
  description?: string;
  placeholder?: string;
  defaultValue?: any;
  required?: boolean;
  validation?: ZodSchema;
  options?: Array<{ value: any; label: string; description?: string }>;
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
  readonly?: boolean;
  hidden?: boolean;
  dependsOn?: {
    field: string;
    value: any;
  };
  transform?: (value: any) => any;
  format?: (value: any) => string;
}

export interface SettingsOptions {
  storagePath?: string;
  autoSave?: boolean;
  saveDebounce?: number;
  encryptSensitive?: boolean;
  sensitiveFields?: string[];
}

export class SettingsService extends EventEmitter {
  private categories: Map<string, SettingsCategory> = new Map();
  private settings: Record<string, any> = {};
  private storagePath?: string;
  private autoSave: boolean;
  private saveDebounce: number;
  private saveTimeout?: NodeJS.Timeout;
  private sensitiveFields: Set<string>;

  constructor(private options: SettingsOptions = {}) {
    super();
    this.storagePath = options.storagePath;
    this.autoSave = options.autoSave ?? true;
    this.saveDebounce = options.saveDebounce ?? 1000;
    this.sensitiveFields = new Set(options.sensitiveFields || []);
  }

  /**
   * Register a settings category
   */
  registerCategory(category: SettingsCategory): void {
    this.categories.set(category.id, category);

    // Initialize default values
    for (const field of category.fields) {
      if (field.defaultValue !== undefined && !(field.key in this.settings)) {
        this.settings[field.key] = field.defaultValue;
      }
    }

    ensureLogger().info(`Registered settings category: ${category.id}`);
  }

  /**
   * Load settings from storage
   */
  async load(): Promise<void> {
    if (!this.storagePath) {
      ensureLogger().info("No storage path configured, using defaults");
      return;
    }

    try {
      const fullPath = path.resolve(this.storagePath);

      if (!fs.existsSync(fullPath)) {
        ensureLogger().info("Settings file not found, using defaults");
        return;
      }

      const content = await fs.promises.readFile(fullPath, "utf-8");
      const loaded = JSON.parse(content);

      // Merge with defaults
      this.settings = { ...this.settings, ...loaded };

      // Decrypt sensitive fields if needed
      if (this.options.encryptSensitive) {
        this.decryptSensitiveFields();
      }

      ensureLogger().info("Settings loaded successfully");
      this.emit("loaded", this.settings);
    } catch (_error: any) {
      ensureLogger().error("Failed to load settings:", _error);
      throw new Error(`Failed to load settings: ${_error.message}`);
    }
  }

  /**
   * Save settings to storage
   */
  async save(): Promise<void> {
    if (!this.storagePath) {
      ensureLogger().info("No storage path configured, skipping save");
      return;
    }

    try {
      const fullPath = path.resolve(this.storagePath);
      const dir = path.dirname(fullPath);

      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      // Prepare settings for saving
      let toSave = { ...this.settings };

      // Encrypt sensitive fields if needed
      if (this.options.encryptSensitive) {
        toSave = this.encryptSensitiveFields(toSave);
      }

      // Save to file
      const content = JSON.stringify(toSave, null, 2);
      await fs.promises.writeFile(fullPath, content, "utf-8");

      ensureLogger().info("Settings saved successfully");
      this.emit("saved", this.settings);
    } catch (_error: any) {
      ensureLogger().error("Failed to save settings:", _error);
      throw new Error(`Failed to save settings: ${_error.message}`);
    }
  }

  /**
   * Get a setting value
   */
  get<T = any>(key: string, defaultValue?: T): T {
    const value = this.getNestedValue(this.settings, key);
    return value !== undefined ? value : (defaultValue as T);
  }

  /**
   * Set a setting value
   */
  async set(key: string, value: any): Promise<void> {
    // Find field definition
    const field = this.findField(key);

    // Validate if field has validation
    if (field?.validation) {
      const result = field.validation.safeParse(value);
      if (!result.success) {
        throw new Error(
          `Validation failed for ${key}: ${result.error.message}`,
        );
      }
      value = result.data;
    }

    // Apply transform if defined
    if (field?.transform) {
      value = field.transform(value);
    }

    // Set the value
    this.setNestedValue(this.settings, key, value);

    // Emit change event
    this.emit("change", { key, value, previous: this.get(key) });

    // Auto-save if enabled
    if (this.autoSave) {
      this.scheduleSave();
    }
  }

  /**
   * Update multiple settings
   */
  async update(updates: Record<string, any>): Promise<void> {
    const changes: Array<{ key: string; value: any; previous: any }> = [];

    for (const [key, value] of Object.entries(updates)) {
      const previous = this.get(key);
      await this.set(key, value);
      changes.push({ key, value, previous });
    }

    this.emit("bulk-change", changes);
  }

  /**
   * Get all settings
   */
  getAll(): Record<string, any> {
    return { ...this.settings };
  }

  /**
   * Get settings by category
   */
  getByCategory(categoryId: string): Record<string, any> {
    const category = this.categories.get(categoryId);
    if (!category) {
      return {};
    }

    const result: Record<string, any> = {};
    for (const field of category.fields) {
      result[field.key] = this.get(field.key, field.defaultValue);
    }
    return result;
  }

  /**
   * Get all categories
   */
  getCategories(): SettingsCategory[] {
    return Array.from(this.categories.values()).sort(
      (a, b) => (a.order || 0) - (b.order || 0),
    );
  }

  /**
   * Get category by ID
   */
  getCategory(id: string): SettingsCategory | undefined {
    return this.categories.get(id);
  }

  /**
   * Validate all settings
   */
  validate(): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const category of this.categories.values()) {
      for (const field of category.fields) {
        const value = this.get(field.key);

        // Check required fields
        if (
          field.required &&
          (value === undefined || value === null || value === "")
        ) {
          errors[field.key] = `${field.label} is required`;
          continue;
        }

        // Validate with schema
        if (field.validation && value !== undefined) {
          const result = field.validation.safeParse(value);
          if (!result.success) {
            errors[field.key] =
              result.error.issues[0]?.message || "Validation failed";
          }
        }
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Reset settings to defaults
   */
  reset(categoryId?: string): void {
    if (categoryId) {
      const category = this.categories.get(categoryId);
      if (category) {
        for (const field of category.fields) {
          if (field.defaultValue !== undefined) {
            this.settings[field.key] = field.defaultValue;
          } else {
            delete this.settings[field.key];
          }
        }
      }
    } else {
      // Reset all settings
      this.settings = {};
      for (const category of this.categories.values()) {
        for (const field of category.fields) {
          if (field.defaultValue !== undefined) {
            this.settings[field.key] = field.defaultValue;
          }
        }
      }
    }

    this.emit("reset", categoryId);

    if (this.autoSave) {
      this.scheduleSave();
    }
  }

  /**
   * Export settings
   */
  export(categoryId?: string): string {
    const data = categoryId ? this.getByCategory(categoryId) : this.settings;
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import settings
   */
  async import(data: string): Promise<void> {
    try {
      const imported = JSON.parse(data);
      await this.update(imported);
      ensureLogger().info("Settings imported successfully");
    } catch (_error: any) {
      ensureLogger().error("Failed to import settings:", _error);
      throw new Error(`Failed to import settings: ${_error.message}`);
    }
  }

  // Private methods

  private findField(key: string): SettingsField | undefined {
    for (const category of this.categories.values()) {
      const field = category.fields.find((f) => f.key === key);
      if (field) return field;
    }
    return undefined;
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(async () => {
      try {
        await this.save();
      } catch (_error: any) {
        ensureLogger().error("Auto-save failed:", _error);
        this.emit("save-error", _error);
      }
    }, this.saveDebounce);
  }

  private encryptSensitiveFields(
    settings: Record<string, any>,
  ): Record<string, any> {
    const result = { ...settings };

    for (const field of this.sensitiveFields) {
      const value = this.getNestedValue(result, field);
      if (value !== undefined && typeof value === "string") {
        // Simple base64 encoding for demonstration
        // In production, use proper encryption
        this.setNestedValue(
          result,
          field,
          Buffer.from(value).toString("base64"),
        );
      }
    }

    return result;
  }

  private decryptSensitiveFields(): void {
    for (const field of this.sensitiveFields) {
      const value = this.getNestedValue(this.settings, field);
      if (value !== undefined && typeof value === "string") {
        try {
          // Simple base64 decoding for demonstration
          // In production, use proper decryption
          this.setNestedValue(
            this.settings,
            field,
            Buffer.from(value, "base64").toString(),
          );
        } catch {
          // Value might not be encrypted, leave as is
        }
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }
}

/**
 * Create common settings categories
 */
export const CommonSettingsCategories = {
  general: (): SettingsCategory => ({
    id: "general",
    label: "General",
    description: "General application settings",
    icon: "Settings",
    order: 1,
    fields: [
      {
        key: "app.name",
        label: "Application Name",
        type: "text",
        defaultValue: "My Application",
        required: true,
      },
      {
        key: "app.description",
        label: "Description",
        type: "text",
        placeholder: "Enter application description",
      },
    ],
  }),

  server: (): SettingsCategory => ({
    id: "server",
    label: "Server",
    description: "Server configuration",
    icon: "Server",
    order: 2,
    fields: [
      {
        key: "server.port",
        label: "Port",
        type: "number",
        defaultValue: 3000,
        min: 1,
        max: 65535,
        required: true,
      },
      {
        key: "server.host",
        label: "Host",
        type: "text",
        defaultValue: "localhost",
      },
      {
        key: "server.https.enabled",
        label: "Enable HTTPS",
        type: "boolean",
        defaultValue: false,
      },
    ],
  }),

  logging: (): SettingsCategory => ({
    id: "logging",
    label: "Logging",
    description: "Logging configuration",
    icon: "FileText",
    order: 3,
    fields: [
      {
        key: "logging.level",
        label: "Log Level",
        type: "select",
        defaultValue: "info",
        options: [
          { value: "debug", label: "Debug" },
          { value: "info", label: "Info" },
          { value: "warn", label: "Warning" },
          { value: "error", label: "Error" },
        ],
      },
      {
        key: "logging.file",
        label: "Log File Path",
        type: "text",
        placeholder: "./logs/app.log",
      },
    ],
  }),
};

export default SettingsService;
