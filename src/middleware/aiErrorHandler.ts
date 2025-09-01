/**
 * AI Error Handler Middleware
 * Provides user-friendly error messages for AI API errors
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../core/index.js';
import { ApiResponse } from '../types/index.js';
import { sendError, sendUnauthorized } from '../core/apiResponse.js';
import { AIError } from '../services/aiService.js';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('AIError');
  }
  return logger;
}

interface AIErrorResponse {
  error: string;
  details?: string[];
  action?: string;
  retryAfter?: number;
  code?: string;
}

/**
 * AI-specific error handler middleware
 */
export function aiErrorHandler(
  err: any,
  _req: Request,
  res: Response<ApiResponse<any>>,
  next: NextFunction
): void {
  // Only handle AI-related errors
  if (!_req.path.startsWith('/api/ai/')) {
    return next(err);
  }

  ensureLogger().error('AI Error:', {
    path: _req.path,
    method: _req.method,
    error: err.message,
    status: err.statusCode || err.status,
    stack: err.stack,
    errorType: err.errorType,
    provider: err.provider
  });

  // Handle our custom AIError instances
  if (err instanceof AIError) {
    const response: AIErrorResponse = {
      error: err.message,
      code: err.errorType
    };

    // Add provider-specific information
    if (err.provider) {
      response.details = [`Provider: ${err.provider}`];
    }

    // Handle specific error types
    switch (err.errorType) {
      case 'AUTH_ERROR':
        sendUnauthorized(res, err.message);
        return;
      case 'RATE_LIMIT':
        sendError(res, err.message, 429, { retryAfter: 60 });
        return;
      case 'SERVICE_UNAVAILABLE':
        sendError(res, err.message, 503);
        return;
      case 'TIMEOUT':
        sendError(res, err.message, 408);
        return;
      default:
        sendError(res, err.message, err.statusCode, response);
        return;
    }
  }

  // Handle legacy structured AI errors with user-friendly messages
  if (err.userMessage) {
    const response: AIErrorResponse = {
      error: err.userMessage,
    };

    if (err.details) {
      response.details = err.details;
    }

    if (err.actionRequired) {
      response.action = err.actionRequired;
    }

    if (err.code) {
      response.code = err.code;
    }

    sendError(res, err.userMessage, err.status || 500, {
      details: err.details,
      action: err.actionRequired,
      code: err.code
    });
    return;
  }

  // Handle OpenAI specific errors
  if (err.message && err.message.includes('401')) {
    sendUnauthorized(res, 'OpenAI API authentication failed: Invalid or missing API key. Check your OpenAI API key configuration');
    return;
  }

  if (err.message && err.message.includes('429')) {
    sendError(res, 'OpenAI API rate limit exceeded: Too many requests. Please wait a moment before trying again', 429);
    return;
  }

  if (err.message && err.message.includes('insufficient_quota')) {
    sendError(res, 'OpenAI API quota exceeded: Your account has insufficient quota. Check your OpenAI account billing and usage limits', 402);
    return;
  }

  // Handle Anthropic specific errors
  if (err.message && err.message.includes('anthropic')) {
    if (err.message.includes('401')) {
      sendUnauthorized(res, 'Anthropic API authentication failed: Invalid or missing API key');
      return;
    }

    if (err.message.includes('rate')) {
      sendError(res, 'Anthropic API rate limit exceeded: Too many requests', 429);
      return;
    }
  }

  // Handle JSON parse errors
  if (err.message && err.message.includes('JSON')) {
    sendError(res, 'Failed to generate valid template format: The AI response was not in the expected format', 500);
    return;
  }

  // Handle missing required fields
  if (err.message && err.message.includes('missing required fields')) {
    sendError(res, 'Generated template is incomplete: Missing required fields', 500);
    return;
  }

  // Handle API key errors
  if (err.message && err.message.includes('API key')) {
    sendUnauthorized(res, 'AI API key not configured: Please configure your API key');
    return;
  }

  // Handle timeout errors
  if (err.message && (err.message.includes('timeout') || err.message.includes('ETIMEDOUT'))) {
    sendError(res, 'AI request timed out: The request took too long to complete', 504);
    return;
  }

  // Handle network errors
  if (err.message && (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND'))) {
    sendError(res, 'AI service unavailable: Cannot connect to AI service', 503);
    return;
  }

  // Default error response
  sendError(res, err.message || 'An error occurred while processing your AI request', err.status || 500);
}

/**
 * Rate limit handler for AI endpoints
 */
export function aiRateLimitHandler(
  _req: Request,
  res: Response<ApiResponse<any>>
): void {
  sendError(res, 'Too many AI requests: Rate limit exceeded. Please wait a moment before trying again', 429);
}

/**
 * Create AI error with user-friendly message
 */
export function createAIError(
  message: string,
  userMessage: string,
  status: number = 500,
  details?: string[],
  action?: string
): AIError {
  const error = new AIError(message, status, 'CUSTOM_ERROR', 'unknown');
  // Additional legacy properties for compatibility
  (error as any).userMessage = userMessage;
  (error as any).details = details;
  (error as any).actionRequired = action;
  return error;
}

/**
 * Wrap async AI handlers with error handling
 */
export function wrapAIHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error: any) {
      // Convert to AI error if needed
      if (!error.userMessage && error.response?.data) {
        // Handle API response errors
        const apiError = error.response.data;
        error.userMessage = apiError.error?.message || apiError.message || 'AI request failed';
        error.status = error.response.status;
        error.details = apiError.error?.details || [apiError.error?.type];
      }
      next(error);
    }
  };
}

export default {
  aiErrorHandler,
  aiRateLimitHandler,
  createAIError,
  wrapAIHandler
};
