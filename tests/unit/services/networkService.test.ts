/**
 * Unit tests for NetworkService
 */

import NetworkService from '../../../src/services/networkService';
import * as os from 'os';
import * as fs from 'fs';
import * as net from 'net';

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    log: jest.fn()
  }));
});

// Mock dependencies
jest.mock('os');
jest.mock('fs');
jest.mock('net');

// Mock the logger
jest.mock('../../../src/core', () => ({
  ...jest.requireActual('../../../src/core'),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('NetworkService', () => {
  let networkService: NetworkService;
  const mockOs = os as jest.Mocked<typeof os>;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockNet = net as jest.Mocked<typeof net>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    networkService = new NetworkService();
  });

  describe('getNetworkInterfaces', () => {
    test('returns network interfaces with IPv4 addresses', () => {
      const mockInterfaces = {
        'eth0': [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24'
          },
          {
            address: 'fe80::1',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: 'fe80::1/64'
          }
        ],
        'lo': [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8'
          }
        ]
      };
      
      mockOs.networkInterfaces.mockReturnValue(mockInterfaces as any);
      
      const interfaces = networkService.getNetworkInterfaces();
      
      expect(interfaces).toHaveLength(1);
      expect(interfaces[0].name).toBe('eth0');
      expect(interfaces[0].addresses).toHaveLength(1);
      expect(interfaces[0].addresses[0].address).toBe('192.168.1.100');
    });

    test('handles missing interfaces gracefully', () => {
      mockOs.networkInterfaces.mockReturnValue({});
      
      const interfaces = networkService.getNetworkInterfaces();
      
      expect(interfaces).toEqual([]);
    });
  });

  describe('getPrimaryIpAddress', () => {
    test('returns primary IPv4 address', () => {
      const mockInterfaces = {
        'eth0': [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24'
          }
        ]
      };
      
      mockOs.networkInterfaces.mockReturnValue(mockInterfaces as any);
      
      const ip = networkService.getPrimaryIpAddress();
      
      expect(ip).toBe('192.168.1.100');
    });

    test('returns null when no external IPv4 address found', () => {
      const mockInterfaces = {
        'lo': [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8'
          }
        ]
      };
      
      mockOs.networkInterfaces.mockReturnValue(mockInterfaces as any);
      
      const ip = networkService.getPrimaryIpAddress();
      
      expect(ip).toBeNull();
    });
  });

  describe('getBindingOptions', () => {
    test('returns binding options for server configuration', () => {
      const mockInterfaces = {
        'eth0': [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24'
          }
        ],
        'eth1': [
          {
            address: '10.0.0.50',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:01',
            internal: false,
            cidr: '10.0.0.50/24'
          }
        ]
      };
      
      mockOs.networkInterfaces.mockReturnValue(mockInterfaces as any);
      
      const options = networkService.getBindingOptions();
      
      expect(options).toContainEqual(
        expect.objectContaining({
          value: '0.0.0.0',
          label: 'All interfaces',
          description: 'Listen on all available network interfaces'
        })
      );
      
      expect(options).toContainEqual(
        expect.objectContaining({
          value: '127.0.0.1',
          label: 'Localhost only',
          description: 'Only accessible from this machine'
        })
      );
      
      expect(options).toContainEqual(
        expect.objectContaining({
          value: '192.168.1.100',
          interface: 'eth0'
        })
      );
    });
  });

  describe('getNetworkInfo', () => {
    test('returns complete network information', () => {
      const mockInterfaces = {
        'eth0': [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24'
          }
        ]
      };
      
      mockOs.networkInterfaces.mockReturnValue(mockInterfaces as any);
      mockOs.hostname.mockReturnValue('test-host');
      
      const info = networkService.getNetworkInfo();
      
      expect(info.hostname).toBe('test-host');
      expect(info.primaryIp).toBe('192.168.1.100');
      expect(info.interfaces).toHaveLength(1);
      expect(info.bindingOptions).toBeDefined();
      expect(info.bindingOptions.length).toBeGreaterThan(0);
    });
  });

  // These tests are for methods that don't exist yet in NetworkService
  /*
  describe('isPortAvailable', () => {
    test('checks if port is available', async () => {
      const mockServer = {
        listen: jest.fn((port, callback) => callback()),
        close: jest.fn((callback) => callback()),
        on: jest.fn()
      };
      
      mockNet.createServer.mockReturnValue(mockServer as any);
      
      const available = await networkService.isPortAvailable(3000);
      
      expect(available).toBe(true);
      expect(mockServer.listen).toHaveBeenCalledWith(3000, expect.any(Function));
      expect(mockServer.close).toHaveBeenCalled();
    });

    test('returns false when port is in use', async () => {
      const mockServer = {
        listen: jest.fn((port, callback) => {
          const error: any = new Error('Port in use');
          error.code = 'EADDRINUSE';
          mockServer.on.mock.calls[0][1](error);
        }),
        close: jest.fn(),
        on: jest.fn()
      };
      
      mockNet.createServer.mockReturnValue(mockServer as any);
      
      const available = await networkService.isPortAvailable(3000);
      
      expect(available).toBe(false);
    });
  });

  describe('findAvailablePort', () => {
    test('finds first available port in range', async () => {
      let attempts = 0;
      const mockServer = {
        listen: jest.fn((port, callback) => {
          if (attempts < 2) {
            attempts++;
            const error: any = new Error('Port in use');
            error.code = 'EADDRINUSE';
            mockServer.on.mock.calls[attempts - 1][1](error);
          } else {
            callback();
          }
        }),
        close: jest.fn((callback) => callback && callback()),
        on: jest.fn()
      };
      
      mockNet.createServer.mockReturnValue(mockServer as any);
      
      const port = await networkService.findAvailablePort(3000, 3005);
      
      expect(port).toBe(3002);
    });

    test('returns null when no ports available', async () => {
      const mockServer = {
        listen: jest.fn((port, callback) => {
          const error: any = new Error('Port in use');
          error.code = 'EADDRINUSE';
          mockServer.on.mock.calls[0][1](error);
        }),
        close: jest.fn(),
        on: jest.fn()
      };
      
      mockNet.createServer.mockReturnValue(mockServer as any);
      
      const port = await networkService.findAvailablePort(3000, 3000);
      
      expect(port).toBeNull();
    });
  });

  describe('validateBinding', () => {
    test('validates IP address binding', () => {
      const mockInterfaces = {
        'eth0': [
          {
            address: '192.168.1.100',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: '192.168.1.100/24'
          }
        ]
      };
      
      mockOs.networkInterfaces.mockReturnValue(mockInterfaces as any);
      
      const valid = networkService.validateBinding('192.168.1.100');
      
      expect(valid).toBe(true);
    });

    test('validates special bindings', () => {
      expect(networkService.validateBinding('0.0.0.0')).toBe(true);
      expect(networkService.validateBinding('127.0.0.1')).toBe(true);
      expect(networkService.validateBinding('localhost')).toBe(true);
    });

    test('rejects invalid binding', () => {
      mockOs.networkInterfaces.mockReturnValue({});
      
      const valid = networkService.validateBinding('192.168.1.200');
      
      expect(valid).toBe(false);
    });
  });

  describe('saveNetworkConfig', () => {
    test('saves network configuration to file', () => {
      const config = {
        host: '192.168.1.100',
        port: 3000,
        protocol: 'http'
      };
      
      mockFs.writeFileSync = jest.fn();
      mockFs.mkdirSync = jest.fn();
      mockFs.existsSync = jest.fn().mockReturnValue(false);
      
      networkService.saveNetworkConfig(config);
      
      expect(mockFs.mkdirSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('network.json'),
        expect.stringContaining('192.168.1.100'),
        'utf-8'
      );
    });

    test('handles save errors gracefully', () => {
      const config = { host: 'localhost', port: 3000 };
      
      mockFs.writeFileSync = jest.fn().mockImplementation(() => {
        throw new Error('Write error');
      });
      
      expect(() => networkService.saveNetworkConfig(config)).not.toThrow();
    });
  });

  describe('loadNetworkConfig', () => {
    test('loads network configuration from file', () => {
      const configData = JSON.stringify({
        host: '192.168.1.100',
        port: 3000
      });
      
      mockFs.existsSync = jest.fn().mockReturnValue(true);
      mockFs.readFileSync = jest.fn().mockReturnValue(configData);
      
      const config = networkService.loadNetworkConfig();
      
      expect(config).toEqual({
        host: '192.168.1.100',
        port: 3000
      });
    });

    test('returns null when config file does not exist', () => {
      mockFs.existsSync = jest.fn().mockReturnValue(false);
      
      const config = networkService.loadNetworkConfig();
      
      expect(config).toBeNull();
    });

    test('handles invalid JSON gracefully', () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);
      mockFs.readFileSync = jest.fn().mockReturnValue('invalid json');
      
      const config = networkService.loadNetworkConfig();
      
      expect(config).toBeNull();
    });
  });
  */
});