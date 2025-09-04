/**
 * Middleware Module Exports
 */

export {
  schemas,
  validate,
  validateParams,
  validateQuery,
  validateAsync,
  validateRequest,
  validateIf,
  compose,
  z,
  zod
} from './validation.js';

export { aiErrorHandler } from './aiErrorHandler.js';
export { errorHandler, notFoundHandler, asyncHandler, AppError } from './errorHandler.js';
export { createFileUpload, parseFormData, sendFile, createTempCleaner } from './fileUpload.js';
export type { FileUploadConfig } from './fileUpload.js';
export { createHealthCheck, healthCheck } from './health.js';
export type { HealthCheckOptions, ComponentHealth, HealthResponse } from './health.js';
export { setupOpenAPIDocumentation, generateOpenAPISpec, ApiOperation } from './openapi.js';
export type { OpenAPIConfig } from './openapi.js';

// Auth middleware exports
export {
  createAuthMiddleware,
  createLoginHandler,
  createLogoutHandler,
  createAuthCheckHandler,
  SimpleAuthService
} from './auth.js';
export type { AuthConfig } from './auth.js';

// Session middleware exports  
export { configureSession } from './session.js';
export type { SessionConfig as SessionMiddlewareConfig } from './session.js';

// CORS middleware exports
export { 
  createDynamicCors, 
  createProductionCors, 
  createDevCors 
} from './cors.js';
export type { DynamicCorsOptions } from './cors.js';
