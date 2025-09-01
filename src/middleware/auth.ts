/**
 * Authentication Middleware
 * Generic authentication utilities for Express applications
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../core/index.js';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('AuthMiddleware');
  }
  return logger;
}

// Extend Express Request type to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        roles?: string[];
      };
    }
  }
}

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
    username?: string;
    userId?: string;
    roles?: string[];
  }
}

export interface AuthConfig {
  loginPath?: string;
  apiPrefix?: string;
  excludePaths?: string[];
  onUnauthorized?: (req: Request, res: Response) => void;
}

/**
 * Creates authentication middleware with configuration
 */
export function createAuthMiddleware(config: AuthConfig = {}) {
  const {
    loginPath = '/login',
    apiPrefix = '/api/',
    excludePaths = [],
    onUnauthorized
  } = config;

  return function requireAuth(req: Request, res: Response, next: NextFunction): void {
    // Check if path is excluded
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Check if user is authenticated
    if (req.session && req.session.authenticated) {
      // Attach user to request
      req.user = {
        id: req.session.userId || '',
        username: req.session.username || '',
        roles: req.session.roles || []
      };
      return next();
    }

    // Handle unauthorized access
    if (onUnauthorized) {
      return onUnauthorized(req, res);
    }

    // Default behavior
    if (req.path.startsWith(apiPrefix)) {
      // For API routes, return JSON error
      res.status(401).json({ 
        success: false,
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    } else {
      // For web routes, redirect to login
      res.redirect(loginPath);
    }
  };
}

/**
 * Login handler factory
 */
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthService {
  validateCredentials: (credentials: LoginCredentials) => Promise<{
    valid: boolean;
    user?: {
      id: string;
      username: string;
      roles?: string[];
    };
    error?: string;
  }>;
}

export function createLoginHandler(authService: AuthService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({
          success: false,
          error: 'Missing credentials',
          message: 'Username and password are required'
        });
        return;
      }

      const result = await authService.validateCredentials({ username, password });

      if (result.valid && result.user) {
        // Set session
        req.session.authenticated = true;
        req.session.username = result.user.username;
        req.session.userId = result.user.id;
        req.session.roles = result.user.roles;

        ensureLogger().info(`User logged in: ${username}`);

        res.json({
          success: true,
          user: {
            username: result.user.username,
            roles: result.user.roles
          }
        });
      } else {
        ensureLogger().warn(`Failed login attempt for user: ${username}`);
        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          message: result.error || 'Invalid username or password'
        });
      }
    } catch (error: any) {
      ensureLogger().error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        message: 'An error occurred during login'
      });
    }
  };
}

/**
 * Logout handler factory
 */
export function createLogoutHandler() {
  return (req: Request, res: Response): void => {
    const username = req.session?.username;
    
    req.session.destroy((err: any) => {
      if (err) {
        ensureLogger().error('Error destroying session:', err);
        res.status(500).json({
          success: false,
          error: 'Logout failed'
        });
        return;
      }

      if (username) {
        ensureLogger().info(`User logged out: ${username}`);
      }

      res.json({ success: true });
    });
  };
}

/**
 * Auth check handler
 */
export function createAuthCheckHandler() {
  return (req: Request, res: Response): void => {
    if (req.session?.authenticated) {
      res.json({
        authenticated: true,
        user: {
          username: req.session.username,
          roles: req.session.roles
        }
      });
    } else {
      res.status(401).json({
        authenticated: false
      });
    }
  };
}

/**
 * Role-based access control middleware
 */
export function requireRole(roles: string | string[]) {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `This action requires one of the following roles: ${requiredRoles.join(', ')}`
      });
      return;
    }

    next();
  };
}

/**
 * Simple in-memory auth service for development
 */
export class SimpleAuthService implements AuthService {
  private users: Map<string, { password: string; id: string; roles?: string[] }>;

  constructor(users: Array<{ username: string; password: string; id?: string; roles?: string[] }> = []) {
    this.users = new Map();
    
    // Add default admin user if no users provided
    if (users.length === 0) {
      users = [{ username: 'admin', password: 'admin', id: 'admin-1', roles: ['admin'] }];
    }

    users.forEach(user => {
      this.users.set(user.username, {
        password: user.password,
        id: user.id || `user-${user.username}`,
        roles: user.roles
      });
    });
  }

  async validateCredentials(credentials: LoginCredentials) {
    const user = this.users.get(credentials.username);

    if (!user || user.password !== credentials.password) {
      return {
        valid: false,
        error: 'Invalid username or password'
      };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        username: credentials.username,
        roles: user.roles
      }
    };
  }

  addUser(username: string, password: string, roles?: string[]) {
    this.users.set(username, {
      password,
      id: `user-${username}`,
      roles
    });
  }
}

export default {
  createAuthMiddleware,
  createLoginHandler,
  createLogoutHandler,
  createAuthCheckHandler,
  requireRole,
  SimpleAuthService
};
