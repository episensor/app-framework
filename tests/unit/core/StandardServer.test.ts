/**
 * Unit tests for StandardServer
 */

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    log: jest.fn()
  }));
});

// Mock dependencies BEFORE imports
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn(),
    listen: jest.fn(),
    set: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn()
  };
  const expressMock: any = jest.fn(() => mockApp);
  expressMock.json = jest.fn(() => (req: any, res: any, next: any) => next());
  expressMock.urlencoded = jest.fn(() => (req: any, res: any, next: any) => next());
  expressMock.static = jest.fn(() => (req: any, res: any, next: any) => next());
  return expressMock;
});
jest.mock('http');
jest.mock('../../../src/services/websocketServer');
jest.mock('../../../src/utils/startupBanner', () => ({
  displayStartupBanner: jest.fn()
}));
jest.mock('../../../src/core/portUtils');
jest.mock('../../../src/core', () => ({
  ...jest.requireActual('../../../src/core'),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

import { StandardServer, StandardServerConfig } from '../../../src/core/StandardServer';
import * as express from 'express';
import { createServer } from 'http';
import { createWebSocketServer } from '../../../src/services/websocketServer';
import { displayStartupBanner } from '../../../src/utils/startupBanner';
import { getProcessOnPort } from '../../../src/core/portUtils';
import { createLogger } from '../../../src/core';

const mockApp = {
  use: jest.fn(),
  get: jest.fn(),
  listen: jest.fn()
};

const mockHttpServer = {
  listen: jest.fn((_port: number, _host: string, callback: Function) => {
    callback();
  }),
  close: jest.fn((callback?: Function) => {
    if (callback) callback();
  }),
  on: jest.fn(),
  address: jest.fn(() => ({ port: 8080, address: 'localhost' }))
};

const mockWsServer = {
  close: jest.fn()
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('StandardServer', () => {
  let servers: StandardServer[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    servers = [];

    (express as unknown as jest.Mock).mockReturnValue(mockApp);
    (createServer as jest.Mock).mockReturnValue(mockHttpServer);
    (createWebSocketServer as jest.Mock).mockResolvedValue(mockWsServer);
    (displayStartupBanner as jest.Mock).mockReturnValue(undefined);
    (getProcessOnPort as jest.Mock).mockResolvedValue(null);
    (createLogger as jest.Mock).mockReturnValue(mockLogger);
  });

  afterEach(async () => {
    // Clean up all servers created during tests
    for (const server of servers) {
      try {
        await server.stop();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    servers = [];
  });

  describe('constructor', () => {
    test('creates server with default config', () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const server = new StandardServer(config);
      servers.push(server);
      
      expect(server).toBeDefined();
      expect(express).toHaveBeenCalled();
      expect(createServer).toHaveBeenCalledWith(mockApp);
    });

    test('creates server with custom config', () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        description: 'Test application',
        port: 3000,
        host: '0.0.0.0',
        environment: 'production',
        enableWebSocket: false
      };

      const server = new StandardServer(config);
      servers.push(server);
      
      expect(server).toBeDefined();
      expect(server['config'].port).toBe(3000);
      expect(server['config'].host).toBe('0.0.0.0');
      expect(server['config'].environment).toBe('production');
      expect(server['config'].enableWebSocket).toBe(false);
    });
  });

  describe('initialize', () => {
    test('initializes server successfully', async () => {
      const onInitialize = jest.fn().mockResolvedValue(undefined);
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        onInitialize
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();

      expect(onInitialize).toHaveBeenCalledWith(mockApp);
      expect(server['isInitialized']).toBe(true);
    });

    test('skips initialization if already initialized', async () => {
      const onInitialize = jest.fn();
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        onInitialize
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.initialize(); // Second call

      expect(onInitialize).toHaveBeenCalledTimes(1);
    });

    test('handles initialization errors', async () => {
      const onInitialize = jest.fn().mockRejectedValue(new Error('Init failed'));
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        onInitialize
      };

      const server = new StandardServer(config);
      servers.push(server);
      
      await expect(server.initialize()).rejects.toThrow('Init failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    test('starts server successfully', async () => {
      const onStart = jest.fn().mockResolvedValue(undefined);
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        onStart
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.start();

      expect(mockHttpServer.listen).toHaveBeenCalledWith(
        8080,
        'localhost',
        expect.any(Function)
      );
      expect(displayStartupBanner).toHaveBeenCalled();
      expect(onStart).toHaveBeenCalled();
    });

    test('creates WebSocket server when enabled', async () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        enableWebSocket: true
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.start();

      expect(createWebSocketServer).toHaveBeenCalledWith(mockHttpServer);
      expect(server['wsServer']).toBe(mockWsServer);
    });

    test('skips WebSocket creation when disabled', async () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        enableWebSocket: false
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.start();

      expect(createWebSocketServer).not.toHaveBeenCalled();
      expect(server['wsServer']).toBeUndefined();
    });

    test('handles port conflicts', async () => {
      (getProcessOnPort as jest.Mock).mockResolvedValue({
        pid: 1234,
        command: 'node',
        port: 8080
      });

      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.start();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Port 8080 is already in use')
      );
    });

    test('starts with separate web port', async () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        port: 8080,
        webPort: 3000
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.start();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Web UI Port: 3000')
      );
    });

    test('handles start errors', async () => {
      mockHttpServer.listen.mockImplementation(() => {
        throw new Error('Listen failed');
      });

      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      
      await expect(server.start()).rejects.toThrow('Listen failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    test('stops server gracefully', async () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        enableWebSocket: true
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.start();
      await server.stop();

      expect(mockWsServer.close).toHaveBeenCalled();
      expect(mockHttpServer.close).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Server stopped gracefully');
    });

    test('handles stop when server not started', async () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.stop(); // Should not throw

      expect(mockHttpServer.close).toHaveBeenCalled();
    });

    test('handles stop errors', async () => {
      mockHttpServer.close.mockImplementation((callback?: Function) => {
        if (callback) callback(new Error('Close failed'));
      });

      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.start();
      
      await expect(server.stop()).rejects.toThrow('Close failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getters', () => {
    test('getApp returns Express app', () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const server = new StandardServer(config);
      servers.push(server);
      
      expect(server.getApp()).toBe(mockApp);
    });

    test('getServer returns HTTP server', () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const server = new StandardServer(config);
      servers.push(server);
      
      expect(server.getServer()).toBe(mockHttpServer);
    });

    test('returns WebSocket server through private property', async () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        enableWebSocket: true
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.start();
      
      expect(server['wsServer']).toBe(mockWsServer);
    });

    test('does not create WebSocket when disabled', () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0',
        enableWebSocket: false
      };

      const server = new StandardServer(config);
      servers.push(server);
      
      expect(server['wsServer']).toBeUndefined();
    });
  });

  describe('error handling', () => {
    test('handles server error events', async () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const server = new StandardServer(config);
      servers.push(server);
      
      // Simulate server error
      const errorHandler = mockHttpServer.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      if (errorHandler) {
        const error = new Error('Server error');
        errorHandler(error);
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Server error:',
          error
        );
      }
    });
  });

  describe('signal handling', () => {
    test('registers shutdown handlers', () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const processSpy = jest.spyOn(process, 'on');
      
      const server = new StandardServer(config);
      servers.push(server);
      
      expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      
      processSpy.mockRestore();
    });
  });

  describe('startup time tracking', () => {
    test('tracks start time', async () => {
      const config: StandardServerConfig = {
        appName: 'TestApp',
        appVersion: '1.0.0'
      };

      const server = new StandardServer(config);
      servers.push(server);
      await server.initialize();
      await server.start();
      
      expect(server['startTime']).toBeDefined();
      expect(server['startTime']).toBeGreaterThan(0);
    });
  });
});