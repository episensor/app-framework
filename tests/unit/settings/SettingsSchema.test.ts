/**
 * Comprehensive Unit Tests for Settings Schema System
 */

import {
  createSettingsSchema,
  validateSettings,
  validateSetting,
  validateAllSettings,
  getSettingByKey,
  getDefaultSettingsValues,
  getRestartRequiredSettings,
  flattenSettings,
  unflattenSettings,
  flattenSettingsValues,
  unflattenSettingsValues,
  evaluateFieldVisibility,
  groupFields,
  applyToStorageTransform,
  applyFromStorageTransform,
  createSettingsFormState,
  Validators,
  type SettingsSchema,
  type SettingsCategory,
  type SettingDefinition
} from '../../../src/settings/SettingsSchema';

describe('Settings Schema System', () => {
  describe('Schema Creation', () => {
    test('creates settings schema with categories', () => {
      const schema: SettingsSchema = {
        version: '1.0.0',
        categories: [
          {
            id: 'general',
            label: 'General',
            description: 'General settings',
            order: 1,
            settings: [
              {
                key: 'appName',
                label: 'Application Name',
                type: 'string',
                defaultValue: 'MyApp',
                category: 'general'
              }
            ]
          }
        ]
      };

      const result = createSettingsSchema(schema);
      
      expect(result).toBeDefined();
      expect(result.categories).toHaveLength(1);
      expect(result.version).toBe('1.0.0');
    });

    test('sorts categories by order', () => {
      const schema: SettingsSchema = {
        version: '1.0.0',
        categories: [
          { id: 'advanced', label: 'Advanced', order: 3, settings: [] },
          { id: 'general', label: 'General', order: 1, settings: [] },
          { id: 'security', label: 'Security', order: 2, settings: [] }
        ]
      };

      const result = createSettingsSchema(schema);
      
      expect(result.categories[0].id).toBe('general');
      expect(result.categories[1].id).toBe('security');
      expect(result.categories[2].id).toBe('advanced');
    });
  });

  describe('Setting Validation', () => {
    const testSetting: SettingDefinition = {
      key: 'testField',
      label: 'Test Field',
      type: 'string',
      category: 'general'
    };

    describe('validateSetting', () => {
      test('validates required fields', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          required: true
        };

        expect(validateSetting(setting, '')).toBeTruthy();
        expect(validateSetting(setting, 'value')).toBeNull();
      });

      test('validates string type with minLength and maxLength', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'string',
          validation: {
            minLength: 3,
            maxLength: 10
          }
        };

        expect(validateSetting(setting, 'ab')).toContain('at least 3');
        expect(validateSetting(setting, 'valid')).toBeNull();
        expect(validateSetting(setting, 'toolongvalue')).toContain('at most 10');
      });

      test('validates string with pattern', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'string',
          validation: {
            pattern: '^[A-Z]+$'
          }
        };

        expect(validateSetting(setting, 'lowercase')).toContain('Invalid format');
        expect(validateSetting(setting, 'UPPERCASE')).toBeNull();
      });

      test('validates email type', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'email'
        };

        expect(validateSetting(setting, 'invalid')).toContain('Invalid email');
        expect(validateSetting(setting, 'test@example.com')).toBeNull();
      });

      test('validates URL type', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'url'
        };

        expect(validateSetting(setting, 'not-a-url')).toContain('Invalid URL');
        expect(validateSetting(setting, 'https://example.com')).toBeNull();
      });

      test('validates IP address type', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'ipaddress'
        };

        expect(validateSetting(setting, '999.999.999.999')).toContain('Invalid IP');
        expect(validateSetting(setting, '192.168.1.1')).toBeNull();
      });

      test('validates number type with min/max', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'number',
          min: 1,
          max: 100
        };

        expect(validateSetting(setting, 0)).toContain('at least 1');
        expect(validateSetting(setting, 50)).toBeNull();
        expect(validateSetting(setting, 101)).toContain('at most 100');
      });

      test('validates boolean type', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'boolean'
        };

        expect(validateSetting(setting, 'string')).toContain('true or false');
        expect(validateSetting(setting, true)).toBeNull();
        expect(validateSetting(setting, false)).toBeNull();
      });

      test('validates select type', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'select',
          options: [
            { value: 'opt1', label: 'Option 1' },
            { value: 'opt2', label: 'Option 2' }
          ]
        };

        expect(validateSetting(setting, 'invalid')).toContain('valid option');
        expect(validateSetting(setting, 'opt1')).toBeNull();
      });

      test('validates multiselect type', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'multiselect',
          options: [
            { value: 'opt1', label: 'Option 1' },
            { value: 'opt2', label: 'Option 2' }
          ]
        };

        expect(validateSetting(setting, ['opt1', 'invalid'])).toContain('Invalid selection');
        expect(validateSetting(setting, ['opt1', 'opt2'])).toBeNull();
      });

      test('validates date/time types', () => {
        const dateSetting: SettingDefinition = {
          ...testSetting,
          type: 'date'
        };

        expect(validateSetting(dateSetting, 'not-a-date')).toContain('Invalid date');
        expect(validateSetting(dateSetting, '2024-01-01')).toBeNull();
      });

      test('validates color type', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          type: 'color'
        };

        expect(validateSetting(setting, 'red')).toContain('hex format');
        expect(validateSetting(setting, '#FF0000')).toBeNull();
      });

      test('uses custom validation function', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          validation: {
            custom: (value) => value === 'forbidden' ? 'Value is forbidden' : null
          }
        };

        expect(validateSetting(setting, 'forbidden')).toBe('Value is forbidden');
        expect(validateSetting(setting, 'allowed')).toBeNull();
      });

      test('uses custom validation message', () => {
        const setting: SettingDefinition = {
          ...testSetting,
          required: true,
          validationMessage: 'Custom error message'
        };

        expect(validateSetting(setting, '')).toBe('Custom error message');
      });
    });

    describe('validateAllSettings', () => {
      test('validates all settings in categories', () => {
        const categories: SettingsCategory[] = [
          {
            id: 'general',
            label: 'General',
            settings: [
              {
                key: 'required',
                label: 'Required Field',
                type: 'string',
                required: true,
                category: 'general'
              },
              {
                key: 'email',
                label: 'Email',
                type: 'email',
                category: 'general'
              }
            ]
          }
        ];

        const values = {
          required: '',
          email: 'invalid-email'
        };

        const result = validateAllSettings(categories, values);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.required).toContain('required');
        expect(result.errors.email).toContain('email');
      });

      test('skips hidden fields', () => {
        const categories: SettingsCategory[] = [
          {
            id: 'general',
            label: 'General',
            settings: [
              {
                key: 'hidden',
                label: 'Hidden',
                type: 'string',
                required: true,
                hidden: true,
                category: 'general'
              }
            ]
          }
        ];

        const result = validateAllSettings(categories, {});
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
      });
    });

    describe('validateSettings with schema', () => {
      test('validates settings against schema', () => {
        const schema: SettingsSchema = {
          version: '1.0.0',
          categories: [
            {
              id: 'general',
              label: 'General',
              settings: [
                {
                  key: 'port',
                  label: 'Port',
                  type: 'number',
                  category: 'general',
                  validation: {
                    min: 1,
                    max: 65535
                  }
                }
              ]
            }
          ]
        };

        const errors = validateSettings(schema, { port: 70000 });
        
        expect(errors.port).toContain('at most 65535');
      });

      test('uses schema onValidate callback', () => {
        const schema: SettingsSchema = {
          version: '1.0.0',
          categories: [],
          onValidate: (settings) => {
            if (settings.password === settings.username) {
              return { password: 'Password cannot be same as username' };
            }
            return null;
          }
        };

        const errors = validateSettings(schema, {
          username: 'admin',
          password: 'admin'
        });
        
        expect(errors.password).toBe('Password cannot be same as username');
      });
    });
  });

  describe('Built-in Validators', () => {
    test('required validator', () => {
      const validator = Validators.required();
      expect(validator('')).toBeTruthy();
      expect(validator('value')).toBeNull();
      
      const customMessage = Validators.required('Custom required');
      expect(customMessage('')).toBe('Custom required');
    });

    test('email validator', () => {
      const validator = Validators.email();
      expect(validator('invalid')).toBeTruthy();
      expect(validator('test@example.com')).toBeNull();
    });

    test('url validator', () => {
      const validator = Validators.url();
      expect(validator('not-a-url')).toBeTruthy();
      expect(validator('https://example.com')).toBeNull();
    });

    test('ipAddress validator', () => {
      const validator = Validators.ipAddress();
      expect(validator('999.999.999.999')).toBeTruthy();
      expect(validator('192.168.1.1')).toBeNull();
    });

    test('port validator', () => {
      const validator = Validators.port();
      expect(validator(0)).toBeTruthy();
      expect(validator(8080)).toBeNull();
      expect(validator(70000)).toBeTruthy();
    });

    test('range validator', () => {
      const validator = Validators.range(1, 100);
      expect(validator(0)).toBeTruthy();
      expect(validator(50)).toBeNull();
      expect(validator(101)).toBeTruthy();
    });

    test('pattern validator', () => {
      const validator = Validators.pattern(/^[A-Z]+$/);
      expect(validator('lowercase')).toBeTruthy();
      expect(validator('UPPERCASE')).toBeNull();
    });

    test('minLength validator', () => {
      const validator = Validators.minLength(3);
      expect(validator('ab')).toBeTruthy();
      expect(validator('abc')).toBeNull();
    });

    test('maxLength validator', () => {
      const validator = Validators.maxLength(5);
      expect(validator('toolong')).toBeTruthy();
      expect(validator('short')).toBeNull();
    });
  });

  describe('Helper Functions', () => {
    describe('getSettingByKey', () => {
      test('finds setting by key', () => {
        const categories: SettingsCategory[] = [
          {
            id: 'general',
            label: 'General',
            settings: [
              { key: 'setting1', label: 'Setting 1', type: 'string', category: 'general' }
            ]
          },
          {
            id: 'advanced',
            label: 'Advanced',
            settings: [
              { key: 'setting2', label: 'Setting 2', type: 'number', category: 'advanced' }
            ]
          }
        ];

        const setting = getSettingByKey(categories, 'setting2');
        
        expect(setting).toBeDefined();
        expect(setting?.label).toBe('Setting 2');
      });

      test('returns undefined for non-existent key', () => {
        const categories: SettingsCategory[] = [];
        const setting = getSettingByKey(categories, 'nonexistent');
        
        expect(setting).toBeUndefined();
      });
    });

    describe('getDefaultSettingsValues', () => {
      test('extracts default values from categories', () => {
        const categories: SettingsCategory[] = [
          {
            id: 'general',
            label: 'General',
            settings: [
              { key: 'str', label: 'String', type: 'string', defaultValue: 'default', category: 'general' },
              { key: 'num', label: 'Number', type: 'number', defaultValue: 42, category: 'general' },
              { key: 'bool', label: 'Boolean', type: 'boolean', defaultValue: true, category: 'general' }
            ]
          }
        ];

        const defaults = getDefaultSettingsValues(categories);
        
        expect(defaults).toEqual({
          str: 'default',
          num: 42,
          bool: true
        });
      });

      test('skips hidden fields', () => {
        const categories: SettingsCategory[] = [
          {
            id: 'general',
            label: 'General',
            settings: [
              { key: 'visible', label: 'Visible', type: 'string', defaultValue: 'shown', category: 'general' },
              { key: 'hidden', label: 'Hidden', type: 'string', defaultValue: 'hidden', hidden: true, category: 'general' }
            ]
          }
        ];

        const defaults = getDefaultSettingsValues(categories);
        
        expect(defaults).toEqual({ visible: 'shown' });
      });
    });

    describe('getRestartRequiredSettings', () => {
      test('identifies settings requiring restart', () => {
        const categories: SettingsCategory[] = [
          {
            id: 'general',
            label: 'General',
            settings: [
              { key: 'port', label: 'Port', type: 'number', requiresRestart: true, category: 'general' },
              { key: 'theme', label: 'Theme', type: 'string', category: 'general' }
            ]
          }
        ];

        const changed = ['port', 'theme'];
        const restartRequired = getRestartRequiredSettings(categories, changed);
        
        expect(restartRequired).toEqual(['port']);
      });

      test('handles object of changed settings', () => {
        const schema: SettingsSchema = {
          version: '1.0.0',
          categories: [
            {
              id: 'general',
              label: 'General',
              settings: [
                { key: 'host', label: 'Host', type: 'string', requiresRestart: true, category: 'general' }
              ]
            }
          ]
        };

        const changed = { host: 'newhost', other: 'value' };
        const restartRequired = getRestartRequiredSettings(schema, changed);
        
        expect(restartRequired).toEqual(['host']);
      });
    });

    describe('flatten/unflatten', () => {
      test('flattens nested settings', () => {
        const nested = {
          server: {
            host: 'localhost',
            port: 8080,
            ssl: {
              enabled: true,
              cert: '/path/to/cert'
            }
          }
        };

        const flat = flattenSettings(nested);
        
        expect(flat).toEqual({
          'server.host': 'localhost',
          'server.port': 8080,
          'server.ssl.enabled': true,
          'server.ssl.cert': '/path/to/cert'
        });
      });

      test('unflattens to nested structure', () => {
        const flat = {
          'db.host': 'localhost',
          'db.port': 5432,
          'db.auth.user': 'admin'
        };

        const nested = unflattenSettings(flat);
        
        expect(nested).toEqual({
          db: {
            host: 'localhost',
            port: 5432,
            auth: {
              user: 'admin'
            }
          }
        });
      });

      test('flattenSettingsValues alias works', () => {
        const nested = { a: { b: 'c' } };
        expect(flattenSettingsValues(nested)).toEqual(flattenSettings(nested));
      });

      test('unflattenSettingsValues alias works', () => {
        const flat = { 'a.b': 'c' };
        expect(unflattenSettingsValues(flat)).toEqual(unflattenSettings(flat));
      });
    });

    describe('evaluateFieldVisibility', () => {
      test('evaluates showIf condition', () => {
        const field: SettingDefinition = {
          key: 'advanced',
          label: 'Advanced',
          type: 'string',
          category: 'general',
          showIf: (settings) => settings.mode === 'advanced'
        };

        expect(evaluateFieldVisibility(field, { mode: 'basic' })).toBe(false);
        expect(evaluateFieldVisibility(field, { mode: 'advanced' })).toBe(true);
      });

      test('returns true when no showIf', () => {
        const field: SettingDefinition = {
          key: 'always',
          label: 'Always Visible',
          type: 'string',
          category: 'general'
        };

        expect(evaluateFieldVisibility(field, {})).toBe(true);
      });

      test('handles showIf errors gracefully', () => {
        const field: SettingDefinition = {
          key: 'error',
          label: 'Error Field',
          type: 'string',
          category: 'general',
          showIf: () => {
            throw new Error('Evaluation error');
          }
        };

        // Suppress console.error for this test
        const originalError = console.error;
        console.error = jest.fn();
        
        // Should return true and not throw
        expect(evaluateFieldVisibility(field, {})).toBe(true);
        
        // Restore console.error
        console.error = originalError;
      });
    });

    describe('groupFields', () => {
      test('groups fields by group property', () => {
        const fields: SettingDefinition[] = [
          { key: 'a', label: 'A', type: 'string', category: 'general' },
          { key: 'b', label: 'B', type: 'string', group: 'auth', category: 'general' },
          { key: 'c', label: 'C', type: 'string', group: 'auth', category: 'general' },
          { key: 'd', label: 'D', type: 'string', group: 'network', category: 'general' }
        ];

        const groups = groupFields(fields);
        
        expect(groups.has('_default')).toBe(true);
        expect(groups.get('_default')).toHaveLength(1);
        expect(groups.has('auth')).toBe(true);
        expect(groups.get('auth')).toHaveLength(2);
        expect(groups.has('network')).toBe(true);
        expect(groups.get('network')).toHaveLength(1);
      });

      test('sorts fields within groups by order', () => {
        const fields: SettingDefinition[] = [
          { key: 'a', label: 'A', type: 'string', group: 'test', order: 3, category: 'general' },
          { key: 'b', label: 'B', type: 'string', group: 'test', order: 1, category: 'general' },
          { key: 'c', label: 'C', type: 'string', group: 'test', order: 2, category: 'general' }
        ];

        const groups = groupFields(fields);
        const testGroup = groups.get('test')!;
        
        expect(testGroup[0].key).toBe('b');
        expect(testGroup[1].key).toBe('c');
        expect(testGroup[2].key).toBe('a');
      });
    });

    describe('transforms', () => {
      test('applies toStorage transform', () => {
        const field: SettingDefinition = {
          key: 'test',
          label: 'Test',
          type: 'string',
          category: 'general',
          transform: {
            toStorage: (value) => value.toUpperCase()
          }
        };

        const result = applyToStorageTransform(field, 'hello');
        
        expect(result).toBe('HELLO');
      });

      test('applies fromStorage transform', () => {
        const field: SettingDefinition = {
          key: 'test',
          label: 'Test',
          type: 'string',
          category: 'general',
          transform: {
            fromStorage: (value) => value.toLowerCase()
          }
        };

        const result = applyFromStorageTransform(field, 'HELLO');
        
        expect(result).toBe('hello');
      });

      test('returns value unchanged when no transform', () => {
        const field: SettingDefinition = {
          key: 'test',
          label: 'Test',
          type: 'string',
          category: 'general'
        };

        expect(applyToStorageTransform(field, 'value')).toBe('value');
        expect(applyFromStorageTransform(field, 'value')).toBe('value');
      });
    });

    describe('createSettingsFormState', () => {
      test('creates form state with defaults', () => {
        const categories: SettingsCategory[] = [
          {
            id: 'general',
            label: 'General',
            settings: [
              { key: 'name', label: 'Name', type: 'string', defaultValue: 'Default', category: 'general' }
            ]
          }
        ];

        const state = createSettingsFormState(categories);
        
        expect(state.values.name).toBe('Default');
        expect(state.errors).toEqual({});
        expect(state.touched).toEqual({});
        expect(state.dirty).toEqual({});
        expect(state.isValid).toBe(true);
        expect(state.isSubmitting).toBe(false);
      });

      test('creates form state with initial values', () => {
        const categories: SettingsCategory[] = [
          {
            id: 'general',
            label: 'General',
            settings: [
              { key: 'name', label: 'Name', type: 'string', defaultValue: 'Default', category: 'general' }
            ]
          }
        ];

        const state = createSettingsFormState(categories, { name: 'Custom' });
        
        expect(state.values.name).toBe('Custom');
      });

      test('validates initial state', () => {
        const categories: SettingsCategory[] = [
          {
            id: 'general',
            label: 'General',
            settings: [
              { key: 'email', label: 'Email', type: 'email', required: true, category: 'general' }
            ]
          }
        ];

        const state = createSettingsFormState(categories, { email: 'invalid' });
        
        expect(state.isValid).toBe(false);
        expect(state.errors.email).toContain('email');
      });
    });
  });
});