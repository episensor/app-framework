/**
 * Integration tests for Configuration Management
 */

import { ConfigManager } from '../../src/services/configManager.js';
import { z } from 'zod';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('Configuration Integration', () => {
  let configManager: ConfigManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for test configs
    tempDir = path.join(os.tmpdir(), `config-test-${Date.now()}`);
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  test('loads and validates configuration from file', async () => {
    // Create test config file
    const configPath = path.join(tempDir, 'app.json');
    const testConfig = {
      server: {
        port: 8080,
        host: 'localhost'
      },
      database: {
        url: 'postgresql://localhost/test'
      }
    };
    
    await fs.writeJson(configPath, testConfig);

    // Define schema
    const schema = z.object({
      server: z.object({
        port: z.number(),
        host: z.string()
      }),
      database: z.object({
        url: z.string()
      })
    });

    // Create and initialize config manager
    configManager = new ConfigManager({
      configDir: tempDir,
      schema,
      configFile: 'app.json'
    });

    await configManager.initialize();

    // Verify config loaded correctly
    expect(configManager.get('server.port')).toBe(8080);
    expect(configManager.get('server.host')).toBe('localhost');
    expect(configManager.get('database.url')).toBe('postgresql://localhost/test');
  });

  test('validates configuration against schema', async () => {
    // Create invalid config file
    const configPath = path.join(tempDir, 'app.json');
    const invalidConfig = {
      server: {
        port: 'not-a-number', // Invalid type
        host: 'localhost'
      }
    };
    
    await fs.writeJson(configPath, invalidConfig);

    const schema = z.object({
      server: z.object({
        port: z.number(),
        host: z.string()
      })
    });

    configManager = new ConfigManager({
      configDir: tempDir,
      schema,
      configFile: 'app.json'
    });

    // Should throw validation error
    await expect(configManager.initialize()).rejects.toThrow();
  });

  test('merges environment variables with file config', async () => {
    // Set environment variables
    process.env.APP_PORT = '3000';
    process.env.APP_HOST = '0.0.0.0';

    // Create config file
    const configPath = path.join(tempDir, 'app.json');
    const fileConfig = {
      server: {
        port: 8080,
        host: 'localhost'
      },
      feature: {
        enabled: true
      }
    };
    
    await fs.writeJson(configPath, fileConfig);

    const schema = z.object({
      server: z.object({
        port: z.number(),
        host: z.string()
      }),
      feature: z.object({
        enabled: z.boolean()
      })
    });

    configManager = new ConfigManager({
      configDir: tempDir,
      schema,
      configFile: 'app.json',
      envMapping: {
        'APP_PORT': 'server.port',
        'APP_HOST': 'server.host'
      }
    });

    await configManager.initialize();

    // Environment variables should override file config
    expect(configManager.get('server.port')).toBe(3000);
    expect(configManager.get('server.host')).toBe('0.0.0.0');
    // File config should remain for non-overridden values
    expect(configManager.get('feature.enabled')).toBe(true);

    // Clean up env vars
    delete process.env.APP_PORT;
    delete process.env.APP_HOST;
  });

  test('handles missing configuration file gracefully', async () => {
    const schema = z.object({
      server: z.object({
        port: z.number().default(8080),
        host: z.string().default('localhost')
      })
    });

    configManager = new ConfigManager({
      configDir: tempDir,
      schema,
      configFile: 'nonexistent.json'
    });

    await configManager.initialize();

    // Should use schema defaults
    expect(configManager.get('server.port')).toBe(8080);
    expect(configManager.get('server.host')).toBe('localhost');
  });

  test('supports configuration updates', async () => {
    const configPath = path.join(tempDir, 'app.json');
    const initialConfig = {
      server: {
        port: 8080,
        debug: false
      }
    };
    
    await fs.writeJson(configPath, initialConfig);

    const schema = z.object({
      server: z.object({
        port: z.number(),
        debug: z.boolean()
      })
    });

    configManager = new ConfigManager({
      configDir: tempDir,
      schema,
      configFile: 'app.json'
    });

    await configManager.initialize();

    // Update configuration
    await configManager.set('server.debug', true);
    await configManager.set('server.port', 9090);
    
    // Save to file
    await configManager.save();

    // Read file to verify it was saved
    const savedConfig = await fs.readJson(configPath);
    expect(savedConfig.server.debug).toBe(true);
    expect(savedConfig.server.port).toBe(9090);
  });

  test('handles nested configuration paths', async () => {
    const configPath = path.join(tempDir, 'app.json');
    const config = {
      database: {
        connections: {
          primary: {
            host: 'db1.example.com',
            port: 5432
          },
          secondary: {
            host: 'db2.example.com',
            port: 5432
          }
        }
      }
    };
    
    await fs.writeJson(configPath, config);

    const schema = z.object({
      database: z.object({
        connections: z.object({
          primary: z.object({
            host: z.string(),
            port: z.number()
          }),
          secondary: z.object({
            host: z.string(),
            port: z.number()
          })
        })
      })
    });

    configManager = new ConfigManager({
      configDir: tempDir,
      schema,
      configFile: 'app.json'
    });

    await configManager.initialize();

    // Test nested path access
    expect(configManager.get('database.connections.primary.host')).toBe('db1.example.com');
    expect(configManager.get('database.connections.secondary.port')).toBe(5432);
  });

  test('validates individual config updates', async () => {
    const configPath = path.join(tempDir, 'app.json');
    const config = {
      server: {
        port: 8080,
        maxConnections: 100
      }
    };
    
    await fs.writeJson(configPath, config);

    const schema = z.object({
      server: z.object({
        port: z.number().min(1024).max(65535),
        maxConnections: z.number().min(1).max(1000)
      })
    });

    configManager = new ConfigManager({
      configDir: tempDir,
      schema,
      configFile: 'app.json'
    });

    await configManager.initialize();

    // Valid update should work
    await configManager.set('server.port', 3000);
    expect(configManager.get('server.port')).toBe(3000);

    // Invalid update should throw
    await expect(configManager.set('server.port', 999)).rejects.toThrow(); // Below min
    await expect(configManager.set('server.maxConnections', 2000)).rejects.toThrow(); // Above max
  });
});