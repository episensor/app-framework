/**
 * Dynamic CORS Middleware
 * Intelligently handles CORS based on environment and configuration
 */

import cors from 'cors';
import { createLogger } from '../core/enhancedLogger.js';

const logger = createLogger('CORS');

export interface DynamicCorsOptions {
  /**
   * Explicitly allowed origins (optional)
   */
  allowedOrigins?: string[];
  
  /**
   * Port ranges to automatically allow in development
   */
  devPortRanges?: Array<{ start: number; end: number }>;
  
  /**
   * Common development ports to always allow
   */
  commonDevPorts?: number[];
  
  /**
   * Whether to allow credentials
   */
  credentials?: boolean;
  
  /**
   * Custom origin validator function
   */
  customValidator?: (origin: string) => boolean;
}

/**
 * Creates dynamic CORS middleware that intelligently handles origins
 */
export function createDynamicCors(options: DynamicCorsOptions = {}) {
  const {
    allowedOrigins = [],
    devPortRanges = [
      { start: 3000, end: 3010 },
      { start: 5170, end: 5180 },
      { start: 8080, end: 8090 }
    ],
    commonDevPorts = [3000, 3001, 5173, 5174, 5175, 8080, 8081],
    credentials = true,
    customValidator
  } = options;

  // Build allowed origins list for development
  const buildDevOrigins = (): string[] => {
    const origins = new Set<string>();
    
    // Add explicitly allowed origins
    allowedOrigins.forEach(origin => origins.add(origin));
    
    // Add common development ports
    commonDevPorts.forEach(port => {
      origins.add(`http://localhost:${port}`);
      origins.add(`http://127.0.0.1:${port}`);
    });
    
    // Add port ranges
    devPortRanges.forEach(range => {
      for (let port = range.start; port <= range.end; port++) {
        origins.add(`http://localhost:${port}`);
        origins.add(`http://127.0.0.1:${port}`);
      }
    });
    
    return Array.from(origins);
  };

  // CORS origin function
  const originFunction = (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    // Allow requests with no origin (same-origin, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Production mode
    if (process.env.NODE_ENV === 'production') {
      // Check against explicit allowed origins
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Check custom validator
      if (customValidator && customValidator(origin)) {
        return callback(null, true);
      }
      
      // Check if origin matches the app's domain
      const appDomain = process.env.APP_DOMAIN || process.env.PRODUCTION_URL;
      if (appDomain && origin.includes(appDomain)) {
        return callback(null, true);
      }
      
      // Reject by default in production
      logger.warn(`CORS rejected origin in production: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }

    // Development mode - be more permissive
    const devOrigins = buildDevOrigins();
    
    // Check if origin matches any development origin
    if (devOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }
    
    // Check if it's any localhost/127.0.0.1 origin
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      logger.debug(`Allowing localhost origin: ${origin}`);
      return callback(null, true);
    }
    
    // Check custom validator
    if (customValidator && customValidator(origin)) {
      return callback(null, true);
    }
    
    // Log and allow in development (with warning)
    logger.warn(`CORS: Allowing unrecognized origin in development: ${origin}`);
    return callback(null, true);
  };

  // Create and return configured CORS middleware
  const corsMiddleware = cors({
    origin: originFunction,
    credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400 // 24 hours
  });

  // Attach the origin function for testing purposes
  (corsMiddleware as any)._originFunction = originFunction;
  
  return corsMiddleware;
}

/**
 * Simple CORS middleware for production with specific domains
 */
export function createProductionCors(allowedDomains: string[]) {
  const originFunction = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedDomains.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  };

  const corsMiddleware = cors({
    origin: originFunction,
    credentials: true
  });

  // Attach for testing
  (corsMiddleware as any)._originFunction = originFunction;
  
  return corsMiddleware;
}

/**
 * Permissive CORS for development
 */
export function createDevCors() {
  return createDynamicCors({
    allowedOrigins: [],
    credentials: true
  });
}

export default createDynamicCors;