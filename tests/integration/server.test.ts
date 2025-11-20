/**
 * Integration tests for StandardServer
 */

import { StandardServer } from '../../src/core/StandardServer.js';
import net from 'net';

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

  test('respects environment configuration defaults', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    server = new StandardServer({
      appName: 'Env Test',
      appVersion: '1.0.0',
      port: 0,
    });

    await server.initialize();
    await server.start();

    // In production the default host should be 0.0.0.0
    expect((server as any).config.host).toBe("0.0.0.0");

    await server.stop();
    server = undefined as any;
    process.env.NODE_ENV = originalEnv;
  });

  test('handles port conflicts', async () => {
    // Occupy a known port with a simple TCP server
    const occupiedPort = 19999;
    const blocker = net.createServer().listen(occupiedPort);
    await new Promise(resolve => blocker.once('listening', resolve));

    server = new StandardServer({
      appName: 'Server 2',
      appVersion: '1.0.0',
      port: occupiedPort,
      exitOnStartupError: true,
    });
    
    await server.initialize();
    
    // Mock process.exit to prevent test from exiting
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(((code?: number | undefined) => {
      throw new Error(`Process exit called with code ${code}`);
    }) as any);
    
    await expect(server.start()).rejects.toThrow();
    
    mockExit.mockRestore();
    server = undefined as any;
    await new Promise(resolve => blocker.close(resolve));
  });
});
