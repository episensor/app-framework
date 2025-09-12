/**
 * Unit tests for Configuration Manager Service
 */

import { ConfigManager, ConfigOptions } from '../../../src/services/configManager';
import { existsSync, readFileSync, writeFileSync, mkdirSync, FSWatcher } from 'fs';
import * as fs from 'fs';
import { z } from 'zod';

// Mock dependencies
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  watch: jest.fn(),
  promises: {
    readFile: jest.fn()
  }
}));
jest.mock('dotenv', () => ({
  config: jest.fn()
}));
jest.mock('../../../src/core', () => ({
  ...jest.requireActual('../../../src/core'),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Default mock behaviors
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
    mockWriteFileSync.mockReturnValue(undefined);
    mockMkdirSync.mockReturnValue(undefined);
    
    // Mock fs.promises.readFile
    (fs.promises.readFile as jest.Mock).mockResolvedValue('{}');
    
    // Clear environment variables
    delete process.env.NODE_ENV;
    delete process.env.TEST_VAR;
  });

  describe('constructor', () => {
    test('creates instance with default options', () => {
      configManager = new ConfigManager();
      
      expect(configManager).toBeDefined();
    });

    test('creates instance with custom options', () => {
      const options: ConfigOptions = {
        configPath: './custom-config.json',
        defaults: { testKey: 'testValue' },
        mergeEnv: true
      };
      
      configManager = new ConfigManager(options);
      
      expect(configManager).toBeDefined();
    });

    test('creates instance with schema validation', () => {
      const schema = z.object({
        port: z.number(),
        host: z.string()
      });
      
      const options: ConfigOptions = {
        schema,
        defaults: { port: 3000, host: 'localhost' }
      };
      
      configManager = new ConfigManager(options);
      
      expect(configManager).toBeDefined();
    });
  });

  describe('load', () => {
    beforeEach(() => {
      configManager = new ConfigManager();
    });

    test('loads configuration with defaults', async () => {
      const options: ConfigOptions = {
        defaults: { key: 'value' }
      };
      
      configManager = new ConfigManager(options);
      const config = await configManager.load();
      
      expect(config).toEqual({ key: 'value' });
    });

    test('loads configuration from file', async () => {
      mockExistsSync.mockReturnValue(true);
      (fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify({
        loaded: 'fromFile'
      }));
      
      const options: ConfigOptions = {
        configPath: './config.json'
      };
      
      configManager = new ConfigManager(options);
      const config = await configManager.load();
      
      expect(config).toMatchObject({ loaded: 'fromFile' });
    });

    test('merges environment variables when enabled', async () => {
      process.env.TEST_KEY = 'envValue';
      
      const options: ConfigOptions = {
        defaults: { defaultKey: 'defaultValue' },
        mergeEnv: true
      };
      
      configManager = new ConfigManager(options);
      const config = await configManager.load();
      
      expect(config).toMatchObject({
        defaultKey: 'defaultValue',
        TEST_KEY: 'envValue'
      });
    });

    test('validates against schema', async () => {
      const schema = z.object({
        port: z.number(),
        host: z.string()
      });
      
      const options: ConfigOptions = {
        schema,
        defaults: { port: 3000, host: 'localhost' }
      };
      
      configManager = new ConfigManager(options);
      const config = await configManager.load();
      
      expect(config).toEqual({ port: 3000, host: 'localhost' });
    });

    test('throws on schema validation failure', async () => {
      const schema = z.object({
        port: z.number().min(1).max(65535),
        host: z.string()
      });
      
      const options: ConfigOptions = {
        schema,
        defaults: { port: -1, host: 'localhost' } // Invalid port
      };
      
      configManager = new ConfigManager(options);
      
      await expect(configManager.load()).rejects.toThrow();
    });

    test('loads environment file when specified', async () => {
      const dotenv = require('dotenv');
      dotenv.config = jest.fn().mockReturnValue({ parsed: { ENV_KEY: 'envValue' } });
      
      const options: ConfigOptions = {
        envPath: '.env.test'
      };
      
      configManager = new ConfigManager(options);
      await configManager.load();
      
      expect(dotenv.config).toHaveBeenCalledWith({ path: '.env.test' });
    });

    test('handles missing environment file gracefully', async () => {
      const dotenv = require('dotenv');
      dotenv.config = jest.fn().mockReturnValue({ error: new Error('File not found') });
      
      const options: ConfigOptions = {
        envPath: '.env.missing'
      };
      
      configManager = new ConfigManager(options);
      const config = await configManager.load();
      
      expect(config).toBeDefined();
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      configManager = new ConfigManager({
        defaults: {
          topLevel: 'value',
          nested: {
            key: 'nestedValue',
            deep: {
              value: 'deepValue'
            }
          }
        }
      });
      await configManager.load();
    });

    test('returns top-level value', () => {
      const value = configManager.get('topLevel');
      expect(value).toBe('value');
    });

    test('returns nested value with dot notation', () => {
      const value = configManager.get('nested.key');
      expect(value).toBe('nestedValue');
    });

    test('returns deeply nested value', () => {
      const value = configManager.get('nested.deep.value');
      expect(value).toBe('deepValue');
    });

    test('returns undefined for non-existent key', () => {
      const value = configManager.get('nonExistent');
      expect(value).toBeUndefined();
    });

    test('returns entire config when empty string specified', () => {
      const config = configManager.get('');
      expect(config).toMatchObject({
        topLevel: 'value',
        nested: {
          key: 'nestedValue',
          deep: {
            value: 'deepValue'
          }
        }
      });
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      configManager = new ConfigManager();
      await configManager.load();
    });

    test('sets top-level value', () => {
      configManager.set('key', 'value');
      expect(configManager.get('key')).toBe('value');
    });

    test('sets nested value with dot notation', () => {
      configManager.set('nested.key', 'value');
      expect(configManager.get('nested.key')).toBe('value');
    });

    test('creates nested structure if not exists', () => {
      configManager.set('new.nested.key', 'value');
      expect(configManager.get('new.nested.key')).toBe('value');
    });

    test('overwrites existing value', () => {
      configManager.set('key', 'value1');
      configManager.set('key', 'value2');
      expect(configManager.get('key')).toBe('value2');
    });

    test('sets object value', () => {
      const obj = { foo: 'bar', nested: { value: 'test' } };
      configManager.set('objKey', obj);
      expect(configManager.get('objKey')).toEqual(obj);
    });
  });

  describe('save', () => {
    beforeEach(async () => {
      configManager = new ConfigManager({
        configPath: './config.json',
        defaults: { key: 'value' }
      });
      await configManager.load();
    });

    test('saves configuration to file', async () => {
      mockExistsSync.mockReturnValue(true);
      
      await configManager.save();
      
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        './config.json',
        expect.stringContaining('"key":"value"'),
        'utf-8'
      );
    });

    test('creates directory if not exists', async () => {
      mockExistsSync.mockReturnValue(false);
      
      configManager = new ConfigManager({
        configPath: './newdir/config.json'
      });
      await configManager.load();
      await configManager.save();
      
      expect(mockMkdirSync).toHaveBeenCalledWith('./newdir', { recursive: true });
    });

    test('handles save errors gracefully', async () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });
      
      await expect(configManager.save()).rejects.toThrow('Write failed');
    });

    test('does nothing when no configPath specified', async () => {
      configManager = new ConfigManager();
      await configManager.load();
      await configManager.save();
      
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('watch', () => {
    let mockWatcher: Partial<FSWatcher>;

    beforeEach(async () => {
      mockWatcher = {
        on: jest.fn().mockReturnThis(),
        close: jest.fn()
      };
      
      (fs.watch as jest.Mock) = jest.fn().mockReturnValue(mockWatcher);
      
      configManager = new ConfigManager({
        configPath: './config.json',
        watchForChanges: true
      });
    });

    test('watches configuration file when enabled', async () => {
      await configManager.load();
      // File watching is automatic when watchForChanges is true
      expect(fs.watch).toHaveBeenCalledWith('./config.json', expect.any(Function));
    });

    test('reloads on file change', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify({ initial: 'value' }))
        .mockReturnValueOnce(JSON.stringify({ updated: 'value' }));
      
      await configManager.load();
      // File watching starts automatically
      
      // Simulate file change
      const changeHandler = (fs.watch as jest.Mock).mock.calls[0][1];
      changeHandler('change', 'config.json');
      
      // Allow async reload to complete
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockReadFileSync).toHaveBeenCalledTimes(2);
    });

    test('stops watching when dispose called', async () => {
      await configManager.load();
      configManager.dispose();
      
      expect(mockWatcher.close).toHaveBeenCalled();
    });

    test('does nothing when no configPath', async () => {
      configManager = new ConfigManager({ watchForChanges: true });
      await configManager.load();
      
      expect(fs.watch).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    test('validates required fields', async () => {
      const options: ConfigOptions = {
        required: ['port', 'host'],
        defaults: { port: 3000, host: 'localhost' }
      };
      
      configManager = new ConfigManager(options);
      const config = await configManager.load();
      
      expect(config).toMatchObject({ port: 3000, host: 'localhost' });
    });

    test('throws when required field missing', async () => {
      const options: ConfigOptions = {
        required: ['port', 'host'],
        defaults: { port: 3000 } // Missing 'host'
      };
      
      configManager = new ConfigManager(options);
      
      await expect(configManager.load()).rejects.toThrow();
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      configManager = new ConfigManager({
        defaults: {
          environment: 'production',
          port: 3000
        }
      });
      await configManager.load();
    });

    test('environment is included in config', () => {
      const config = configManager.getAll();
      expect(config.environment).toBe('production');
    });
  });
});