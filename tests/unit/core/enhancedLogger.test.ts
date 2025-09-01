/**
 * Unit tests for Enhanced Logger
 */

import { 
  initializeLogger, 
  getEnhancedLogger 
} from '../../../src/core/enhancedLogger';
import winston from 'winston';
import fs from 'fs/promises';

// Mock dependencies
jest.mock('winston', () => ({
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    splat: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  },
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
    verbose: jest.fn(),
    silly: jest.fn(),
    add: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn()
  })),
  addColors: jest.fn()
}));

jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn()
  }));
});

jest.mock('fs/promises');

describe('Enhanced Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Mock fs methods
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (fs.stat as jest.Mock).mockResolvedValue({ 
      size: 1024, 
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false
    });
  });
  
  describe('initializeLogger', () => {
    test('initializes logger successfully', async () => {
      await initializeLogger();
      
      // The logger should be initialized without errors
      const logger = getEnhancedLogger();
      expect(logger).toBeDefined();
    });
    
    test('creates log directories without errors', async () => {
      // Just ensure it runs without throwing
      await expect(initializeLogger()).resolves.toBeUndefined();
    });
  });
  
  describe('getEnhancedLogger', () => {
    test('returns the logger instance', async () => {
      await initializeLogger();
      const logger = getEnhancedLogger();
      
      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('initialize');
      expect(logger).toHaveProperty('createLogger');
    });
    
    test('returns singleton instance', () => {
      const logger1 = getEnhancedLogger();
      const logger2 = getEnhancedLogger();
      
      expect(logger1).toBe(logger2);
    });
  });
  
  describe('createLogger', () => {
    test('creates a logger with specified category', async () => {
      const enhancedLogger = getEnhancedLogger();
      await enhancedLogger.initialize();
      
      const logger = enhancedLogger.createLogger('test-category');
      
      expect(winston.createLogger).toHaveBeenCalled();
      expect(logger).toBeDefined();
    });
    
    test('returns cached logger for same category', async () => {
      const enhancedLogger = getEnhancedLogger();
      await enhancedLogger.initialize();
      
      const logger1 = enhancedLogger.createLogger('test');
      const logger2 = enhancedLogger.createLogger('test');
      
      expect(logger1).toBe(logger2);
    });
  });
  
  describe('log stats', () => {
    test('getLogStats returns statistics', async () => {
      const enhancedLogger = getEnhancedLogger();
      await enhancedLogger.initialize();
      
      (fs.readdir as jest.Mock).mockResolvedValue(['system', 'api']);
      (fs.stat as jest.Mock).mockResolvedValue({
        isDirectory: () => true,
        isFile: () => false,
        size: 1024,
        mtime: new Date()
      });
      
      const stats = await enhancedLogger.getLogStats();
      
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('fileCount');
      expect(stats).toHaveProperty('categories');
    });
  });
  
  describe('archiveLogs', () => {
    test('archives old log files', async () => {
      const enhancedLogger = getEnhancedLogger();
      await enhancedLogger.initialize();
      
      // Mock all fs operations to prevent real file access
      (fs.readdir as jest.Mock).mockResolvedValue([]);
      
      const archived = await enhancedLogger.archiveLogs(7);
      
      expect(archived).toBeInstanceOf(Array);
      expect(archived).toEqual([]);
    });
  });
  
  describe('readLogFile', () => {
    test('reads log file content', async () => {
      const enhancedLogger = getEnhancedLogger();
      await enhancedLogger.initialize();
      
      const mockContent = 'log line 1\nlog line 2\nlog line 3';
      (fs.readFile as jest.Mock).mockResolvedValue(mockContent);
      
      const content = await enhancedLogger.readLogFile('system', 'test.log');
      
      expect(fs.readFile).toHaveBeenCalled();
      expect(content).toBeDefined();
    });
    
    test('applies tail option', async () => {
      const enhancedLogger = getEnhancedLogger();
      await enhancedLogger.initialize();
      
      const mockContent = 'line1\nline2\nline3\nline4\nline5';
      (fs.readFile as jest.Mock).mockResolvedValue(mockContent);
      
      const content = await enhancedLogger.readLogFile('system', 'test.log', { tail: 2 });
      
      expect(content).toBeDefined();
    });
  });
  
  describe('error handling', () => {
    test('handles directory creation errors gracefully', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
      
      // Should not throw
      await expect(initializeLogger()).resolves.toBeUndefined();
    });
    
    test('handles missing log files gracefully', async () => {
      const enhancedLogger = getEnhancedLogger();
      await enhancedLogger.initialize();
      
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      await expect(
        enhancedLogger.readLogFile('system', 'missing.log')
      ).rejects.toThrow('Failed to read log file');
    });
  });
});