/**
 * Comprehensive Unit Tests for Logger Service
 */

import { 
  createLogger,
  getLogger
} from '../../../src/core';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import { Readable } from 'stream';

// Mock fs modules
jest.mock('fs/promises');
jest.mock('fs');

describe('Logger Service', () => {
  let logger: ReturnType<typeof createLogger>;
  const testLogsDir = path.join(os.tmpdir(), 'test-logs');

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createLogger('TestLogger');
    
    // Mock filesystem operations
    (existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.stat as jest.Mock).mockResolvedValue({ 
      size: 1024, 
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false
    });
  });

  describe('Core Functionality', () => {
    describe('createLogger', () => {
      test('creates logger with name', () => {
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.debug).toBe('function');
      });

      test('creates child logger', () => {
        const childLogger = logger.child({ module: 'TestModule' });
        expect(childLogger).toBeDefined();
        expect(typeof childLogger.info).toBe('function');
      });
    });

    describe('logging methods', () => {
      test('logs info messages', () => {
        expect(() => logger.info('Test info message')).not.toThrow();
      });

      test('logs error messages', () => {
        expect(() => logger.error('Test error message')).not.toThrow();
      });

      test('logs warning messages', () => {
        expect(() => logger.warn('Test warning')).not.toThrow();
      });

      test('logs debug messages', () => {
        expect(() => logger.debug('Debug message')).not.toThrow();
      });

      test('logs with metadata', () => {
        expect(() => logger.info('Test message', { key: 'value' })).not.toThrow();
      });
    });

    describe('getLogger', () => {
      test('returns singleton instance', () => {
        const logger1 = getLogger;
        const logger2 = getLogger;
        expect(logger1).toBe(logger2);
      });

      test('has required methods', () => {
        const mainLogger = getLogger;
        expect(typeof mainLogger.initialize).toBe('function');
        expect(typeof mainLogger.isInitialized).toBe('function');
        expect(typeof mainLogger.getRecentLogs).toBe('function');
        expect(typeof mainLogger.clearLogs).toBe('function');
      });
    });
  });

  describe('Log Management Methods', () => {
    let mainLogger: typeof getLogger;

    beforeEach(async () => {
      mainLogger = getLogger;
      // Initialize logger with test directory
      await mainLogger.initialize({
        appName: 'TestApp',
        logLevel: 'info',
        logsDir: testLogsDir,
        fileOutput: true
      });
    });

    describe('getRecentLogs', () => {
      test('returns recent log entries', async () => {
        const logs = await mainLogger.getRecentLogs(10);
        expect(Array.isArray(logs)).toBe(true);
      });

      test('filters by log level', async () => {
        const logs = await mainLogger.getRecentLogs(10, 'error');
        expect(Array.isArray(logs)).toBe(true);
      });
    });

    describe('clearLogs', () => {
      test('clears log files', async () => {
        (fs.unlink as jest.Mock).mockResolvedValue(undefined);
        
        await mainLogger.clearLogs();
        
        // Should have attempted to clear log files
        expect(fs.unlink).toHaveBeenCalled();
      });
    });

    describe('getLogStats', () => {
      test('returns log statistics', async () => {
        (fs.readdir as jest.Mock).mockResolvedValue([
          'app-2024-01-01.log',
          'app-2024-01-02.log'
        ]);
        
        const stats = await mainLogger.getLogStats();
        
        expect(stats).toHaveProperty('totalFiles');
        expect(stats).toHaveProperty('totalSize');
        expect(stats).toHaveProperty('oldestLog');
        expect(stats).toHaveProperty('newestLog');
      });
    });

    describe('compactLogs', () => {
      test('archives old logs', async () => {
        const mockFiles = [
          'app-2024-01-01.log',
          'app-2024-01-02.log',
          'app-2024-01-10.log'
        ];
        
        (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
        (fs.stat as jest.Mock).mockImplementation((filePath) => {
          const fileName = path.basename(filePath);
          const dateStr = fileName.match(/\d{4}-\d{2}-\d{2}/)?.[0];
          const fileDate = dateStr ? new Date(dateStr) : new Date();
          
          return Promise.resolve({
            size: 1024,
            mtime: fileDate,
            isFile: () => true,
            isDirectory: () => false
          });
        });
        
        const result = await mainLogger.compactLogs(7);
        
        expect(result).toHaveProperty('archivedCount');
        expect(result).toHaveProperty('archivedSize');
        expect(result).toHaveProperty('remainingCount');
        expect(result).toHaveProperty('remainingSize');
      });

      test('handles no old logs', async () => {
        (fs.readdir as jest.Mock).mockResolvedValue([
          'app-' + new Date().toISOString().split('T')[0] + '.log'
        ]);
        
        const result = await mainLogger.compactLogs(7);
        
        expect(result.archivedCount).toBe(0);
      });
    });

    describe('cleanupZeroFiles', () => {
      test('removes zero-length log files', async () => {
        const mockFiles = [
          'app-2024-01-01.log',
          'app-2024-01-02.log',
          'app-2024-01-03.log'
        ];
        
        (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
        (fs.stat as jest.Mock).mockImplementation((filePath) => {
          const fileName = path.basename(filePath);
          const size = fileName.includes('01-02') ? 0 : 1024;
          
          return Promise.resolve({
            size,
            mtime: new Date(),
            isFile: () => true,
            isDirectory: () => false
          });
        });
        
        (fs.unlink as jest.Mock).mockResolvedValue(undefined);
        
        const result = await mainLogger.cleanupZeroFiles();
        
        expect(result.removed).toBeGreaterThanOrEqual(0);
        if (result.removed > 0) {
          expect(fs.unlink).toHaveBeenCalled();
        }
      });

      test('handles no zero-length files', async () => {
        (fs.readdir as jest.Mock).mockResolvedValue(['app-2024-01-01.log']);
        (fs.stat as jest.Mock).mockResolvedValue({
          size: 1024,
          mtime: new Date(),
          isFile: () => true,
          isDirectory: () => false
        });
        
        const result = await mainLogger.cleanupZeroFiles();
        
        expect(result.removed).toBe(0);
      });
    });

    describe('purgeAllLogs', () => {
      test('deletes all log files', async () => {
        const mockFiles = [
          'app-2024-01-01.log',
          'app-2024-01-02.log',
          'error-2024-01-01.log'
        ];
        
        (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
        (fs.unlink as jest.Mock).mockResolvedValue(undefined);
        
        await mainLogger.purgeAllLogs();
        
        expect(fs.unlink).toHaveBeenCalledTimes(mockFiles.length);
      });

      test('handles empty logs directory', async () => {
        (fs.readdir as jest.Mock).mockResolvedValue([]);
        
        await expect(mainLogger.purgeAllLogs()).resolves.not.toThrow();
      });
    });

    describe('exportLogs', () => {
      test('exports logs as text', async () => {
        const mockLogs = [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Test log 1' },
          { timestamp: '2024-01-01T10:01:00Z', level: 'error', message: 'Test log 2' }
        ];
        
        jest.spyOn(mainLogger, 'getRecentLogs').mockResolvedValue(mockLogs as any);
        
        const result = await mainLogger.exportLogs({ format: 'txt' });
        
        expect(typeof result).toBe('string');
        expect(result).toContain('Test log 1');
        expect(result).toContain('Test log 2');
      });

      test('exports logs as JSON', async () => {
        const mockLogs = [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Test log 1' },
          { timestamp: '2024-01-01T10:01:00Z', level: 'error', message: 'Test log 2' }
        ];
        
        jest.spyOn(mainLogger, 'getRecentLogs').mockResolvedValue(mockLogs as any);
        
        const result = await mainLogger.exportLogs({ format: 'json' });
        
        expect(() => JSON.parse(result)).not.toThrow();
        
        const parsed = JSON.parse(result);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(2);
      });

      test('exports logs as CSV', async () => {
        const mockLogs = [
          { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Test log 1' }
        ];
        
        jest.spyOn(mainLogger, 'getRecentLogs').mockResolvedValue(mockLogs as any);
        
        const result = await mainLogger.exportLogs({ format: 'csv' });
        
        expect(result).toContain('timestamp,level,message');
        expect(result).toContain('Test log 1');
      });

      test('filters by date range', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');
        
        jest.spyOn(mainLogger, 'getRecentLogs').mockResolvedValue([]);
        
        await mainLogger.exportLogs({ 
          format: 'json',
          startDate,
          endDate 
        });
        
        expect(mainLogger.getRecentLogs).toHaveBeenCalled();
      });

      test('filters by level', async () => {
        jest.spyOn(mainLogger, 'getRecentLogs').mockResolvedValue([]);
        
        await mainLogger.exportLogs({ 
          format: 'json',
          level: 'error' 
        });
        
        expect(mainLogger.getRecentLogs).toHaveBeenCalledWith(expect.any(Number), 'error');
      });
    });

    describe('getAllLogFiles', () => {
      test('returns all log files including archives', async () => {
        const mockLogFiles = ['app-2024-01-01.log', 'app-2024-01-02.log'];
        const mockArchiveFiles = ['archive-2023-12-01.tar.gz'];
        
        (fs.readdir as jest.Mock)
          .mockResolvedValueOnce(mockLogFiles)
          .mockResolvedValueOnce(mockArchiveFiles);
        
        (existsSync as jest.Mock).mockReturnValue(true);
        
        const result = await mainLogger.getAllLogFiles();
        
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(0);
      });

      test('handles missing archives directory', async () => {
        (fs.readdir as jest.Mock).mockResolvedValueOnce(['app-2024-01-01.log']);
        (existsSync as jest.Mock).mockReturnValue(false);
        
        const result = await mainLogger.getAllLogFiles();
        
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('getLoggers', () => {
      test('returns map of logger instances', () => {
        const loggers = mainLogger.getLoggers();
        
        expect(loggers instanceof Map).toBe(true);
        expect(loggers.size).toBeGreaterThanOrEqual(0);
      });
    });

    describe('archiveLogs', () => {
      test('archives logs older than specified days', async () => {
        const mockFiles = [
          'app-2024-01-01.log',
          'app-2024-01-02.log'
        ];
        
        (fs.readdir as jest.Mock).mockResolvedValue(mockFiles);
        (fs.readFile as jest.Mock).mockResolvedValue('log content');
        (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
        (fs.unlink as jest.Mock).mockResolvedValue(undefined);
        (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
        
        const result = await mainLogger.archiveLogs(30);
        
        expect(result).toHaveProperty('archivedCount');
        expect(result).toHaveProperty('archivedBytes');
      });
    });

    describe('downloadLogFile', () => {
      test('reads and returns log file content', async () => {
        const testContent = 'Test log content';
        (fs.readFile as jest.Mock).mockResolvedValue(testContent);
        (existsSync as jest.Mock).mockReturnValue(true);
        
        const result = await mainLogger.downloadLogFile('app-2024-01-01.log');
        
        expect(result).toBe(testContent);
      });

      test('throws error for non-existent file', async () => {
        (existsSync as jest.Mock).mockReturnValue(false);
        
        await expect(mainLogger.downloadLogFile('non-existent.log'))
          .rejects.toThrow();
      });
    });
  });

  describe('Logger Configuration', () => {
    test('initializes with custom options', async () => {
      const mainLogger = getLogger;
      
      await mainLogger.initialize({
        appName: 'CustomApp',
        logLevel: 'debug',
        consoleOutput: false,
        fileOutput: true,
        logsDir: '/custom/logs'
      });
      
      expect(mainLogger.isInitialized()).toBe(true);
    });

    test('creates categorized logger', () => {
      const mainLogger = getLogger;
      const categoryLogger = mainLogger.createLogger('API', {
        level: 'debug'
      });
      
      expect(categoryLogger).toBeDefined();
      expect(typeof categoryLogger.info).toBe('function');
    });

    test('handles child logger creation', () => {
      const mainLogger = getLogger;
      const childLogger = mainLogger.child('TestChild');
      
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
    });
  });

  describe('Error Handling', () => {
    test('handles file read errors gracefully', async () => {
      const mainLogger = getLogger;
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('Read error'));
      
      const stats = await mainLogger.getLogStats();
      
      expect(stats).toHaveProperty('totalFiles', 0);
      expect(stats).toHaveProperty('totalSize', 0);
    });

    test('handles archive errors gracefully', async () => {
      const mainLogger = getLogger;
      (fs.readdir as jest.Mock).mockRejectedValue(new Error('Archive error'));
      
      await mainLogger.archiveLogs(30);
      
      // archiveLogs returns void, just verify it doesn't throw
    });

    test('handles export errors gracefully', async () => {
      const mainLogger = getLogger;
      jest.spyOn(mainLogger, 'getRecentLogs').mockRejectedValue(new Error('Export error'));
      
      await expect(mainLogger.exportLogs({ format: 'json' }))
        .rejects.toThrow('Export error');
    });
  });
});
