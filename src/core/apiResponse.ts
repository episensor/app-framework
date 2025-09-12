/**
 * Standardized API Response Utilities
 * Provides consistent response format across all applications
 */

import { Response } from "express";
import { createLogger } from "../core/logger.js";

const logger = createLogger("api-error");

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface ApiErrorResponse extends ApiResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  stack?: string;
}

export interface ApiSuccessResponse<T = any> extends ApiResponse<T> {
  success: true;
  data: T;
}

/**
 * Send a successful response
 */
export function sendSuccess<T = any>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): Response<ApiSuccessResponse<T>> {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  error: string | Error,
  statusCode = 500,
  details?: any,
): Response<ApiErrorResponse> {
  const errorMessage = typeof error === "string" ? error : error.message;
  const response: ApiErrorResponse = {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };

  if (details) {
    response.details = details;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === "development" && error instanceof Error) {
    response.stack = error.stack;
  }

  return res.status(statusCode).json(response);
}

/**
 * Send a validation error response
 */
export function sendValidationError(
  res: Response,
  errors: any,
  message = "Validation failed",
): Response<ApiErrorResponse> {
  return sendError(res, message, 400, errors);
}

/**
 * Send a not found response
 */
export function sendNotFound(
  res: Response,
  resource = "Resource",
): Response<ApiErrorResponse> {
  return sendError(res, `${resource} not found`, 404);
}

/**
 * Send an unauthorized response
 */
export function sendUnauthorized(
  res: Response,
  message = "Unauthorized",
): Response<ApiErrorResponse> {
  return sendError(res, message, 401);
}

/**
 * Send a forbidden response
 */
export function sendForbidden(
  res: Response,
  message = "Forbidden",
): Response<ApiErrorResponse> {
  return sendError(res, message, 403);
}

/**
 * Send a bad request response
 */
export function sendBadRequest(
  res: Response,
  message = "Bad request",
): Response<ApiErrorResponse> {
  return sendError(res, message, 400);
}

/**
 * Send a created response
 */
export function sendCreated<T = any>(
  res: Response,
  data: T,
  message = "Resource created successfully",
): Response<ApiSuccessResponse<T>> {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send a no content response
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Wrap async route handlers to catch errors
 */
export function asyncHandler(fn: (req: any, res: any, next: any) => any) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Standard error handler middleware
 */
export function apiErrorHandler(err: any, _req: any, res: any, next: any) {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Log the error using the framework's enhanced logger
  logger.error("API Error:", {
    error: err.message,
    stack: err.stack,
    name: err.name,
    statusCode: err.statusCode || err.status || 500,
  });

  // Handle different error types
  if (err.name === "ValidationError") {
    return sendValidationError(res, err.errors || err.message);
  }

  if (err.name === "UnauthorizedError") {
    return sendUnauthorized(res, err.message);
  }

  if (err.name === "CastError" || err.name === "TypeError") {
    return sendBadRequest(res, "Invalid request parameters");
  }

  if (err.statusCode || err.status) {
    return sendError(res, err.message, err.statusCode || err.status);
  }

  // Default to internal server error
  return sendError(res, err.message || "Internal server error");
}
