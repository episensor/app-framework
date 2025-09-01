/**
 * Unit tests for health middleware
 */

import { Request, Response } from 'express';
import {
  createHealthCheck,
  healthCheck,
  HealthCheckOptions,
  ComponentHealth
} from '../../../src/middleware/health';

// Mock os module
jest.mock('os', () => ({
  totalmem: jest.fn(() => 8 * 1024 * 1024 * 1024), // 8GB
  freemem: jest.fn(() => 4 * 1024 * 1024 * 1024), // 4GB free
  cpus: jest.fn(() => [
    { times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } },
    { times: { user: 100, nice: 0, sys: 50, idle: 850, irq: 0 } }
  ]),
  loadavg: jest.fn(() => [1.5, 2.0, 1.8])
}));

// Mock Express Router
const mockRouter = {
  get: jest.fn()
};

jest.mock('express', () => ({
  Router: jest.fn(() => mockRouter)
}));

describe('Health Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {};
    
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    
    mockRes = {
      json: jsonMock,
      status: statusMock
    };
  });

  describe('healthCheck', () => {
    test('returns healthy status', () => {
      healthCheck(mockReq as Request, mockRes as Response);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('createHealthCheck', () => {
    test('creates health check router with default options', () => {
      const router = createHealthCheck();
      
      expect(router).toBe(mockRouter);
      expect(mockRouter.get).toHaveBeenCalledWith('/health', expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith('/health/ready', expect.any(Function));
      expect(mockRouter.get).toHaveBeenCalledWith('/health/live', expect.any(Function));
    });

    test('creates health check with custom options', () => {
      const options: HealthCheckOptions = {
        includeDetails: true,
        version: '1.0.0',
        serviceName: 'test-service'
      };
      
      const router = createHealthCheck(options);
      
      expect(router).toBe(mockRouter);
      expect(mockRouter.get).toHaveBeenCalledTimes(3);
    });

    test('health endpoint returns detailed response when includeDetails is true', () => {
      const options: HealthCheckOptions = {
        includeDetails: true,
        version: '1.2.3',
        serviceName: 'my-service'
      };
      
      createHealthCheck(options);
      
      // Get the health handler
      const healthHandler = mockRouter.get.mock.calls[0][1];
      
      // Call the handler
      healthHandler(mockReq, mockRes);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          version: '1.2.3',
          service: 'my-service',
          uptime: expect.any(Number),
          resources: expect.objectContaining({
            memory: expect.objectContaining({
              used: expect.any(Number),
              total: expect.any(Number),
              percentage: expect.any(Number)
            }),
            cpu: expect.objectContaining({
              usage: expect.any(Number),
              cores: 2
            })
          })
        })
      );
    });

    test('health endpoint returns basic response when includeDetails is false', () => {
      const options: HealthCheckOptions = {
        includeDetails: false
      };
      
      createHealthCheck(options);
      
      const healthHandler = mockRouter.get.mock.calls[0][1];
      healthHandler(mockReq, mockRes);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          version: expect.any(String)
        })
      );
      
      const response = jsonMock.mock.calls[0][0];
      expect(response.resources).toBeUndefined();
    });

    test('health endpoint checks components when provided', async () => {
      const checkComponents = jest.fn().mockResolvedValue({
        database: {
          status: 'healthy',
          message: 'Connected',
          latency: 5
        },
        cache: {
          status: 'degraded',
          message: 'High latency',
          latency: 150
        }
      } as ComponentHealth);
      
      const options: HealthCheckOptions = {
        includeDetails: true,
        checkComponents
      };
      
      createHealthCheck(options);
      
      const healthHandler = mockRouter.get.mock.calls[0][1];
      await healthHandler(mockReq, mockRes);
      
      expect(checkComponents).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded', // Should be degraded due to cache
          components: {
            database: {
              status: 'healthy',
              message: 'Connected',
              latency: 5
            },
            cache: {
              status: 'degraded',
              message: 'High latency',
              latency: 150
            }
          }
        })
      );
    });

    test('health endpoint returns unhealthy when component is unhealthy', async () => {
      const checkComponents = jest.fn().mockResolvedValue({
        database: {
          status: 'unhealthy',
          message: 'Connection failed'
        }
      } as ComponentHealth);
      
      const options: HealthCheckOptions = {
        checkComponents
      };
      
      createHealthCheck(options);
      
      const healthHandler = mockRouter.get.mock.calls[0][1];
      await healthHandler(mockReq, mockRes);
      
      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy'
        })
      );
    });

    test('health endpoint handles component check errors', async () => {
      const checkComponents = jest.fn().mockRejectedValue(new Error('Check failed'));
      
      const options: HealthCheckOptions = {
        checkComponents
      };
      
      createHealthCheck(options);
      
      const healthHandler = mockRouter.get.mock.calls[0][1];
      await healthHandler(mockReq, mockRes);
      
      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          error: 'Check failed'
        })
      );
    });

    test('ready endpoint returns 200 when healthy', () => {
      createHealthCheck();
      
      const readyHandler = mockRouter.get.mock.calls[1][1];
      readyHandler(mockReq, mockRes);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ready: true
        })
      );
    });

    test('ready endpoint checks components for readiness', async () => {
      const checkComponents = jest.fn().mockResolvedValue({
        database: {
          status: 'healthy'
        }
      } as ComponentHealth);
      
      const options: HealthCheckOptions = {
        checkComponents
      };
      
      createHealthCheck(options);
      
      const readyHandler = mockRouter.get.mock.calls[1][1];
      await readyHandler(mockReq, mockRes);
      
      expect(checkComponents).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ready: true
        })
      );
    });

    test('ready endpoint returns 503 when not ready', async () => {
      const checkComponents = jest.fn().mockResolvedValue({
        database: {
          status: 'unhealthy'
        }
      } as ComponentHealth);
      
      const options: HealthCheckOptions = {
        checkComponents
      };
      
      createHealthCheck(options);
      
      const readyHandler = mockRouter.get.mock.calls[1][1];
      await readyHandler(mockReq, mockRes);
      
      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ready: false,
          status: 'unhealthy'
        })
      );
    });

    test('live endpoint returns 200 for liveness', () => {
      createHealthCheck();
      
      const liveHandler = mockRouter.get.mock.calls[2][1];
      liveHandler(mockReq, mockRes);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          alive: true
        })
      );
    });

    test('returns correct version when not provided', () => {
      // Clear npm_package_version to test default
      const originalVersion = process.env.npm_package_version;
      delete process.env.npm_package_version;
      
      createHealthCheck();
      
      const healthHandler = mockRouter.get.mock.calls[0][1];
      healthHandler(mockReq, mockRes);
      
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          version: expect.any(String) // Either '1.0.0' or actual package version
        })
      );
      
      // Restore original version
      if (originalVersion) {
        process.env.npm_package_version = originalVersion;
      }
    });

    test('calculates correct memory percentage', () => {
      const options: HealthCheckOptions = {
        includeDetails: true
      };
      
      createHealthCheck(options);
      
      const healthHandler = mockRouter.get.mock.calls[0][1];
      healthHandler(mockReq, mockRes);
      
      const response = jsonMock.mock.calls[0][0];
      expect(response.resources.memory.percentage).toBe(50); // 4GB used of 8GB total
    });

    test('calculates CPU usage correctly', () => {
      const options: HealthCheckOptions = {
        includeDetails: true
      };
      
      createHealthCheck(options);
      
      const healthHandler = mockRouter.get.mock.calls[0][1];
      healthHandler(mockReq, mockRes);
      
      const response = jsonMock.mock.calls[0][0];
      expect(response.resources.cpu.usage).toBeGreaterThan(0);
      expect(response.resources.cpu.usage).toBeLessThanOrEqual(100);
    });
  });
});