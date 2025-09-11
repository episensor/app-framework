/**
 * Session Configuration Middleware
 * Standardized session management for Express applications
 */

import session from 'express-session';
import { Express } from 'express';
import { createLogger } from '../core/index.js';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('SessionMiddleware');
  }
  return logger;
}

export interface SessionConfig {
  secret?: string;
  name?: string;
  maxAge?: number;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  trustProxy?: boolean;
  resave?: boolean;
  saveUninitialized?: boolean;
  rolling?: boolean;
  store?: 'memory' | session.Store;
}

/**
 * Configure session middleware with sensible defaults
 */
export function configureSession(app: Express, config: SessionConfig = {}) {
  const {
    secret = process.env.SESSION_SECRET || 'change-this-secret-in-production',
    name = 'app.sid',
    maxAge = 3600000, // 1 hour
    secure = process.env.NODE_ENV === 'production',
    sameSite = 'lax',
    trustProxy = true,
    resave = false,
    saveUninitialized = false,
    rolling = true,
    store = 'memory'
  } = config;

  // Warn about insecure settings in production
  if (process.env.NODE_ENV === 'production') {
    if (secret === 'change-this-secret-in-production') {
      ensureLogger().warn('Using default session secret in production! Set SESSION_SECRET environment variable.');
    }
    if (store === 'memory') {
      ensureLogger().warn('Using memory session store in production! Consider using Redis or another persistent store.');
    }
    if (!secure) {
      ensureLogger().warn('Session cookies are not secure in production! Consider enabling secure cookies.');
    }
  }

  // Trust proxy if configured
  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  // Suppress MemoryStore warning in production
  let originalWarn: typeof console.warn | undefined;
  if (process.env.NODE_ENV === 'production' && store === 'memory') {
    originalWarn = console.warn;
    console.warn = (msg: string, ...args: any[]) => {
      if (typeof msg === 'string' && !msg.includes('MemoryStore')) {
        originalWarn!(msg, ...args);
      }
    };
  }

  const sessionConfig: session.SessionOptions = {
    secret,
    name,
    resave,
    saveUninitialized,
    rolling,
    cookie: {
      secure,
      httpOnly: true,
      maxAge,
      sameSite,
      path: '/'
    }
  };

  // Add store if provided
  if (store !== 'memory') {
    sessionConfig.store = store;
  }

  // Apply middleware
  app.use(session(sessionConfig));

  // Restore console.warn if it was modified
  if (originalWarn) {
    // Restore after a brief delay to ensure session is initialized
    setTimeout(() => {
      console.warn = originalWarn!;
    }, 100);
  }

  if (process.env.NODE_ENV === 'development' && process.env.LOG_LEVEL?.toLowerCase() === 'debug') {
    ensureLogger().debug('Session middleware configured', {
      name,
      secure,
      sameSite,
      maxAge: `${maxAge / 1000}s`,
      store: store === 'memory' ? 'memory' : 'custom'
    });
  }
}

/**
 * Create a Redis session store (OPTIONAL)
 * 
 * Redis is an optional dependency for persistent session storage in production.
 * If Redis packages are not installed, the framework gracefully falls back to memory store.
 * 
 * To enable Redis sessions:
 * 1. Install optional dependencies: `npm install connect-redis redis`
 * 2. Set REDIS_URL environment variable (optional, defaults to redis://localhost:6379)
 * 3. Use createRedisStore() in your session configuration
 * 
 * For desktop applications with single users, memory store is usually sufficient.
 * 
 * @param redisUrl - Optional Redis connection URL (defaults to REDIS_URL env var or redis://localhost:6379)
 * @returns Redis store instance or 'memory' string on failure
 */
export async function createRedisStore(redisUrl?: string) {
  try {
    // @ts-expect-error - Optional dependency
    const RedisStore = (await import('connect-redis')).default;
    // @ts-expect-error - Optional dependency
    const { createClient } = await import('redis');

    const redisClient = createClient({
      url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379'
    });

    await redisClient.connect();

    ensureLogger().info('Redis session store connected');

    return new RedisStore({
      client: redisClient,
      prefix: 'session:'
    });
  } catch (_error: any) {
    ensureLogger().error('Failed to create Redis store:', error.message);
    ensureLogger().warn('Falling back to memory store');
    return 'memory' as const;
  }
}

/**
 * Session utilities
 */
export const sessionUtils = {
  /**
   * Regenerate session ID (for security after login)
   */
  regenerateSession(req: any): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.regenerate((err: any) => {
        if (err) {
          ensureLogger().error('Failed to regenerate session:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * Save session explicitly
   */
  saveSession(req: any): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.save((err: any) => {
        if (err) {
          ensureLogger().error('Failed to save session:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * Destroy session
   */
  destroySession(req: any): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy((err: any) => {
        if (err) {
          ensureLogger().error('Failed to destroy session:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  /**
   * Touch session to extend expiry
   */
  touchSession(req: any): void {
    if (req.session) {
      req.session.touch();
    }
  }
};

export default {
  configureSession,
  createRedisStore,
  sessionUtils
};
