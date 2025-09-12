/**
 * Health Check Service
 * Provides real-time system health monitoring without intervention
 * Data is informational only - no automatic service stops based on metrics
 */

import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { Request, Response, Router } from "express";

const execAsync = promisify(exec);

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  pid: number;
  platform: string;
  nodeVersion: string;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    count: number;
    model: string;
    speed: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    path: string;
  };
  network: {
    interfaces: NetworkInterface[];
  };
  process: {
    pid: number;
    memory: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
  };
}

export interface NetworkInterface {
  name: string;
  address: string;
  family: string;
  internal: boolean;
}

export interface HealthCheckOptions {
  includeCpu?: boolean;
  includeMemory?: boolean;
  includeDisk?: boolean;
  includeNetwork?: boolean;
  includeProcess?: boolean;
  diskPath?: string;
  customChecks?: CustomHealthCheck[];
}

export interface CustomHealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  data?: any;
}

export interface DependencyHealth {
  name: string;
  status: "connected" | "disconnected" | "error";
  responseTime?: number;
  error?: string;
}

class HealthCheckService {
  private static instance: HealthCheckService;
  private cpuUsageHistory: number[] = [];
  private memoryUsageHistory: number[] = [];
  private lastCpuInfo: any;
  private metricsInterval?: NodeJS.Timeout;
  private historySize: number = 60; // Keep last 60 data points

  private constructor() {
    this.startMetricsCollection();
  }

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Get basic system health status
   */
  async getHealth(appVersion?: string): Promise<SystemHealth> {
    // Health status is 'healthy' by default - system metrics are informational only
    // Actual health is determined by custom checks (database, websocket, etc.)
    const status: SystemHealth["status"] = "healthy";

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: appVersion || process.env.npm_package_version || "unknown",
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version,
    };
  }

  /**
   * Get detailed system metrics
   */
  async getMetrics(options: HealthCheckOptions = {}): Promise<SystemMetrics> {
    const {
      includeCpu = true,
      includeMemory = true,
      includeDisk = true,
      includeNetwork = true,
      includeProcess = true,
      diskPath = process.cwd(),
    } = options;

    const metrics: SystemMetrics = {} as SystemMetrics;

    if (includeCpu) {
      metrics.cpu = await this.getCpuMetrics();
    }

    if (includeMemory) {
      metrics.memory = this.getMemoryMetrics();
    }

    if (includeDisk) {
      metrics.disk = await this.getDiskMetrics(diskPath);
    }

    if (includeNetwork) {
      metrics.network = this.getNetworkMetrics();
    }

    if (includeProcess) {
      metrics.process = this.getProcessMetrics();
    }

    return metrics;
  }

  /**
   * Get CPU metrics with real usage calculation
   */
  private async getCpuMetrics(): Promise<SystemMetrics["cpu"]> {
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || "Unknown";
    const cpuSpeed = cpus[0]?.speed || 0;
    const cpuCount = cpus.length;
    const loadAverage = os.loadavg();

    // Calculate CPU usage percentage
    const cpuUsage = await this.calculateCpuUsage();

    return {
      usage: cpuUsage,
      count: cpuCount,
      model: cpuModel,
      speed: cpuSpeed,
      loadAverage,
    };
  }

  /**
   * Calculate real CPU usage percentage
   */
  private async calculateCpuUsage(): Promise<number> {
    const cpus = os.cpus();

    // Calculate total and idle times
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

    // If we have previous measurements, calculate the difference
    if (this.lastCpuInfo) {
      const idleDiff = idle - this.lastCpuInfo.idle;
      const totalDiff = total - this.lastCpuInfo.total;
      const usage = 100 - (100 * idleDiff) / totalDiff;

      this.lastCpuInfo = { idle, total };
      return Math.min(100, Math.max(0, usage));
    }

    // First measurement - store for next time
    this.lastCpuInfo = { idle, total };

    // Fallback: use load average as approximation
    const loadAvg = os.loadavg()[0]; // 1-minute load average
    const approximateUsage = (loadAvg / cpus.length) * 100;
    return Math.min(100, Math.max(0, approximateUsage));
  }

  /**
   * Get memory metrics
   */
  private getMemoryMetrics(): SystemMetrics["memory"] {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      percentage: parseFloat(memoryPercentage.toFixed(2)),
    };
  }

  /**
   * Get disk metrics for specified path
   */
  private async getDiskMetrics(
    diskPath: string,
  ): Promise<SystemMetrics["disk"]> {
    try {
      // Platform-specific disk usage check
      if (process.platform === "win32") {
        // Windows: use wmic command
        const { stdout } = await execAsync(
          "wmic logicaldisk get size,freespace,caption",
        );
        const lines = stdout.split("\n").filter((line) => line.trim());

        // Parse the output (this is simplified - may need adjustment)
        const total = parseInt(lines[1]?.split(/\s+/)[2] || "0");
        const free = parseInt(lines[1]?.split(/\s+/)[1] || "0");
        const used = total - free;

        return {
          total,
          used,
          free,
          percentage:
            total > 0 ? parseFloat(((used / total) * 100).toFixed(2)) : 0,
          path: diskPath,
        };
      } else {
        // Unix-like systems: use df command
        const { stdout } = await execAsync(`df -k "${diskPath}" | tail -1`);
        const parts = stdout.trim().split(/\s+/);

        // df output: filesystem 1K-blocks used available use% mounted
        const total = parseInt(parts[1] || "0") * 1024;
        const used = parseInt(parts[2] || "0") * 1024;
        const available = parseInt(parts[3] || "0") * 1024;
        const percentage = parseInt(parts[4]?.replace("%", "") || "0");

        return {
          total,
          used,
          free: available,
          percentage,
          path: diskPath,
        };
      }
    } catch (_error) {
      console.error("Failed to get disk metrics:", _error);
      // Return zeros if we can't get disk stats
      return {
        total: 0,
        used: 0,
        free: 0,
        percentage: 0,
        path: diskPath,
      };
    }
  }

  /**
   * Get network interface information
   */
  private getNetworkMetrics(): SystemMetrics["network"] {
    const networkInterfaces = os.networkInterfaces();
    const interfaces: NetworkInterface[] = [];

    for (const [name, nets] of Object.entries(networkInterfaces)) {
      if (nets) {
        for (const net of nets) {
          interfaces.push({
            name,
            address: net.address,
            family: net.family,
            internal: net.internal,
          });
        }
      }
    }

    return { interfaces };
  }

  /**
   * Get current process metrics
   */
  private getProcessMetrics(): SystemMetrics["process"] {
    return {
      pid: process.pid,
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
    };
  }

  /**
   * Check dependency health (database, Redis, external APIs, etc.)
   */
  async checkDependencies(
    dependencies: {
      name: string;
      check: () => Promise<boolean>;
    }[],
  ): Promise<DependencyHealth[]> {
    const results: DependencyHealth[] = [];

    for (const dep of dependencies) {
      const startTime = Date.now();
      try {
        const isHealthy = await dep.check();
        results.push({
          name: dep.name,
          status: isHealthy ? "connected" : "disconnected",
          responseTime: Date.now() - startTime,
        });
      } catch (_error) {
        results.push({
          name: dep.name,
          status: "error",
          responseTime: Date.now() - startTime,
          error: _error instanceof Error ? _error.message : "Unknown error",
        });
      }
    }

    return results;
  }

  /**
   * Run custom health checks
   */
  async runCustomChecks(
    checks: CustomHealthCheck[],
  ): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const check of checks) {
      try {
        const result = await check.check();
        results.push(result);
      } catch (_error) {
        results.push({
          name: check.name,
          status: "unhealthy",
          message: _error instanceof Error ? _error.message : "Check failed",
        });
      }
    }

    return results;
  }

  /**
   * Get metrics history for graphs
   */
  getMetricsHistory(): {
    cpu: number[];
    memory: number[];
  } {
    return {
      cpu: [...this.cpuUsageHistory],
      memory: [...this.memoryUsageHistory],
    };
  }

  /**
   * Start collecting metrics periodically for history
   */
  private startMetricsCollection(): void {
    // Collect metrics every 5 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getMetrics();

        // Add to history
        this.cpuUsageHistory.push(metrics.cpu.usage);
        this.memoryUsageHistory.push(metrics.memory.percentage);

        // Keep only last N data points
        if (this.cpuUsageHistory.length > this.historySize) {
          this.cpuUsageHistory.shift();
        }
        if (this.memoryUsageHistory.length > this.historySize) {
          this.memoryUsageHistory.shift();
        }
      } catch (_error) {
        console.error("Failed to collect metrics:", _error);
      }
    }, 5000);
  }

  /**
   * Stop metrics collection (for cleanup)
   */
  stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
  }
}

/**
 * Create health check router for Express apps
 */
export function createHealthCheckRouter(options?: {
  version?: string;
  customChecks?: CustomHealthCheck[];
  dependencies?: Array<{ name: string; check: () => Promise<boolean> }>;
}): Router {
  const router = Router();
  const healthService = HealthCheckService.getInstance();

  // Basic health endpoint
  router.get("/health", async (_req: Request, res: Response) => {
    try {
      const health = await healthService.getHealth(options?.version);

      // Run custom checks if provided
      if (options?.customChecks && options.customChecks.length > 0) {
        const customResults = await Promise.all(
          options.customChecks.map((check) => check.check()),
        );

        // Add custom check results to health object
        (health as any).checks = customResults;

        // Update overall status based ONLY on custom checks
        const hasUnhealthy = customResults.some(
          (r) => r.status === "unhealthy",
        );
        const hasDegraded = customResults.some((r) => r.status === "degraded");

        if (hasUnhealthy) {
          health.status = "unhealthy";
        } else if (hasDegraded) {
          health.status = "degraded";
        }
        // Otherwise keep default 'healthy' status
      }

      const statusCode =
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 200
            : 503;
      res.status(statusCode).json(health);
    } catch (_error) {
      res.status(503).json({
        status: "unhealthy",
        error: "Failed to get health status",
      });
    }
  });

  // Detailed metrics endpoint
  router.get("/metrics", async (_req: Request, res: Response) => {
    try {
      const metrics = await healthService.getMetrics();
      res.json(metrics);
    } catch (_error) {
      res.status(500).json({
        error: "Failed to get metrics",
      });
    }
  });

  // Metrics history for graphs
  router.get("/metrics/history", (_req: Request, res: Response) => {
    const history = healthService.getMetricsHistory();
    res.json(history);
  });

  // Dependency health checks
  if (options?.dependencies) {
    router.get("/health/dependencies", async (_req: Request, res: Response) => {
      try {
        const results = await healthService.checkDependencies(
          options.dependencies!,
        );
        const allHealthy = results.every((r) => r.status === "connected");
        res.status(allHealthy ? 200 : 503).json(results);
      } catch (_error) {
        res.status(500).json({
          error: "Failed to check dependencies",
        });
      }
    });
  }

  // Custom health checks
  if (options?.customChecks) {
    router.get("/health/custom", async (_req: Request, res: Response) => {
      try {
        const results = await healthService.runCustomChecks(
          options.customChecks!,
        );
        const allHealthy = results.every((r) => r.status === "healthy");
        res.status(allHealthy ? 200 : 503).json(results);
      } catch (_error) {
        res.status(500).json({
          error: "Failed to run custom checks",
        });
      }
    });
  }

  return router;
}

// Export singleton instance getter
export function getHealthCheckService(): HealthCheckService {
  return HealthCheckService.getInstance();
}

// Export types
export type { HealthCheckService };
