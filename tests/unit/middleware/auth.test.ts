/**
 * Unit tests for authentication middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
  createAuthMiddleware,
  createLoginHandler,
  createLogoutHandler,
  createAuthCheckHandler,
  requireRole,
  SimpleAuthService,
  AuthConfig,
  AuthService
} from '../../../src/middleware/auth';

// Mock logger
jest.mock('../../../src/core', () => ({
  ...jest.requireActual('../../../src/core'),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('Authentication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let redirectMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      path: '/api/test',
      body: {},
      session: {
        authenticated: false,
        username: undefined,
        userId: undefined,
        roles: undefined,
        destroy: jest.fn(callback => callback(null))
      } as any
    };
    
    // Make path writable for tests
    Object.defineProperty(mockReq, 'path', {
      writable: true,
      value: '/api/test'
    });
    
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    redirectMock = jest.fn();
    
    mockRes = {
      json: jsonMock,
      status: statusMock,
      redirect: redirectMock
    };
    
    mockNext = jest.fn();
  });

  describe('createAuthMiddleware', () => {
    test('allows authenticated users', () => {
      const middleware = createAuthMiddleware();
      mockReq.session!.authenticated = true;
      mockReq.session!.username = 'testuser';
      mockReq.session!.userId = 'user-1';
      mockReq.session!.roles = ['user'];

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({
        id: 'user-1',
        username: 'testuser',
        roles: ['user']
      });
    });

    test('blocks unauthenticated users for API routes', () => {
      const middleware = createAuthMiddleware();
      const testReq = { ...mockReq, path: '/api/protected' };

      middleware(testReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    });

    test('redirects unauthenticated users for web routes', () => {
      const middleware = createAuthMiddleware();
      const testReq = { ...mockReq, path: '/dashboard' };

      middleware(testReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(redirectMock).toHaveBeenCalledWith('/login');
    });

    test('allows access to excluded paths', () => {
      const config: AuthConfig = {
        excludePaths: ['/public', '/auth']
      };
      const middleware = createAuthMiddleware(config);
      const testReq = { ...mockReq, path: '/public/resource' };

      middleware(testReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    test('uses custom login path', () => {
      const config: AuthConfig = {
        loginPath: '/auth/signin'
      };
      const middleware = createAuthMiddleware(config);
      const testReq = { ...mockReq, path: '/protected' };

      middleware(testReq as Request, mockRes as Response, mockNext);

      expect(redirectMock).toHaveBeenCalledWith('/auth/signin');
    });

    test('uses custom API prefix', () => {
      const config: AuthConfig = {
        apiPrefix: '/v1/'
      };
      const middleware = createAuthMiddleware(config);
      const testReq = { ...mockReq, path: '/v1/users' };

      middleware(testReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalled();
    });

    test('calls custom unauthorized handler', () => {
      const onUnauthorized = jest.fn();
      const config: AuthConfig = {
        onUnauthorized
      };
      const middleware = createAuthMiddleware(config);

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(onUnauthorized).toHaveBeenCalledWith(mockReq, mockRes);
      expect(statusMock).not.toHaveBeenCalled();
      expect(redirectMock).not.toHaveBeenCalled();
    });

    test('handles missing session gracefully', () => {
      const middleware = createAuthMiddleware();
      const testReq = { ...mockReq, session: undefined as any, path: '/api/test' };

      middleware(testReq as unknown as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalled();
    });
  });

  describe('createLoginHandler', () => {
    let authService: AuthService;
    let loginHandler: ReturnType<typeof createLoginHandler>;

    beforeEach(() => {
      authService = {
        validateCredentials: jest.fn()
      };
      loginHandler = createLoginHandler(authService);
    });

    test('logs in user with valid credentials', async () => {
      mockReq.body = {
        username: 'testuser',
        password: 'testpass'
      };

      (authService.validateCredentials as jest.Mock).mockResolvedValue({
        valid: true,
        user: {
          id: 'user-1',
          username: 'testuser',
          roles: ['user']
        }
      });

      await loginHandler(mockReq as Request, mockRes as Response);

      expect(authService.validateCredentials).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'testpass'
      });

      expect(mockReq.session!.authenticated).toBe(true);
      expect(mockReq.session!.username).toBe('testuser');
      expect(mockReq.session!.userId).toBe('user-1');
      expect(mockReq.session!.roles).toEqual(['user']);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        user: {
          username: 'testuser',
          roles: ['user']
        }
      });
    });

    test('rejects invalid credentials', async () => {
      mockReq.body = {
        username: 'testuser',
        password: 'wrongpass'
      };

      (authService.validateCredentials as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Invalid password'
      });

      await loginHandler(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid credentials',
        message: 'Invalid password'
      });
      expect(mockReq.session!.authenticated).toBe(false);
    });

    test('handles missing username', async () => {
      mockReq.body = {
        password: 'testpass'
      };

      await loginHandler(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
      expect(authService.validateCredentials).not.toHaveBeenCalled();
    });

    test('handles missing password', async () => {
      mockReq.body = {
        username: 'testuser'
      };

      await loginHandler(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    });

    test('handles service errors', async () => {
      mockReq.body = {
        username: 'testuser',
        password: 'testpass'
      };

      (authService.validateCredentials as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await loginHandler(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Login failed',
        message: 'An error occurred during login'
      });
    });
  });

  describe('createLogoutHandler', () => {
    let logoutHandler: ReturnType<typeof createLogoutHandler>;

    beforeEach(() => {
      logoutHandler = createLogoutHandler();
    });

    test('logs out authenticated user', () => {
      mockReq.session!.authenticated = true;
      mockReq.session!.username = 'testuser';

      logoutHandler(mockReq as Request, mockRes as Response);

      expect(mockReq.session!.destroy).toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({ success: true });
    });

    test('handles session destroy errors', () => {
      const destroyMock = jest.fn(callback => callback(new Error('Session error')));
      mockReq.session!.destroy = destroyMock as any;

      logoutHandler(mockReq as Request, mockRes as Response);

      expect(destroyMock).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Logout failed'
      });
    });

    test('handles logout without username', () => {
      mockReq.session!.authenticated = true;
      mockReq.session!.username = undefined;

      logoutHandler(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('createAuthCheckHandler', () => {
    let authCheckHandler: ReturnType<typeof createAuthCheckHandler>;

    beforeEach(() => {
      authCheckHandler = createAuthCheckHandler();
    });

    test('returns authenticated status', () => {
      mockReq.session!.authenticated = true;
      mockReq.session!.username = 'testuser';
      mockReq.session!.roles = ['admin'];

      authCheckHandler(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        authenticated: true,
        user: {
          username: 'testuser',
          roles: ['admin']
        }
      });
    });

    test('returns unauthenticated status', () => {
      mockReq.session!.authenticated = false;

      authCheckHandler(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        authenticated: false
      });
    });

    test('handles missing session', () => {
      mockReq.session = undefined as any;

      authCheckHandler(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        authenticated: false
      });
    });
  });

  describe('requireRole', () => {
    test('allows user with required role', () => {
      const middleware = requireRole('admin');
      mockReq.user = {
        id: 'user-1',
        username: 'testuser',
        roles: ['admin', 'user']
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    test('allows user with one of multiple required roles', () => {
      const middleware = requireRole(['admin', 'moderator']);
      mockReq.user = {
        id: 'user-1',
        username: 'testuser',
        roles: ['moderator']
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('blocks user without required role', () => {
      const middleware = requireRole('admin');
      mockReq.user = {
        id: 'user-1',
        username: 'testuser',
        roles: ['user']
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient permissions',
        message: 'This action requires one of the following roles: admin'
      });
    });

    test('blocks unauthenticated user', () => {
      const middleware = requireRole('admin');
      mockReq.user = undefined;

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
    });

    test('handles user with no roles', () => {
      const middleware = requireRole('admin');
      mockReq.user = {
        id: 'user-1',
        username: 'testuser'
        // No roles property
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe('SimpleAuthService', () => {
    let authService: SimpleAuthService;

    test('creates with default admin user', () => {
      authService = new SimpleAuthService();
      
      expect(authService).toBeDefined();
    });

    test('creates with custom users', () => {
      authService = new SimpleAuthService([
        { username: 'user1', password: 'pass1', id: 'id1', roles: ['user'] },
        { username: 'admin', password: 'adminpass', roles: ['admin'] }
      ]);
      
      expect(authService).toBeDefined();
    });

    test('validates correct credentials', async () => {
      authService = new SimpleAuthService([
        { username: 'testuser', password: 'testpass', id: 'user-1', roles: ['user'] }
      ]);

      const result = await authService.validateCredentials({
        username: 'testuser',
        password: 'testpass'
      });

      expect(result).toEqual({
        valid: true,
        user: {
          id: 'user-1',
          username: 'testuser',
          roles: ['user']
        }
      });
    });

    test('rejects invalid username', async () => {
      authService = new SimpleAuthService([
        { username: 'testuser', password: 'testpass' }
      ]);

      const result = await authService.validateCredentials({
        username: 'wronguser',
        password: 'testpass'
      });

      expect(result).toEqual({
        valid: false,
        error: 'Invalid username or password'
      });
    });

    test('rejects invalid password', async () => {
      authService = new SimpleAuthService([
        { username: 'testuser', password: 'testpass' }
      ]);

      const result = await authService.validateCredentials({
        username: 'testuser',
        password: 'wrongpass'
      });

      expect(result).toEqual({
        valid: false,
        error: 'Invalid username or password'
      });
    });

    test('generates user ID if not provided', async () => {
      authService = new SimpleAuthService([
        { username: 'testuser', password: 'testpass' }
      ]);

      const result = await authService.validateCredentials({
        username: 'testuser',
        password: 'testpass'
      });

      expect(result.valid).toBe(true);
      expect(result.user?.id).toBe('user-testuser');
    });

    test('adds new user', async () => {
      authService = new SimpleAuthService();
      authService.addUser('newuser', 'newpass', ['admin']);

      const result = await authService.validateCredentials({
        username: 'newuser',
        password: 'newpass'
      });

      expect(result).toEqual({
        valid: true,
        user: {
          id: 'user-newuser',
          username: 'newuser',
          roles: ['admin']
        }
      });
    });
  });
});