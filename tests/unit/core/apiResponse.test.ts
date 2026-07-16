/**
 * API Response Utilities Tests
 * Comprehensive tests for standardized API response helpers
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { Request, Response, NextFunction } from "express";
import { ZodError, z } from "zod";
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendBadRequest,
  sendCreated,
  sendNoContent,
  asyncHandler,
  apiErrorHandler,
  ApiResponse,
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../../src/core/apiResponse";

// Mock the logger
vi.mock("../../../src/core/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

/**
 * Create a mock Express response
 */
function createMockResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    locals: {},
    headersSent: false,
  } as unknown as Response;
  return res;
}

/**
 * Create a mock Express request
 */
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as Request;
}

describe("apiResponse utilities", () => {
  let mockRes: Response;

  beforeEach(() => {
    mockRes = createMockResponse();
    vi.clearAllMocks();
  });

  describe("sendSuccess", () => {
    it("should send success response with data", () => {
      const data = { id: 1, name: "Test" };
      sendSuccess(mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
          timestamp: expect.any(String),
        }),
      );
    });

    it("should include message when provided", () => {
      sendSuccess(mockRes, { id: 1 }, "Operation successful");

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Operation successful",
        }),
      );
    });

    it("should use custom status code", () => {
      sendSuccess(mockRes, { id: 1 }, undefined, 202);

      expect(mockRes.status).toHaveBeenCalledWith(202);
    });

    it("should include requestId from res.locals", () => {
      mockRes.locals = { requestId: "req-123" };
      sendSuccess(mockRes, { id: 1 });

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { requestId: "req-123" },
        }),
      );
    });

    it("should not include metadata when no requestId", () => {
      sendSuccess(mockRes, { id: 1 });

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: undefined,
        }),
      );
    });

    it("should handle null data", () => {
      sendSuccess(mockRes, null);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: null,
        }),
      );
    });

    it("should handle array data", () => {
      const data = [1, 2, 3];
      sendSuccess(mockRes, data);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [1, 2, 3],
        }),
      );
    });
  });

  describe("sendError", () => {
    it("should send error response with string message", () => {
      sendError(mockRes, "Something went wrong");

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Something went wrong",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should send error response with Error object", () => {
      const error = new Error("Test error");
      sendError(mockRes, error);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Test error",
        }),
      );
    });

    it("should use custom status code", () => {
      sendError(mockRes, "Not found", 404);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("should include details when provided", () => {
      sendError(mockRes, "Validation failed", 400, { field: "email" });

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { field: "email" },
        }),
      );
    });

    it("should include stack trace in development mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const error = new Error("Dev error");
      sendError(mockRes, error);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("should not include stack trace in production mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const error = new Error("Prod error");
      sendError(mockRes, error);

      const call = (mockRes.json as Mock).mock.calls[0][0];
      expect(call.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it("should include requestId from res.locals", () => {
      mockRes.locals = { requestId: "req-456" };
      sendError(mockRes, "Error");

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { requestId: "req-456" },
        }),
      );
    });
  });

  describe("sendValidationError", () => {
    it("should send 400 status with validation errors", () => {
      const errors = [{ field: "email", message: "Invalid email" }];
      sendValidationError(mockRes, errors);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Validation failed",
          details: errors,
        }),
      );
    });

    it("should use custom message", () => {
      sendValidationError(mockRes, [], "Custom validation message");

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Custom validation message",
        }),
      );
    });
  });

  describe("sendNotFound", () => {
    it("should send 404 with default message", () => {
      sendNotFound(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Resource not found",
        }),
      );
    });

    it("should use custom resource name", () => {
      sendNotFound(mockRes, "User");

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "User not found",
        }),
      );
    });
  });

  describe("sendUnauthorized", () => {
    it("should send 401 with default message", () => {
      sendUnauthorized(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Unauthorized",
        }),
      );
    });

    it("should use custom message", () => {
      sendUnauthorized(mockRes, "Invalid token");

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Invalid token",
        }),
      );
    });
  });

  describe("sendForbidden", () => {
    it("should send 403 with default message", () => {
      sendForbidden(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Forbidden",
        }),
      );
    });

    it("should use custom message", () => {
      sendForbidden(mockRes, "Access denied");

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Access denied",
        }),
      );
    });
  });

  describe("sendBadRequest", () => {
    it("should send 400 with default message", () => {
      sendBadRequest(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Bad request",
        }),
      );
    });

    it("should use custom message", () => {
      sendBadRequest(mockRes, "Invalid input");

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Invalid input",
        }),
      );
    });
  });

  describe("sendCreated", () => {
    it("should send 201 with data", () => {
      const data = { id: 1, name: "New Resource" };
      sendCreated(mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
          message: "Resource created successfully",
        }),
      );
    });

    it("should use custom message", () => {
      sendCreated(mockRes, { id: 1 }, "User created");

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User created",
        }),
      );
    });
  });

  describe("sendNoContent", () => {
    it("should send 204 with no body", () => {
      sendNoContent(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe("asyncHandler", () => {
    it("should call the handler function", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const wrapped = asyncHandler(handler);

      const req = createMockRequest();
      const next = vi.fn();

      wrapped(req, mockRes, next);

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(req, mockRes, next);
    });

    it("should catch errors and pass to next", async () => {
      const error = new Error("Handler error");
      const handler = vi.fn().mockRejectedValue(error);
      const wrapped = asyncHandler(handler);

      const req = createMockRequest();
      const next = vi.fn();

      wrapped(req, mockRes, next);

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(next).toHaveBeenCalledWith(error);
    });

    it("should handle synchronous functions", async () => {
      const handler = vi.fn().mockReturnValue("result");
      const wrapped = asyncHandler(handler);

      const req = createMockRequest();
      const next = vi.fn();

      wrapped(req, mockRes, next);

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle synchronous errors", async () => {
      const error = new Error("Sync error");
      const handler = vi.fn().mockImplementation(() => {
        throw error;
      });
      const wrapped = asyncHandler(handler);

      const req = createMockRequest();
      const next = vi.fn();

      wrapped(req, mockRes, next);

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe("apiErrorHandler", () => {
    let mockReq: Request;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = createMockRequest();
      mockNext = vi.fn();
    });

    it("should delegate to next if headers already sent", () => {
      (mockRes as any).headersSent = true;
      const error = new Error("Test error");

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should handle ZodError instances", () => {
      const schema = z.object({ email: z.string().email() });
      let zodError: ZodError | undefined;
      try {
        schema.parse({ email: "invalid" });
      } catch (e) {
        zodError = e as ZodError;
      }

      apiErrorHandler(zodError!, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: "Validation failed",
        }),
      );
    });

    it("should handle errors with ZodError name", () => {
      const error = new Error("Zod validation error");
      error.name = "ZodError";
      (error as any).issues = [{ path: ["email"], message: "Invalid" }];

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should handle ValidationError", () => {
      const error = new Error("Validation error");
      error.name = "ValidationError";
      (error as any).errors = [{ field: "name", message: "Required" }];

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should handle UnauthorizedError", () => {
      const error = new Error("Token expired");
      error.name = "UnauthorizedError";

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Token expired",
        }),
      );
    });

    it("should handle CastError", () => {
      const error = new Error("Cast error");
      error.name = "CastError";

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Invalid request parameters",
        }),
      );
    });

    it("should handle TypeError", () => {
      const error = new TypeError("Type error");

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Invalid request parameters",
        }),
      );
    });

    it("should use statusCode from error", () => {
      const error = new Error("Not found") as any;
      error.statusCode = 404;

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("should use status from error", () => {
      const error = new Error("Conflict") as any;
      error.status = 409;

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it("should default to 500 for unknown errors", () => {
      const error = new Error("Unknown error");

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("should handle errors without message", () => {
      const error = new Error("");
      error.message = "";

      apiErrorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Internal server error",
        }),
      );
    });
  });

  describe("Type exports", () => {
    it("should export ApiResponse type", () => {
      const response: ApiResponse<string> = {
        success: true,
        data: "test",
      };
      expect(response.success).toBe(true);
    });

    it("should export ApiErrorResponse type", () => {
      const response: ApiErrorResponse = {
        success: false,
        error: "Error message",
      };
      expect(response.success).toBe(false);
    });

    it("should export ApiSuccessResponse type", () => {
      const response: ApiSuccessResponse<number> = {
        success: true,
        data: 42,
      };
      expect(response.success).toBe(true);
    });
  });
});
