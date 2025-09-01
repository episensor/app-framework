/**
 * Unit tests for Startup Banner utility
 */

import { displayStartupBanner, StartupBannerOptions } from '../../../src/utils/startupBanner';
import * as fs from 'fs';
import chalk from 'chalk';

// Mock dependencies
jest.mock('fs');
jest.mock('chalk', () => {
  const chainableMock = {
    cyan: jest.fn((text) => text),
    green: jest.fn((text) => text),
    yellow: jest.fn((text) => text),
    blue: jest.fn((text) => text),
    red: jest.fn((text) => text),
    gray: jest.fn((text) => text),
    white: jest.fn((text) => text),
    bold: {
      cyan: jest.fn((text) => text),
      green: jest.fn((text) => text),
      yellow: jest.fn((text) => text),
      blue: jest.fn((text) => text),
      red: jest.fn((text) => text),
      gray: jest.fn((text) => text),
      white: jest.fn((text) => text)
    },
    dim: jest.fn((text) => text),
    level: 3
  };
  return {
    default: chainableMock,
    ...chainableMock
  };
});

// Mock console.log
const originalConsoleLog = console.log;
const consoleLogSpy = jest.fn();

describe('displayStartupBanner', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = consoleLogSpy;
    
    // Default mocks
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue('{}');
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('basic banner display', () => {
    test('displays banner with app name and version', () => {
      const options: StartupBannerOptions = {
        appName: 'Test App',
        appVersion: '1.0.0',
        port: 8080
      };
      
      displayStartupBanner(options);
      
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('Test App');
      expect(output).toContain('1.0.0');
      expect(output).toContain('8080');
    });

    test('displays banner with description', () => {
      const options: StartupBannerOptions = {
        appName: 'Test App',
        appVersion: '1.0.0',
        description: 'A test application',
        port: 8080
      };
      
      displayStartupBanner(options);
      
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('A test application');
    });

    test('displays banner with web port', () => {
      const options: StartupBannerOptions = {
        appName: 'Test App',
        appVersion: '1.0.0',
        port: 8080,
        webPort: 3000
      };
      
      displayStartupBanner(options);
      
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('8080');
      expect(output).toContain('3000');
    });

    test('displays banner with environment', () => {
      const options: StartupBannerOptions = {
        appName: 'Test App',
        appVersion: '1.0.0',
        port: 8080,
        environment: 'production'
      };
      
      displayStartupBanner(options);
      
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('production');
    });

    test('displays banner with startup time', () => {
      const options: StartupBannerOptions = {
        appName: 'Test App',
        appVersion: '1.0.0',
        port: 8080,
        startTime: 1500
      };
      
      displayStartupBanner(options);
      
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('1.5s');
    });

    test('uses default environment when not specified', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      const options: StartupBannerOptions = {
        appName: 'Test App',
        appVersion: '1.0.0',
        port: 8080
      };
      
      displayStartupBanner(options);
      
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('test');
      
      process.env.NODE_ENV = originalEnv;
    });

    test('handles missing NODE_ENV', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      
      const options: StartupBannerOptions = {
        appName: 'Test App',
        appVersion: '1.0.0',
        port: 8080
      };
      
      displayStartupBanner(options);
      
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('development'); // Default value
      
      process.env.NODE_ENV = originalEnv;
    });

    test('displays complete banner with all options', () => {
      const options: StartupBannerOptions = {
        appName: 'Complete Test App',
        appVersion: '2.5.0',
        description: 'Full featured test application',
        port: 8080,
        webPort: 3000,
        environment: 'staging',
        startTime: 2500
      };
      
      displayStartupBanner(options);
      
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('Complete Test App');
      expect(output).toContain('2.5.0');
      expect(output).toContain('Full featured test application');
      expect(output).toContain('8080');
      expect(output).toContain('3000');
      expect(output).toContain('staging');
      expect(output).toContain('2.5s');
    });
  });

  describe('package.json reading', () => {
    test('reads version from package.json when available', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        version: '3.0.0'
      }));
      
      const options: StartupBannerOptions = {
        appName: 'Test App',
        appVersion: '1.0.0',
        port: 8080
      };
      
      displayStartupBanner(options);
      
      expect(mockFs.existsSync).toHaveBeenCalled();
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    test('handles invalid package.json gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json');
      
      const options: StartupBannerOptions = {
        appName: 'Test App',
        appVersion: '1.0.0',
        port: 8080
      };
      
      expect(() => displayStartupBanner(options)).not.toThrow();
    });
  });
});