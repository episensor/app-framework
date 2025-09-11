/**
 * Enhanced Settings Schema
 * Comprehensive settings system based on working VPP Manager implementation
 */

export interface SettingDefinition {
  key: string;
  label: string;
  description?: string;
  help?: string; // Detailed help text for tooltips
  type: 'string' | 'number' | 'boolean' | 'select' | 'password' | 'network-interface' | 'textarea' | 'email' | 'url' | 'color' | 'date' | 'time' | 'datetime';
  defaultValue: any;
  options?: { value: any; label: string; description?: string }[];
  validation?: (value: any) => boolean | string;
  requiresRestart?: boolean;
  sensitive?: boolean; // For API keys, passwords, etc.
  category: string;
  subcategory?: string;
  hidden?: boolean; // For config-only settings
  inputWidth?: 'small' | 'medium' | 'large' | 'full';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  
  // Additional fields from VPP Manager
  showIf?: (settings: Record<string, any>) => boolean; // Conditional visibility
  confirmMessage?: string; // Confirmation message before applying
  hint?: string; // Hint text below input
  suffix?: string; // Text after input
  prefix?: string; // Text before input
  readOnly?: boolean; // Read-only field
  toStorage?: (value: any) => any; // Transform before saving
  fromStorage?: (value: any) => any; // Transform after loading
  validationMessage?: string; // Custom validation message
  pattern?: string; // Regex pattern for validation
  maxLength?: number; // Max length for text
  minLength?: number; // Min length for text
  rows?: number; // Rows for textarea
  icon?: string; // Icon to display
  group?: string; // Group related fields
  order?: number; // Display order
}

export interface SettingsCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
  settings: SettingDefinition[];
}

export interface EnhancedSettingsSchema {
  version: string;
  categories: SettingsCategory[];
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
 * Utility Functions for Settings Management
 */

export function getSettingByKey(categories: SettingsCategory[], key: string): SettingDefinition | undefined {
  for (const category of categories) {
    const setting = category.settings.find(s => s.key === key);
    if (setting) return setting;
  }
  return undefined;
}

export function validateSetting(setting: SettingDefinition, value: any): string | null {
  // Type validation
  switch (setting.type) {
    case 'string':
    case 'password':
    case 'textarea':
      if (typeof value !== 'string') return setting.validationMessage || 'Must be a string';
      if (setting.minLength !== undefined && value.length < setting.minLength) {
        return setting.validationMessage || `Must be at least ${setting.minLength} characters`;
      }
      if (setting.maxLength !== undefined && value.length > setting.maxLength) {
        return setting.validationMessage || `Must be at most ${setting.maxLength} characters`;
      }
      if (setting.pattern && !new RegExp(setting.pattern).test(value)) {
        return setting.validationMessage || 'Invalid format';
      }
      break;
      
    case 'email':
      if (typeof value !== 'string') return setting.validationMessage || 'Must be a string';
      if (value && !value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return setting.validationMessage || 'Invalid email address';
      }
      break;
      
    case 'url':
      if (typeof value !== 'string') return setting.validationMessage || 'Must be a string';
      try {
        if (value) new URL(value);
      } catch {
        return setting.validationMessage || 'Invalid URL';
      }
      break;
      
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) return setting.validationMessage || 'Must be a valid number';
      if (setting.min !== undefined && value < setting.min) {
        return setting.validationMessage || `Must be at least ${setting.min}`;
      }
      if (setting.max !== undefined && value > setting.max) {
        return setting.validationMessage || `Must be at most ${setting.max}`;
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') return setting.validationMessage || 'Must be true or false';
      break;
      
    case 'select':
      if (setting.options && !setting.options.some(opt => opt.value === value)) {
        return setting.validationMessage || 'Must select a valid option';
      }
      break;
      
    case 'date':
    case 'time':
    case 'datetime':
      if (value && !Date.parse(value)) {
        return setting.validationMessage || 'Invalid date/time';
      }
      break;
      
    case 'color':
      if (value && !value.match(/^#[0-9A-Fa-f]{6}$/)) {
        return setting.validationMessage || 'Invalid color (must be hex format)';
      }
      break;
  }

  // Custom validation
  if (setting.validation) {
    const result = setting.validation(value);
    if (result !== true) {
      return typeof result === 'string' ? result : setting.validationMessage || 'Invalid value';
    }
  }

  return null;
}

export function validateAllSettings(categories: SettingsCategory[], values: Record<string, any>): SettingsValidationResult {
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
    errors
  };
}

export function getRestartRequiredSettings(categories: SettingsCategory[], changedKeys: string[]): string[] {
  const restartRequired: string[] = [];
  
  for (const key of changedKeys) {
    const setting = getSettingByKey(categories, key);
    if (setting?.requiresRestart) {
      restartRequired.push(key);
    }
  }
  
  return restartRequired;
}

export function flattenSettingsValues(values: Record<string, any>): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  function flatten(obj: any, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value, fullKey);
      } else {
        flattened[fullKey] = value;
      }
    }
  }
  
  flatten(values);
  return flattened;
}

export function unflattenSettingsValues(flattened: Record<string, any>): Record<string, any> {
  const result: any = {};
  
  for (const [key, value] of Object.entries(flattened)) {
    const parts = key.split('.');
    let current = result;
    
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
  
  return result;
}

export function getDefaultSettingsValues(categories: SettingsCategory[]): Record<string, any> {
  const defaults: Record<string, any> = {};
  
  for (const category of categories) {
    for (const setting of category.settings) {
      if (!setting.hidden) {
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
  currentValues: Record<string, any>
): boolean {
  if (!field.showIf) {
    return true;
  }
  
  try {
    return field.showIf(currentValues);
  } catch (error) {
    console.error(`Error evaluating showIf for field ${field.key}:`, error);
    return true; // Show field if evaluation fails
  }
}

/**
 * Group fields by their group property
 */
export function groupFields(fields: SettingDefinition[]): Map<string, SettingDefinition[]> {
  const groups = new Map<string, SettingDefinition[]>();
  
  // First, add ungrouped fields
  const ungrouped = fields.filter(f => !f.group);
  if (ungrouped.length > 0) {
    groups.set('_default', ungrouped);
  }
  
  // Then, group the rest
  fields
    .filter(f => f.group)
    .forEach(field => {
      const group = field.group!;
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(field);
    });
  
  // Sort fields within each group by order
  groups.forEach(groupFields => {
    groupFields.sort((a, b) => (a.order || 999) - (b.order || 999));
  });
  
  return groups;
}

/**
 * Apply toStorage transform
 */
export function applyToStorageTransform(
  field: SettingDefinition,
  value: any
): any {
  if (field.toStorage) {
    return field.toStorage(value);
  }
  return value;
}

/**
 * Apply fromStorage transform
 */
export function applyFromStorageTransform(
  field: SettingDefinition,
  value: any
): any {
  if (field.fromStorage) {
    return field.fromStorage(value);
  }
  return value;
}

export function createSettingsFormState(
  categories: SettingsCategory[], 
  initialValues?: Record<string, any>
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
    isSubmitting: false
  };
}
