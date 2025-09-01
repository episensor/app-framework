/**
 * Unit tests for Enhanced Logger
 */

import { 
  createLogger,
  getEnhancedLogger
} from '../../../src/core';

describe('Enhanced Logger', () => {
  let logger: ReturnType<typeof createLogger>;

  beforeEach(() => {
    logger = createLogger('TestLogger');
  });

  describe('createLogger', () => {
    test('creates logger with name', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
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
  });

  describe('getEnhancedLogger', () => {
    test('returns singleton instance', () => {
      const logger1 = getEnhancedLogger();
      const logger2 = getEnhancedLogger();
      expect(logger1).toBe(logger2);
    });
  });
});