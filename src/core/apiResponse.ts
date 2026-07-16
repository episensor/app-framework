/**
 * Standardized API Response Utilities
 * Provides consistent response format across all applications
 */

import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { createLogger } from "../core/logger.js";
import { ApiResponse, FieldValidationError } from "../types/index.js";

const logger = createLogger("api-error");

// Re-export ApiResponse from types for backward compatibility
export type { ApiResponse };

/**
 * Error response with required error field
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
  stack?: string;
  timestamp?: string;
  metadata?: { requestId?: string };
}

/**
 * Success response with required data field
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
  metadata?: { requestId?: string };
}

/**
 * Send a successful response
 */
export function sendSuccess<T = unknown>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): Response<ApiSuccessResponse<T>> {
  const requestId = res.locals?.requestId as string | undefined;
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
    metadata: requestId ? { requestId } : undefined,
  });
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  error: string | Error,
  statusCode = 500,
  details?: unknown,
): Response<ApiErrorResponse> {
  const requestId = res.locals?.requestId as string | undefined;
  const errorMessage = typeof error === "string" ? error : error.message;
  const response: ApiErrorResponse = {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    metadata: requestId ? { requestId } : undefined,
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
  errors: FieldValidationError[] | unknown,
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
export function sendCreated<T = unknown>(
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
 * Async request handler function type
 */
type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

/**
 * Wrap async route handlers to catch errors
 * Handles both synchronous throws and async rejections
 */
export function asyncHandler(fn: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Use Promise.resolve().then() to catch synchronous errors too
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  };
}

/**
 * HTTP error with status code
 */
interface HttpError extends Error {
  statusCode?: number;
  status?: number;
  errors?: unknown;
  issues?: unknown;
}

/**
 * Standard error handler middleware
 */
export function apiErrorHandler(
  err: HttpError | ZodError | Error,
  _req: Request,
  res: Response,
  next: NextFunction,
): Response<ApiErrorResponse> | void {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  const httpErr = err as HttpError;

  // Log the error using the framework's enhanced logger
  logger.error("API Error:", {
    error: err.message,
    stack: err.stack,
    name: err.name,
    statusCode: httpErr.statusCode || httpErr.status || 500,
  });

  // Handle different error types
  if (err instanceof ZodError || err.name === "ZodError") {
    const zodErr = err as ZodError;
    return sendValidationError(res, zodErr.issues || err.message);
  }

  if (err.name === "ValidationError") {
    return sendValidationError(res, httpErr.errors || err.message);
  }

  if (err.name === "UnauthorizedError") {
    return sendUnauthorized(res, err.message);
  }

  if (err.name === "CastError" || err.name === "TypeError") {
    return sendBadRequest(res, "Invalid request parameters");
  }

  if (httpErr.statusCode || httpErr.status) {
    return sendError(res, err.message, httpErr.statusCode || httpErr.status);
  }

  // Default to internal server error
  return sendError(res, err.message || "Internal server error");
}
