/**
 * Standardized Health Check Middleware
 * Provides consistent health monitoring across all applications
 */

import { Request, Response, Router } from "express";
import os from "os";

export interface HealthCheckOptions {
  includeDetails?: boolean;
  checkComponents?: () => Promise<ComponentHealth>;
  version?: string;
  serviceName?: string;
}

export interface ComponentHealth {
  [key: string]: {
    status: "healthy" | "degraded" | "unhealthy";
    message?: string;
    latency?: number;
  };
}

export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  service?: string;
  components?: ComponentHealth;
  resources?: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      cores: number;
    };
  };
}

/**
 * Get system resource usage
 */
function getSystemResources() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // Simplified CPU usage calculation
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = Math.round(100 - (100 * idle) / total);

  return {
    memory: {
      used: usedMem,
      total: totalMem,
      percentage: Math.round((usedMem / totalMem) * 100),
    },
    cpu: {
      usage,
      cores: cpus.length,
    },
  };
}

/**
 * Determine overall health status based on components
 */
function determineOverallHealth(
  components?: ComponentHealth,
): "healthy" | "degraded" | "unhealthy" {
  if (!components) return "healthy";

  const statuses = Object.values(components).map((c) => c.status);

  if (statuses.some((s) => s === "unhealthy")) {
    return "unhealthy";
  }

  if (statuses.some((s) => s === "degraded")) {
    return "degraded";
  }

  return "healthy";
}

/**
 * Create standardized health check endpoint
 * @param {HealthCheckOptions} options - Health check configuration
 * @returns {Router} Express router with health endpoint
 */
export function createHealthCheck(options: HealthCheckOptions = {}): Router {
  const router = Router();
  const {
    includeDetails = true,
    checkComponents,
    version = process.env.npm_package_version || "1.0.0",
    serviceName,
  } = options;

  /**
   * GET /health
   * Standard health check endpoint
   */
  router.get("/health", async (_req: Request, res: Response) => {
    try {
      // Check component health if provided
      const components = checkComponents ? await checkComponents() : undefined;

      // Build health response
      const health: HealthResponse = {
        status: determineOverallHealth(components),
        timestamp: new Date().toISOString(),
        version,
        uptime: process.uptime(),
      };

      if (serviceName) {
        health.service = serviceName;
      }

      if (includeDetails) {
        health.resources = getSystemResources();
      }

      if (components) {
        health.components = components;
      }

      // Set appropriate status code
      const statusCode =
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 200
            : 503;

      res.status(statusCode).json(health);
    } catch (_error: any) {
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version,
        error: _error.message,
      });
    }
  });

  /**
   * GET /health/ready
   * Readiness check (for k8s)
   */
  router.get("/health/ready", async (_req: Request, res: Response) => {
    try {
      const components = checkComponents ? await checkComponents() : undefined;
      const status = determineOverallHealth(components);

      if (status === "healthy") {
        res.status(200).json({ ready: true });
      } else {
        res.status(503).json({ ready: false, status });
      }
    } catch (_error) {
      res.status(503).json({ ready: false });
    }
  });

  /**
   * GET /health/live
   * Liveness check (for k8s)
   */
  router.get("/health/live", (_req: Request, res: Response) => {
    res.status(200).json({ alive: true });
  });

  return router;
}

/**
 * Simple health check middleware for basic use
 */
export function healthCheck(_req: Request, res: Response) {
  const health: HealthResponse = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: process.uptime(),
  };

  res.json(health);
}
