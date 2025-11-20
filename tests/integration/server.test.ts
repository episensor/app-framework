/**
 * Integration tests for StandardServer
 */

import { StandardServer } from '../../src/core/StandardServer.js';

describe('StandardServer Integration', () => {
  let server: StandardServer;

  afterEach(async () => {
    if (server) {
      try {
        await server.stop();
      } catch (_err) {
        // ignore teardown errors in negative-path tests
      }
      server = undefined as any;
    }
  });

  test('starts and stops cleanly', async () => {
    server = new StandardServer({
      appName: 'Test App',
      appVersion: '1.0.0',
      port: 0, // Use random port
    });

    await server.initialize();
    await server.start();

    // Server should be running
    expect(server.getServer()).toBeDefined();
  });

  test('initializes middleware and routes', async () => {
    let middlewareInitialized = false;
    
    server = new StandardServer({
      appName: 'Test App',
      appVersion: '1.0.0',
      port: 0,
      onInitialize: async (app) => {
        middlewareInitialized = true;
        
        // Add a test route
        app.get('/test', (_req, res) => {
          res.json({ success: true });
        });
      },
    });

    await server.initialize();
    expect(middlewareInitialized).toBe(true);
    
    await server.start();
  });

  test('handles initialization errors gracefully', async () => {
    server = new StandardServer({
      appName: 'Test App',
      appVersion: '1.0.0',
      port: 0,
      onInitialize: async () => {
        throw new Error('Initialization failed');
      },
    });

    await expect(server.initialize()).rejects.toThrow('Initialization failed');
    server = undefined as any;
  });

  test.skip('handles port conflicts', async () => {
    // Start first server
    const server1 = new StandardServer({
      appName: 'Server 1',
      appVersion: '1.0.0',
      port: 19999,
    });
    
    await server1.initialize();
    await server1.start();

    // Second server on same port should fail
    server = new StandardServer({
      appName: 'Server 2',
      appVersion: '1.0.0',
      port: 19999,
    });
    
    await server.initialize();
    
    // Mock process.exit to prevent test from exiting
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(((code?: number | undefined) => {
      throw new Error(`Process exit called with code ${code}`);
    }) as any);
    
    let startError: any;
    try {
      await server.start();
    } catch (err) {
      startError = err;
    }
    expect(startError).toBeDefined();
    
    mockExit.mockRestore();
    server = undefined as any;
    await server1.stop();
  });

  test('enables WebSocket when configured', async () => {
    server = new StandardServer({
      appName: 'WebSocket Test',
      appVersion: '1.0.0',
      port: 0,
      enableWebSocket: true,
    });

    await server.initialize();
    await server.start();
    
    // WebSocket server should be initialized
    // Note: We'd need to expose wsServer getter for proper testing
    expect(server.getServer()).toBeDefined();
  });

  test.skip('respects environment configuration', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    server = new StandardServer({
      appName: 'Env Test',
      appVersion: '1.0.0',
      port: 0,
    });

    await server.initialize();
    
    // In production, webPort should default to main port
    // This would be visible in the startup banner
    
    process.env.NODE_ENV = originalEnv;
  });
});
