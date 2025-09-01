/**
 * Unit tests for Port Utilities
 */

import {
  isPortAvailable,
  getProcessOnPort,
  clearPort,
  getPortInfo,
  findAvailablePort,
  checkRequiredPorts,
  formatPortStatus,
  waitForPort,
  getPortsInUse
} from '../../../src/core/portUtils';
import { exec } from 'child_process';

// Mock child_process
jest.mock('child_process');
// Mock net module
jest.mock('net');

// Simple mock implementation
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('Port Utilities', () => {
  let mockServer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup server mock
    mockServer = {
      once: jest.fn(),
      listen: jest.fn(),
      close: jest.fn()
    };
    
    // Mock net.createServer
    const net = require('net');
    net.createServer = jest.fn().mockReturnValue(mockServer);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isPortAvailable', () => {
    test('returns true when port is available', async () => {
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'listening') {
          setTimeout(() => handler(), 0);
        }
        return mockServer;
      });

      const result = await isPortAvailable(3000);
      expect(result).toBe(true);
    });

    test('returns false when port is in use', async () => {
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
        }
        return mockServer;
      });

      const result = await isPortAvailable(3000);
      expect(result).toBe(false);
    });

    test('returns false on other errors', async () => {
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler({ code: 'EACCES' }), 0);
        }
        return mockServer;
      });

      const result = await isPortAvailable(3000);
      expect(result).toBe(false);
    });
  });

  describe('getProcessOnPort', () => {
    test('returns null when no process found', async () => {
      mockExec.mockImplementation((_cmd: any, callback: any) => {
        if (typeof callback === 'function') {
          callback(null, '', '');
        }
        return {} as any;
      });

      const result = await getProcessOnPort(3000);
      expect(result).toBe(null);
    });

    test('returns null on command error', async () => {
      mockExec.mockImplementation((_cmd: any, callback: any) => {
        if (typeof callback === 'function') {
          callback(new Error('Command failed'), '', '');
        }
        return {} as any;
      });

      const result = await getProcessOnPort(3000);
      expect(result).toBe(null);
    });
  });

  describe('clearPort', () => {
    test('returns cleared when no process on port', async () => {
      mockExec.mockImplementation((_cmd: any, callback: any) => {
        if (typeof callback === 'function') {
          callback(null, '', '');
        }
        return {} as any;
      });

      const result = await clearPort(3000);
      expect(result.port).toBe(3000);
      expect(result.cleared).toBe(true);
    });
  });

  describe('findAvailablePort', () => {
    test('finds first available port in range', async () => {
      let callCount = 0;
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'listening') {
          setTimeout(() => handler(), 0);
        } else if (event === 'error' && callCount < 2) {
          callCount++;
          setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
        }
        return mockServer;
      });

      const result = await findAvailablePort(3000, 3005);
      expect(result).toBeGreaterThanOrEqual(3000);
      expect(result).toBeLessThanOrEqual(3005);
    });

    test('returns null when no ports available', async () => {
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
        }
        return mockServer;
      });

      const result = await findAvailablePort(3000, 3001);
      expect(result).toBe(null);
    });

    test('uses default range when not specified', async () => {
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'listening') {
          setTimeout(() => handler(), 0);
        }
        return mockServer;
      });

      const result = await findAvailablePort(3000);
      expect(result).toBeGreaterThanOrEqual(3000);
      expect(result).toBeLessThanOrEqual(3010);
    });
  });

  describe('checkRequiredPorts', () => {
    test('checks multiple ports and returns status', async () => {
      mockExec.mockImplementation((_cmd: any, callback: any) => {
        if (typeof callback === 'function') {
          callback(null, '', '');
        }
        return {} as any;
      });

      const result = await checkRequiredPorts([3000, 3001]);
      expect(result).toHaveLength(2);
      expect(result[0].port).toBe(3000);
      expect(result[0].available).toBe(true);
      expect(result[1].port).toBe(3001);
      expect(result[1].available).toBe(true);
    });

    test('handles empty port list', async () => {
      const result = await checkRequiredPorts([]);
      expect(result).toEqual([]);
    });
  });

  describe('formatPortStatus', () => {
    test('formats status with no conflicts', () => {
      const status = [
        { port: 3000, available: true, process: null },
        { port: 3001, available: true, process: null }
      ];

      const result = formatPortStatus(status);
      expect(result.hasConflicts).toBe(false);
      expect(result.message).toContain('All required ports are available');
    });

    test('formats status with conflicts', () => {
      const status = [
        { port: 3000, available: false, process: { pid: 1234, command: 'node', port: 3000 } },
        { port: 3001, available: true, process: null }
      ];

      const result = formatPortStatus(status);
      expect(result.hasConflicts).toBe(true);
      expect(result.message).toContain('Port conflict detected');
    });

    test('handles empty status', () => {
      const result = formatPortStatus([]);
      expect(result.hasConflicts).toBe(false);
      expect(result.message).toContain('All required ports are available');
    });
  });

  describe('waitForPort', () => {
    test('waits for port to become available', async () => {
      let attempts = 0;
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        attempts++;
        if (event === 'error' && attempts < 3) {
          setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
        } else if (event === 'listening') {
          setTimeout(() => handler(), 0);
        }
        return mockServer;
      });

      const result = await waitForPort(3000, 1000);
      expect(result).toBe(true);
    });

    test('times out if port never becomes available', async () => {
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
        }
        return mockServer;
      });

      const result = await waitForPort(3000, 500);
      expect(result).toBe(false);
    });

    test('uses default timeout', async () => {
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'listening') {
          setTimeout(() => handler(), 0);
        }
        return mockServer;
      });

      const result = await waitForPort(3000);
      expect(result).toBe(true);
    });
  });

  describe('getPortInfo', () => {
    test('gets port information', async () => {
      mockExec.mockImplementation((_cmd: any, callback: any) => {
        if (typeof callback === 'function') {
          callback(null, '', '');
        }
        return {} as any;
      });

      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'listening') {
          setTimeout(() => handler(), 0);
        }
        return mockServer;
      });

      const result = await getPortInfo(3000);
      expect(result).toContain('Port 3000');
      expect(result).toContain('available');
    });

    test('returns available port info', async () => {
      mockExec.mockImplementation((_cmd: any, callback: any) => {
        if (typeof callback === 'function') {
          callback(null, '', '');
        }
        return {} as any;
      });

      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
        }
        return mockServer;
      });

      const result = await getPortInfo(3000);
      expect(result).toContain('Port 3000');
      expect(result).toContain('in use');
    });
  });

  describe('getPortsInUse', () => {
    test('returns list of ports in use', async () => {
      let callCount = 0;
      const portsToMarkInUse = [3000, 3002];
      
      // Mock net.createServer for each call
      const net = require('net');
      net.createServer = jest.fn(() => {
        const currentPort = 3000 + callCount;
        callCount++;
        
        const server: any = {
          once: jest.fn((event: string, handler: Function): any => {
            if (event === 'error' && portsToMarkInUse.includes(currentPort)) {
              setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
            } else if (event === 'listening') {
              setTimeout(() => handler(), 0);
            }
            return server;
          }),
          listen: jest.fn(),
          close: jest.fn()
        };
        return server;
      });

      const result = await getPortsInUse(3000, 3002);
      expect(result).toContain(3000);
      expect(result).toContain(3002);
      expect(result).not.toContain(3001);
    });

    test('returns empty array when all ports are available', async () => {
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'listening') {
          setTimeout(() => handler(), 0);
        }
        return mockServer;
      });

      const result = await getPortsInUse(3000, 3002);
      expect(result).toEqual([]);
    });

    test('handles single port range', async () => {
      mockServer.once.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler({ code: 'EADDRINUSE' }), 0);
        }
        return mockServer;
      });

      const result = await getPortsInUse(3000, 3000);
      expect(result).toEqual([3000]);
    });
  });
});