/**
 * Settings Schema System
 * Provides a declarative way to define settings with automatic UI generation
 */

export interface SettingOption {
  value: string;
  label: string;
  description?: string;
}

export interface SettingDefinition {
  key: string;
  label: string;
  description?: string;
  help?: string;
  type:
    | "string"
    | "password"
    | "number"
    | "boolean"
    | "select"
    | "multiselect"
    | "json"
    | "color"
    | "email"
    | "url"
    | "ipaddress"
    | "network-interface";
  options?: SettingOption[];
  defaultValue?: any;
  required?: boolean;
  readOnly?: boolean;
  sensitive?: boolean;
  requiresRestart?: boolean;
  category: string;
  subcategory?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    custom?: (value: any) => string | null;
  };
  transform?: {
    fromStorage?: (value: any) => any;
    toStorage?: (value: any) => any;
  };
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  inputWidth?: "small" | "medium" | "large" | "full";
  showIf?: (settings: Record<string, any>) => boolean;
  confirmMessage?: string;
}

export interface SettingsCategory {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  settings: SettingDefinition[];
  order?: number;
}

export interface SettingsSchema {
  categories: SettingsCategory[];
  version: string;
  onSettingChange?: (
    key: string,
    value: any,
    oldValue: any,
  ) => void | Promise<void>;
  onValidate?: (settings: Record<string, any>) => Record<string, string> | null;
}

/**
 * Built-in validation functions
 */
export const Validators = {
  required:
    (message = "This field is required") =>
    (value: any) => {
      if (!value || (typeof value === "string" && !value.trim())) {
        return message;
      }
      return null;
    },

  email:
    (message = "Invalid email address") =>
    (value: string) => {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return message;
      }
      return null;
    },

  url:
    (message = "Invalid URL") =>
    (value: string) => {
      if (value) {
        try {
          new URL(value);
        } catch {
          return message;
        }
      }
      return null;
    },

  ipAddress:
    (message = "Invalid IP address") =>
    (value: string) => {
      if (value && !/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
        return message;
      }
      return null;
    },

  port:
    (message = "Invalid port number") =>
    (value: number) => {
      if (value < 1 || value > 65535) {
        return message;
      }
      return null;
    },

  range: (min: number, max: number, message?: string) => (value: number) => {
    if (value < min || value > max) {
      return message || `Value must be between ${min} and ${max}`;
    }
    return null;
  },

  pattern:
    (pattern: RegExp, message = "Invalid format") =>
    (value: string) => {
      if (value && !pattern.test(value)) {
        return message;
      }
      return null;
    },
};

/**
 * Helper to create a settings schema
 */
export function createSettingsSchema(schema: SettingsSchema): SettingsSchema {
  // Sort categories by order
  schema.categories.sort((a, b) => (a.order || 0) - (b.order || 0));
  return schema;
}

/**
 * Helper to flatten nested settings for storage
 */
export function flattenSettings(
  settings: any,
  prefix = "",
): Record<string, any> {
  const flattened: Record<string, any> = {};

  for (const [key, value] of Object.entries(settings)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      Object.assign(flattened, flattenSettings(value, fullKey));
    } else {
      flattened[fullKey] = value;
    }
  }

  return flattened;
}

/**
 * Helper to unflatten settings from storage
 */
export function unflattenSettings(flattened: Record<string, any>): any {
  const settings: any = {};

  for (const [key, value] of Object.entries(flattened)) {
    const parts = key.split(".");
    let current = settings;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) continue;
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value;
    }
  }

  return settings;
}

/**
 * Get all settings that require restart
 */
export function getRestartRequiredSettings(
  schema: SettingsSchema,
  changedSettings: Record<string, any>,
): string[] {
  const restartRequired: string[] = [];

  for (const category of schema.categories) {
    for (const setting of category.settings) {
      if (
        setting.requiresRestart &&
        Object.prototype.hasOwnProperty.call(changedSettings, setting.key)
      ) {
        restartRequired.push(setting.key);
      }
    }
  }

  return restartRequired;
}

/**
 * Validate all settings against schema
 */
export function validateSettings(
  schema: SettingsSchema,
  settings: Record<string, any>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const category of schema.categories) {
    for (const setting of category.settings) {
      const value = settings[setting.key];

      // Check required
      if (
        setting.required &&
        (!value || (typeof value === "string" && !value.trim()))
      ) {
        errors[setting.key] = "This field is required";
        continue;
      }

      // Check validation
      if (setting.validation) {
        if (setting.validation.custom) {
          const error = setting.validation.custom(value);
          if (error) {
            errors[setting.key] = error;
          }
        }

        if (typeof value === "number") {
          if (
            setting.validation.min !== undefined &&
            value < setting.validation.min
          ) {
            errors[setting.key] =
              `Value must be at least ${setting.validation.min}`;
          }
          if (
            setting.validation.max !== undefined &&
            value > setting.validation.max
          ) {
            errors[setting.key] =
              `Value must be at most ${setting.validation.max}`;
          }
        }

        if (typeof value === "string" && setting.validation.pattern) {
          const pattern = new RegExp(setting.validation.pattern);
          if (!pattern.test(value)) {
            errors[setting.key] = "Invalid format";
          }
        }
      }
    }
  }

  // Run custom validation
  if (schema.onValidate) {
    const customErrors = schema.onValidate(settings);
    if (customErrors) {
      Object.assign(errors, customErrors);
    }
  }

  return errors;
}
