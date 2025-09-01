/**
 * Unit tests for Validation Middleware
 */

import { validate, validateParams, validateQuery, z } from '../../../src/middleware/validation';
import type { Request, Response, NextFunction } from 'express';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('validate (body)', () => {
    test('passes valid request body', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0)
      });

      mockReq.body = { name: 'Test', age: 25 };
      const middleware = validate(schema);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('rejects invalid request body', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0)
      });

      mockReq.body = { age: -5 }; // Missing name, invalid age
      const middleware = validate(schema);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errors: expect.any(Array)
        })
      );
    });

    test('strips unknown properties', () => {
      const schema = z.object({
        name: z.string()
      });

      mockReq.body = { name: 'Test', unknown: 'value' };
      const middleware = validate(schema);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).toEqual({ name: 'Test' });
    });
  });

  describe('validateParams', () => {
    test('validates request params', () => {
      const schema = z.object({
        id: z.string().uuid()
      });

      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const middleware = validateParams(schema);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    test('rejects invalid params', () => {
      const schema = z.object({
        id: z.string().uuid()
      });

      mockReq.params = { id: 'not-a-uuid' };
      const middleware = validateParams(schema);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateQuery', () => {
    test('validates query parameters', () => {
      const schema = z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(10)
      });

      mockReq.query = { page: '2', limit: '20' };
      const middleware = validateQuery(schema);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({ page: 2, limit: 20 }); // Parsed to numbers
    });

    test('applies defaults for missing query params', () => {
      const schema = z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(10)
      });

      mockReq.query = {};
      const middleware = validateQuery(schema);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({ page: 1, limit: 10 });
    });

    test('rejects invalid query params', () => {
      const schema = z.object({
        page: z.coerce.number().min(1),
        limit: z.coerce.number().min(1).max(100)
      });

      mockReq.query = { page: '0', limit: '200' };
      const middleware = validateQuery(schema);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('error formatting', () => {
    test('formats validation errors correctly', () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8)
      });

      mockReq.body = { email: 'invalid', password: '123' };
      const middleware = validate(schema);
      
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation failed',
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: 'email',
              message: expect.stringContaining('email')
            }),
            expect.objectContaining({
              field: 'password',
              message: expect.stringContaining('8')
            })
          ])
        })
      );
    });
  });
});
