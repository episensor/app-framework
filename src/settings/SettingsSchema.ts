/**
 * Settings Schema System
 * Consolidated settings system with all features from both implementations
 */

export interface SettingOption {
  value: any; // Changed from string to any to support more types
  label: string;
  description?: string;
}

export interface SettingDefinition {
  // Core fields
  key: string;
  label: string;
  description?: string;
  defaultValue?: any;

  // Type system - comprehensive list
  type:
    | "string"
    | "number"
    | "boolean"
    | "select"
    | "multiselect"
    | "password"
    | "textarea"
    | "email"
    | "url"
    | "color"
    | "date"
    | "time"
    | "datetime"
    | "json"
    | "ipaddress"
    | "network-interface";

  // Options for select/multiselect
  options?: SettingOption[];

  // Validation
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    custom?: (value: any) => string | null;
  };
  validationMessage?: string; // Custom validation message

  // Transforms
  transform?: {
    fromStorage?: (value: any) => any;
    toStorage?: (value: any) => any;
  };

  // UI hints
  help?: string; // Detailed help text for tooltips
  hint?: string; // Hint text below input
  placeholder?: string;
  prefix?: string; // Text before input
  suffix?: string; // Text after input
  inputWidth?: "small" | "medium" | "large" | "full";
  rows?: number; // For textarea

  // Behavior
  readOnly?: boolean;
  hidden?: boolean; // For config-only settings
  sensitive?: boolean; // For passwords, API keys, etc.
  requiresRestart?: boolean;

  // Organization
  category: string;
  subcategory?: string;
  group?: string; // Group related fields together
  order?: number; // Display order within category
  icon?: string; // Icon to display with field

  // Conditional logic
  showIf?: (settings: Record<string, any>) => boolean;
  confirmMessage?: string; // Confirmation before applying

  // Number-specific
  min?: number;
  max?: number;
  step?: number;
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

export interface SettingsFormState {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
}

export interface SettingsValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
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
      if (value) {
        const parts = value.split(".");
        if (parts.length !== 4) return message;
        for (const part of parts) {
          const num = parseInt(part, 10);
          if (isNaN(num) || num < 0 || num > 255) return message;
        }
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

  minLength: (min: number, message?: string) => (value: string) => {
    if (value && value.length < min) {
      return message || `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max: number, message?: string) => (value: string) => {
    if (value && value.length > max) {
      return message || `Must be at most ${max} characters`;
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
 * Get setting by key from categories
 */
export function getSettingByKey(
  categories: SettingsCategory[],
  key: string,
): SettingDefinition | undefined {
  for (const category of categories) {
    const setting = category.settings.find((s) => s.key === key);
    if (setting) return setting;
  }
  return undefined;
}

/**
 * Validate a single setting
 */
export function validateSetting(
  setting: SettingDefinition,
  value: any,
): string | null {
  // Check required
  if (
    setting.required &&
    (!value || (typeof value === "string" && !value.trim()))
  ) {
    return setting.validationMessage || "This field is required";
  }

  // Type-specific validation
  switch (setting.type) {
    case "string":
    case "password":
    case "textarea":
      if (value && typeof value !== "string") {
        return setting.validationMessage || "Must be a string";
      }
      if (setting.validation) {
        if (
          setting.validation.minLength !== undefined &&
          value.length < setting.validation.minLength
        ) {
          return (
            setting.validationMessage ||
            `Must be at least ${setting.validation.minLength} characters`
          );
        }
        if (
          setting.validation.maxLength !== undefined &&
          value.length > setting.validation.maxLength
        ) {
          return (
            setting.validationMessage ||
            `Must be at most ${setting.validation.maxLength} characters`
          );
        }
        if (
          setting.validation.pattern &&
          !new RegExp(setting.validation.pattern).test(value)
        ) {
          return setting.validationMessage || "Invalid format";
        }
      }
      break;

    case "email":
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return setting.validationMessage || "Invalid email address";
      }
      break;

    case "url":
      try {
        if (value) new URL(value);
      } catch {
        return setting.validationMessage || "Invalid URL";
      }
      break;

    case "ipaddress":
      if (value) {
        const parts = value.split(".");
        if (parts.length !== 4) {
          return setting.validationMessage || "Invalid IP address";
        }
        for (const part of parts) {
          const num = parseInt(part, 10);
          if (isNaN(num) || num < 0 || num > 255) {
            return setting.validationMessage || "Invalid IP address";
          }
        }
      }
      break;

    case "number":
      if (typeof value !== "number" || isNaN(value)) {
        return setting.validationMessage || "Must be a valid number";
      }
      if (setting.validation) {
        if (
          setting.validation.min !== undefined &&
          value < setting.validation.min
        ) {
          return (
            setting.validationMessage ||
            `Must be at least ${setting.validation.min}`
          );
        }
        if (
          setting.validation.max !== undefined &&
          value > setting.validation.max
        ) {
          return (
            setting.validationMessage ||
            `Must be at most ${setting.validation.max}`
          );
        }
      }
      // Also check min/max at root level for backward compatibility
      if (setting.min !== undefined && value < setting.min) {
        return setting.validationMessage || `Must be at least ${setting.min}`;
      }
      if (setting.max !== undefined && value > setting.max) {
        return setting.validationMessage || `Must be at most ${setting.max}`;
      }
      break;

    case "boolean":
      if (typeof value !== "boolean") {
        return setting.validationMessage || "Must be true or false";
      }
      break;

    case "select":
    case "multiselect":
      if (setting.options) {
        if (
          setting.type === "select" &&
          !setting.options.some((opt) => opt.value === value)
        ) {
          return setting.validationMessage || "Must select a valid option";
        }
        if (setting.type === "multiselect" && Array.isArray(value)) {
          const validValues = setting.options.map((opt) => opt.value);
          if (!value.every((v) => validValues.includes(v))) {
            return setting.validationMessage || "Invalid selection";
          }
        }
      }
      break;

    case "date":
    case "time":
    case "datetime":
      if (value && !Date.parse(value)) {
        return setting.validationMessage || "Invalid date/time";
      }
      break;

    case "color":
      if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) {
        return (
          setting.validationMessage || "Invalid color (must be hex format)"
        );
      }
      break;
  }

  // Custom validation
  if (setting.validation?.custom) {
    const error = setting.validation.custom(value);
    if (error) return error;
  }

  return null;
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
      if (setting.hidden) continue;

      const value = settings[setting.key];
      const error = validateSetting(setting, value);
      if (error) {
        errors[setting.key] = error;
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

/**
 * Validate all settings (returns result object)
 */
export function validateAllSettings(
  categories: SettingsCategory[],
  values: Record<string, any>,
): SettingsValidationResult {
  const errors: Record<string, string> = {};

  for (const category of categories) {
    for (const setting of category.settings) {
      if (setting.hidden) continue;

      const value = values[setting.key];
      const error = validateSetting(setting, value);
      if (error) {
        errors[setting.key] = error;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
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

// Alias for consistency
export const flattenSettingsValues = flattenSettings;

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

// Alias for consistency
export const unflattenSettingsValues = unflattenSettings;

/**
 * Get all settings that require restart
 */
export function getRestartRequiredSettings(
  schema: SettingsSchema | SettingsCategory[],
  changedSettings: Record<string, any> | string[],
): string[] {
  const restartRequired: string[] = [];

  // Handle both schema and categories array
  const categories = Array.isArray(schema) ? schema : schema.categories;

  // Handle both changed settings object and array of keys
  const changedKeys = Array.isArray(changedSettings)
    ? changedSettings
    : Object.keys(changedSettings);

  for (const category of categories) {
    for (const setting of category.settings) {
      if (setting.requiresRestart && changedKeys.includes(setting.key)) {
        restartRequired.push(setting.key);
      }
    }
  }

  return restartRequired;
}

/**
 * Get default values from settings
 */
export function getDefaultSettingsValues(
  categories: SettingsCategory[],
): Record<string, any> {
  const defaults: Record<string, any> = {};

  for (const category of categories) {
    for (const setting of category.settings) {
      if (!setting.hidden && setting.defaultValue !== undefined) {
        defaults[setting.key] = setting.defaultValue;
      }
    }
  }

  return defaults;
}

/**
 * Evaluate conditional visibility for a field
 */
export function evaluateFieldVisibility(
  field: SettingDefinition,
  currentValues: Record<string, any>,
): boolean {
  if (!field.showIf) {
    return true;
  }

  try {
    return field.showIf(currentValues);
  } catch (_error) {
    console.error(`Error evaluating showIf for field ${field.key}:`, _error);
    return true; // Show field if evaluation fails
  }
}

/**
 * Group fields by their group property
 */
export function groupFields(
  fields: SettingDefinition[],
): Map<string, SettingDefinition[]> {
  const groups = new Map<string, SettingDefinition[]>();

  // First, add ungrouped fields
  const ungrouped = fields.filter((f) => !f.group);
  if (ungrouped.length > 0) {
    groups.set("_default", ungrouped);
  }

  // Then, group the rest
  fields
    .filter((f) => f.group)
    .forEach((field) => {
      const group = field.group!;
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(field);
    });

  // Sort fields within each group by order
  groups.forEach((groupFields) => {
    groupFields.sort((a, b) => (a.order || 999) - (b.order || 999));
  });

  return groups;
}

/**
 * Apply toStorage transform
 */
export function applyToStorageTransform(
  field: SettingDefinition,
  value: any,
): any {
  if (field.transform?.toStorage) {
    return field.transform.toStorage(value);
  }
  return value;
}

/**
 * Apply fromStorage transform
 */
export function applyFromStorageTransform(
  field: SettingDefinition,
  value: any,
): any {
  if (field.transform?.fromStorage) {
    return field.transform.fromStorage(value);
  }
  return value;
}

/**
 * Create settings form state
 */
export function createSettingsFormState(
  categories: SettingsCategory[],
  initialValues?: Record<string, any>,
): SettingsFormState {
  const defaults = getDefaultSettingsValues(categories);
  const values = { ...defaults, ...initialValues };
  const validation = validateAllSettings(categories, values);

  return {
    values,
    errors: validation.errors,
    touched: {},
    dirty: {},
    isValid: validation.isValid,
    isSubmitting: false,
  };
}
