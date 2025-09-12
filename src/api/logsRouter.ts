/**
 * Standardized Logging API Router
 * Provides consistent logging endpoints for all EpiSensor applications
 */

import express, { Request, Response } from "express";
import { getLogger } from "../core/logger.js";
import path from "path";
import fs from "fs/promises";
import { existsSync, createReadStream } from "fs";

const router = express.Router();

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
  metadata?: any;
}

export interface LogFile {
  name: string;
  size: number;
  modified: string;
  path?: string;
}

/**
 * Get recent log entries
 * GET /api/logs/entries?limit=100&level=info
 */
router.get("/entries", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const level = (req.query.level as string) || "all";

    const logger = getLogger;
    const logs = await logger.getRecentLogs(limit, level);

    res.json({
      success: true,
      logs: logs || [],
    });
  } catch (_error) {
    console.error("Failed to fetch log entries:", _error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch log entries",
      logs: [],
    });
  }
});

/**
 * Get log files list
 * GET /api/logs/files
 */
router.get("/files", async (_req: Request, res: Response) => {
  try {
    const logsDir = path.join(process.cwd(), "data", "logs");

    if (!existsSync(logsDir)) {
      res.json({
        success: true,
        files: [],
      });
      return;
    }

    const files = await fs.readdir(logsDir);
    const logFiles: LogFile[] = [];

    for (const file of files) {
      if (file.endsWith(".log") || file.endsWith(".txt")) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);

        logFiles.push({
          name: file,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          path: filePath,
        });
      }
    }

    // Sort by modified date, newest first
    logFiles.sort(
      (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime(),
    );

    res.json({
      success: true,
      files: logFiles,
    });
  } catch (_error) {
    console.error("Failed to fetch log files:", _error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch log files",
      files: [],
    });
  }
});

/**
 * Download a specific log file
 * GET /api/logs/download/:filename
 */
router.get("/download/:filename", async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const logsDir = path.join(process.cwd(), "data", "logs");
    const filePath = path.join(logsDir, filename);

    // Security check - prevent directory traversal
    if (!filePath.startsWith(logsDir)) {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
      return;
    }

    if (!existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: "File not found",
      });
      return;
    }

    res.download(filePath);
  } catch (_error) {
    console.error("Failed to download log file:", _error);
    res.status(500).json({
      success: false,
      error: "Failed to download log file",
    });
  }
});

/**
 * Stream log file content
 * GET /api/logs/stream/:filename
 */
router.get("/stream/:filename", async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const logsDir = path.join(process.cwd(), "data", "logs");
    const filePath = path.join(logsDir, filename);

    // Security check
    if (!filePath.startsWith(logsDir)) {
      res.status(403).json({
        success: false,
        error: "Access denied",
      });
      return;
    }

    if (!existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: "File not found",
      });
      return;
    }

    res.setHeader("Content-Type", "text/plain");
    const stream = createReadStream(filePath);
    stream.pipe(res);
  } catch (_error) {
    console.error("Failed to stream log file:", _error);
    res.status(500).json({
      success: false,
      error: "Failed to stream log file",
    });
  }
});

/**
 * Clear log files
 * POST /api/logs/clear
 */
router.post("/clear", async (_req: Request, res: Response) => {
  try {
    const logger = getLogger;
    await logger.clearLogs();

    res.json({
      success: true,
      message: "Logs cleared successfully",
    });
  } catch (_error) {
    console.error("Failed to clear logs:", _error);
    res.status(500).json({
      success: false,
      error: "Failed to clear logs",
    });
  }
});

/**
 * Get archived log files
 * GET /api/logs/archives
 */
router.get("/archives", async (_req: Request, res: Response) => {
  try {
    const logsDir = path.join(process.cwd(), "data", "logs");

    if (!existsSync(logsDir)) {
      return res.json({
        success: true,
        archives: [],
      });
    }

    const files = await fs.readdir(logsDir);
    const archives: LogFile[] = [];

    for (const file of files) {
      if (file.endsWith(".log") || file.endsWith(".txt")) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);
        archives.push({
          name: file,
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    }

    // Sort by modified date, newest first
    archives.sort(
      (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime(),
    );

    return res.json({
      success: true,
      archives,
    });
  } catch (_error) {
    console.error("Failed to fetch archives:", _error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch archives",
      archives: [],
    });
  }
});

/**
 * Delete specific archive
 * DELETE /api/logs/archive/:filename
 */
router.delete("/archive/:filename", async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const logsDir = path.join(process.cwd(), "data", "logs");
    const filePath = path.join(logsDir, filename);

    // Security check
    if (!filePath.startsWith(logsDir) || filename.includes("..")) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    if (!existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: "Archive not found",
      });
    }

    await fs.unlink(filePath);

    return res.json({
      success: true,
      message: "Archive deleted successfully",
    });
  } catch (_error) {
    console.error("Failed to delete archive:", _error);
    return res.status(500).json({
      success: false,
      error: "Failed to delete archive",
    });
  }
});

/**
 * Export logs as text (always)
 * GET /api/logs/export?level=all
 */
router.get("/export", async (req: Request, res: Response) => {
  try {
    const level = (req.query.level as string) || "all";

    const logger = getLogger;
    const logs = await logger.getRecentLogs(10000, level); // Get up to 10k entries for export

    // Sort newest first
    const sortedLogs = logs.sort(
      (a: LogEntry, b: LogEntry) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `logs-${timestamp}.txt`;

    // Always export as text
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const textLogs = sortedLogs
      .map(
        (log: LogEntry) =>
          `[${log.timestamp}] [${log.level.toUpperCase()}]${log.source ? ` [${log.source}]` : ""} ${log.message}`,
      )
      .join("\n");

    res.send(textLogs);
  } catch (_error) {
    console.error("Failed to export logs:", _error);
    res.status(500).json({
      success: false,
      error: "Failed to export logs",
    });
  }
});

/**
 * Get log statistics
 * GET /api/logs/stats
 */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const logsDir = path.join(process.cwd(), "data", "logs");

    if (!existsSync(logsDir)) {
      res.json({
        success: true,
        stats: {
          totalSize: 0,
          fileCount: 0,
          oldestLog: null,
          newestLog: null,
        },
      });
      return;
    }

    const files = await fs.readdir(logsDir);
    let totalSize = 0;
    let oldestTime: Date | null = null;
    let newestTime: Date | null = null;
    let fileCount = 0;

    for (const file of files) {
      if (file.endsWith(".log") || file.endsWith(".txt")) {
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);

        totalSize += stats.size;
        fileCount++;

        if (!oldestTime || stats.birthtime < oldestTime) {
          oldestTime = stats.birthtime;
        }
        if (!newestTime || stats.mtime > newestTime) {
          newestTime = stats.mtime;
        }
      }
    }

    res.json({
      success: true,
      stats: {
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        fileCount,
        oldestLog: oldestTime?.toISOString() || null,
        newestLog: newestTime?.toISOString() || null,
      },
    });
  } catch (_error) {
    console.error("Failed to get log stats:", _error);
    res.status(500).json({
      success: false,
      error: "Failed to get log statistics",
    });
  }
});

/**
 * Compact logs - Archive old logs
 * POST /api/logs/compact
 */
router.post("/compact", async (req: Request, res: Response) => {
  try {
    const { days = 7 } = req.body;
    const logger = getLogger;

    const stats = await logger.compactLogs(days);

    res.json({
      success: true,
      stats,
      message: `Logs older than ${days} days have been archived`,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error:
        _error instanceof Error
          ? _error.message
          : String(_error) || "Failed to compact logs",
    });
  }
});

/**
 * Clean up zero-length files
 * POST /api/logs/cleanup-zero
 */
router.post("/cleanup-zero", async (_req: Request, res: Response) => {
  try {
    const logger = getLogger;
    const result = await logger.cleanupZeroFiles();

    res.json({
      success: true,
      ...result,
      message: `Removed ${result.removed} zero-length files`,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error:
        _error instanceof Error
          ? _error.message
          : String(_error) || "Failed to cleanup logs",
    });
  }
});

/**
 * Purge all logs (dangerous)
 * POST /api/logs/purge-all
 */
router.post("/purge-all", async (_req: Request, res: Response) => {
  try {
    const logger = getLogger;
    await logger.purgeAllLogs();

    res.json({
      success: true,
      message: "All logs have been purged",
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error:
        _error instanceof Error
          ? _error.message
          : String(_error) || "Failed to purge logs",
    });
  }
});

/**
 * Get all log files including archives
 * GET /api/logs/all-files
 */
router.get("/all-files", async (_req: Request, res: Response) => {
  try {
    const logger = getLogger;
    const files = await logger.getAllLogFiles();

    res.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error:
        _error instanceof Error
          ? _error.message
          : String(_error) || "Failed to list log files",
      files: [],
    });
  }
});

/**
 * Download any log file (including archives)
 * GET /api/logs/download-any/:filename
 */
router.get(
  "/download-any/:filename(*)",
  async (req: Request, res: Response) => {
    try {
      const { filename } = req.params;

      // Security: prevent directory traversal
      const safeName = path.basename(filename);

      // Check in logs directory first
      const logsDir = path.join(process.cwd(), "data", "logs");
      let filePath = path.join(logsDir, safeName);

      // If not found, check in archive directory
      if (!existsSync(filePath)) {
        filePath = path.join(logsDir, "archive", safeName);
      }

      // If still not found and filename includes 'archive/', handle that case
      if (!existsSync(filePath) && filename.startsWith("archive/")) {
        const archiveName = filename.replace("archive/", "");
        filePath = path.join(logsDir, "archive", archiveName);
      }

      if (!existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: "File not found",
        });
      }

      // Set appropriate headers for download
      const isCompressed = filePath.endsWith(".gz");
      if (isCompressed) {
        res.setHeader("Content-Type", "application/gzip");
      } else {
        res.setHeader("Content-Type", "text/plain");
      }

      return res.download(filePath, safeName);
    } catch (_error) {
      return res.status(500).json({
        success: false,
        error:
          _error instanceof Error
            ? _error.message
            : String(_error) || "Failed to download file",
      });
    }
  },
);

/**
 * Force log rotation
 * POST /api/logs/rotate
 */
router.post("/rotate", async (_req: Request, res: Response) => {
  try {
    const logger = getLogger;

    // Get all logger instances and force rotation
    const loggers = logger.getLoggers();
    for (const [, winstonLogger] of loggers) {
      // Find rotate transport and trigger rotation
      winstonLogger.transports.forEach((transport: any) => {
        if (transport.rotate && typeof transport.rotate === "function") {
          transport.rotate();
        }
      });
    }

    res.json({
      success: true,
      message: "Log rotation triggered",
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error:
        _error instanceof Error
          ? _error.message
          : String(_error) || "Failed to rotate logs",
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export default router;
