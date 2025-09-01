import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDynamicCors, createProductionCors, createDevCors } from '../../src/middleware/cors';

describe('Dynamic CORS Middleware', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('createDynamicCors', () => {
    it('should allow localhost origins in development', async () => {
      process.env.NODE_ENV = 'development';
      const middleware = createDynamicCors();
      
      // Get the origin function attached for testing
      const originFunction = (middleware as any)._originFunction;
      expect(originFunction).toBeDefined();
      
      // Simulate CORS check for localhost
      const result = await new Promise((resolve) => {
        originFunction('http://localhost:3000', (err: any, allow: any) => {
          resolve({ err, allow });
        });
      });
      
      expect((result as any).err).toBeNull();
      expect((result as any).allow).toBe(true);
    });

    it('should allow configured origins in production', async () => {
      process.env.NODE_ENV = 'production';
      const middleware = createDynamicCors({
        allowedOrigins: ['https://app.example.com']
      });
      
      const originFunction = (middleware as any)._originFunction;
      expect(originFunction).toBeDefined();
      
      const result = await new Promise((resolve) => {
        originFunction('https://app.example.com', (err: any, allow: any) => {
          resolve({ err, allow });
        });
      });
      
      expect((result as any).err).toBeNull();
      expect((result as any).allow).toBe(true);
    });

    it('should reject unknown origins in production', async () => {
      process.env.NODE_ENV = 'production';
      const middleware = createDynamicCors({
        allowedOrigins: ['https://app.example.com']
      });
      
      const originFunction = (middleware as any)._originFunction;
      expect(originFunction).toBeDefined();
      
      const result = await new Promise((resolve) => {
        originFunction('https://evil.com', (err: any, allow: any) => {
          resolve({ err, allow });
        });
      });
      
      expect((result as any).err).toBeInstanceOf(Error);
      expect((result as any).err.message).toBe('Not allowed by CORS');
    });

    it('should allow origins in specified port ranges', async () => {
      process.env.NODE_ENV = 'development';
      const middleware = createDynamicCors({
        devPortRanges: [{ start: 5000, end: 5005 }]
      });
      
      const originFunction = (middleware as any)._originFunction;
      expect(originFunction).toBeDefined();
      
      const result = await new Promise((resolve) => {
        originFunction('http://localhost:5003', (err: any, allow: any) => {
          resolve({ err, allow });
        });
      });
      
      expect((result as any).err).toBeNull();
      expect((result as any).allow).toBe(true);
    });

    it('should use custom validator when provided', async () => {
      process.env.NODE_ENV = 'production';
      const middleware = createDynamicCors({
        customValidator: (origin) => origin.endsWith('.trusted.com')
      });
      
      const originFunction = (middleware as any)._originFunction;
      expect(originFunction).toBeDefined();
      
      const result = await new Promise((resolve) => {
        originFunction('https://app.trusted.com', (err: any, allow: any) => {
          resolve({ err, allow });
        });
      });
      
      expect((result as any).err).toBeNull();
      expect((result as any).allow).toBe(true);
    });

    it('should allow requests with no origin', async () => {
      const middleware = createDynamicCors();
      const originFunction = (middleware as any)._originFunction;
      expect(originFunction).toBeDefined();
      
      const result = await new Promise((resolve) => {
        originFunction(undefined, (err: any, allow: any) => {
          resolve({ err, allow });
        });
      });
      
      expect((result as any).err).toBeNull();
      expect((result as any).allow).toBe(true);
    });
  });

  describe('createProductionCors', () => {
    it('should only allow specified domains', async () => {
      const middleware = createProductionCors(['https://app.example.com']);
      const originFunction = (middleware as any)._originFunction;
      expect(originFunction).toBeDefined();
      
      const result = await new Promise((resolve) => {
        originFunction('https://app.example.com', (err: any, allow: any) => {
          resolve({ err, allow });
        });
      });
      
      expect((result as any).err).toBeNull();
      expect((result as any).allow).toBe(true);
    });

    it('should reject non-specified domains', async () => {
      const middleware = createProductionCors(['https://app.example.com']);
      const originFunction = (middleware as any)._originFunction;
      expect(originFunction).toBeDefined();
      
      const result = await new Promise((resolve) => {
        originFunction('https://other.com', (err: any, allow: any) => {
          resolve({ err, allow });
        });
      });
      
      expect((result as any).err).toBeInstanceOf(Error);
    });
  });

  describe('createDevCors', () => {
    it('should be permissive in development', async () => {
      process.env.NODE_ENV = 'development';
      const middleware = createDevCors();
      const originFunction = (middleware as any)._originFunction;
      expect(originFunction).toBeDefined();
      
      const result = await new Promise((resolve) => {
        originFunction('http://localhost:9999', (err: any, allow: any) => {
          resolve({ err, allow });
        });
      });
      
      expect((result as any).err).toBeNull();
      expect((result as any).allow).toBe(true);
    });
  });
});