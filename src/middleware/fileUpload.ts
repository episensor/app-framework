/**
 * File Upload Middleware
 * Simple file upload handling for Express
 */

import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import { getStorageService } from "../core/storageService.js";
import { createLogger } from "../core/index.js";

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger("FileUpload");
  }
  return logger;
}

export interface FileUploadConfig {
  destination?: string;
  maxSize?: number;
  allowedTypes?: string[];
  fieldName?: string;
  multiple?: boolean;
  maxCount?: number;
}

/**
 * Create file upload middleware
 */
export function createFileUpload(config: FileUploadConfig = {}) {
  const {
    destination = "uploads",
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    fieldName = "file",
    multiple = false,
    maxCount = 10,
  } = config;

  // Configure multer storage
  const storage = multer.memoryStorage();

  // Configure multer
  const upload = multer({
    storage,
    limits: {
      fileSize: maxSize,
      files: maxCount,
    },
    fileFilter: (_req, file, cb) => {
      // Check file type if restrictions are set
      if (allowedTypes.length > 0) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedTypes.includes(ext)) {
          return cb(new Error(`File type ${ext} not allowed`));
        }
      }
      cb(null, true);
    },
  });

  // Return appropriate middleware
  const multerMiddleware = multiple
    ? upload.array(fieldName, maxCount)
    : upload.single(fieldName);

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    multerMiddleware(req, res, async (err) => {
      if (err) {
        ensureLogger().error("Upload error:", err);

        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({
              success: false,
              error: "File too large",
              message: `File size exceeds maximum of ${maxSize} bytes`,
            });
            return;
          }
          if (err.code === "LIMIT_FILE_COUNT") {
            res.status(400).json({
              success: false,
              error: "Too many files",
              message: `Maximum ${maxCount} files allowed`,
            });
            return;
          }
        }

        res.status(400).json({
          success: false,
          error: "Upload failed",
          message: err.message,
        });
        return;
      }

      // Process uploaded files via StorageService to keep a single path for uploads
      try {
        const storage = getStorageService();

        if (multiple && req.files && Array.isArray(req.files)) {
          // Multiple files
          const uploadedFiles = [];

          for (const file of req.files) {
            const uploaded = await storage.saveUserUpload(
              file.buffer,
              file.originalname,
              {
                allowedTypes,
                maxSize,
                destination,
              },
            );
            uploadedFiles.push({
              ...uploaded,
              mimetype: file.mimetype,
            });
          }

          req.uploadedFiles = uploadedFiles;
          ensureLogger().info(`Uploaded ${uploadedFiles.length} files`);
        } else if (req.file) {
          // Single file
          const uploaded = await storage.saveUserUpload(
            req.file.buffer,
            req.file.originalname,
            {
              allowedTypes,
              maxSize,
              destination,
            },
          );

          req.uploadedFile = {
            ...uploaded,
            mimetype: req.file.mimetype,
          };
          ensureLogger().info(`Uploaded file: ${uploaded.filename}`);
        }

        next();
      } catch (_error: any) {
        ensureLogger().error("File processing error:", _error);
        res.status(500).json({
          success: false,
          error: "File processing failed",
          message: _error.message,
        });
      }
    });
  };
}

/**
 * Parse form data middleware (for mixed file/data uploads)
 */
export function parseFormData(fields: string[] = []) {
  const upload = multer();
  return upload.fields(fields.map((field) => ({ name: field })));
}

/**
 * Download file helper
 */
export function sendFile(filePath: string, filename?: string) {
  return (_req: Request, res: Response) => {
    const resolvedPath = path.resolve(filePath);
    const downloadName = filename || path.basename(filePath);

    res.download(resolvedPath, downloadName, (err) => {
      if (err) {
        ensureLogger().error("Download error:", err);
        if (!res.headersSent) {
          res.status(404).json({
            success: false,
            error: "File not found",
          });
        }
      }
    });
  };
}

/**
 * Express middleware to clean old temp files periodically
 */
export function createTempCleaner(
  tempDir: string = "./temp",
  maxAge: number = 24 * 60 * 60 * 1000, // 24 hours
  interval: number = 60 * 60 * 1000, // 1 hour
) {
  const storage = getStorageService();

  // Start periodic cleaning
  setInterval(async () => {
    try {
      const deleted = await storage.cleanTempFiles(maxAge, tempDir);
      if (deleted > 0) {
        ensureLogger().info(`Cleaned ${deleted} old temporary files`);
      }
    } catch (_error: any) {
      ensureLogger().error("Temp file cleanup error:", _error);
    }
  }, interval);

  // Return middleware that does nothing (just starts the cleaner)
  return (_req: Request, _res: Response, next: NextFunction) => next();
}

// Extend Express Request type
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      uploadedFile?: {
        originalName: string;
        filename: string;
        path: string;
        size: number;
        mimetype?: string;
        extension: string;
        hash?: string;
      };
      uploadedFiles?: Array<{
        originalName: string;
        filename: string;
        path: string;
        size: number;
        mimetype?: string;
        extension: string;
        hash?: string;
      }>;
    }
  }
}

export default {
  createFileUpload,
  parseFormData,
  sendFile,
  createTempCleaner,
};
