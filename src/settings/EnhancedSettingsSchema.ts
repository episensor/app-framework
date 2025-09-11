/**
 * Enhanced Settings Schema
 * Comprehensive settings system based on working VPP Manager implementation
 */

export interface SettingDefinition {
  key: string;
  label: string;
  description?: string;
  help?: string; // Detailed help text for tooltips
  type: 'string' | 'number' | 'boolean' | 'select' | 'password' | 'network-interface';
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
      if (typeof value !== 'string') return 'Must be a string';
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) return 'Must be a valid number';
      if (setting.min !== undefined && value < setting.min) return `Must be at least ${setting.min}`;
      if (setting.max !== undefined && value > setting.max) return `Must be at most ${setting.max}`;
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return 'Must be true or false';
      break;
    case 'select':
      if (setting.options && !setting.options.some(opt => opt.value === value)) {
        return 'Must select a valid option';
      }
      break;
  }

  // Custom validation
  if (setting.validation) {
    const result = setting.validation(value);
    if (result !== true) {
      return typeof result === 'string' ? result : 'Invalid value';
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
