import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { createLogger } from "../core/logger.js";

export interface RequestLoggingOptions {
  logger?: any;
  /**
   * Paths to skip logging for (commonly health checks or metrics)
   */
  skipPaths?: Array<string | RegExp>;
  /**
   * Whether to log the request payload (truncated)
   */
  logPayload?: boolean;
  /**
   * Maximum number of characters from the payload to log
   */
  maxPayloadLength?: number;
}

const defaultSkips = [/^\/health/, /^\/api\/health/];

function shouldSkip(path: string, patterns: Array<string | RegExp>) {
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(path);
    }
    return path.startsWith(pattern);
  });
}

function safePayload(body: unknown, maxLength: number): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const serialized = JSON.stringify(body);
  if (serialized.length <= maxLength) return serialized;
  return `${serialized.slice(0, maxLength)}…`;
}

/**
 * Express middleware that assigns a request ID and logs completion.
 * Uses the framework logger so request logs land in the same files as the app.
 */
export function createRequestLoggingMiddleware(
  options: RequestLoggingOptions = {},
) {
  const logger =
    options.logger ||
    // Avoid forcing the consumer to initialize logging before use
    createLogger("http");
  const skipPatterns = options.skipPaths || defaultSkips;
  const logPayload = options.logPayload ?? false;
  const maxPayloadLength = options.maxPayloadLength ?? 2000;

  return function requestLogging(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const startedAt = process.hrtime.bigint();
    const requestId = (req as any).requestId || randomUUID();
    (req as any).requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    res.on("finish", () => {
      if (shouldSkip(req.path, skipPatterns)) return;

      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      // Prefer the richer logRequest helper if available
      if (typeof logger.logRequest === "function") {
        logger.logRequest(req, res, Number(durationMs.toFixed(2)));
        return;
      }

      logger.info("Request completed", {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        requestId,
        userAgent: req.get("user-agent"),
        payload: logPayload
          ? safePayload(req.body, maxPayloadLength)
          : undefined,
      });
    });

    next();
  };
}
