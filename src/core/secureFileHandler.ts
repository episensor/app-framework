/**
 * Secure File Handler Service
 * Provides secure file operations with path sanitization and validation
 */

import path from 'path';
import fs from 'fs-extra';
import { createLogger } from './index.js';
import crypto from 'crypto';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('SecureFileHandler');
  }
  return logger;
}

// Define safe base directories
const DATA_DIR = path.join(process.cwd(), 'data');
const BASE_DIRS = {
  attachments: path.join(DATA_DIR, 'uploads', 'attachments'),
  data: DATA_DIR,
  templates: path.join(DATA_DIR, 'templates'),
  uploads: path.join(DATA_DIR, 'uploads'),
  logs: path.join(DATA_DIR, 'logs'),
  config: path.join(DATA_DIR, 'config')
} as const;

export type BaseDirectory = keyof typeof BASE_DIRS;

export interface FileInfo {
  name: string;
  size: number;
  path: string;
  mimeType?: string;
  hash?: string;
  created?: Date;
  modified?: Date;
}

export interface SaveOptions {
  overwrite?: boolean;
  createBackup?: boolean;
  validateContent?: boolean;
}

export interface ReadOptions {
  encoding?: BufferEncoding;
  maxSize?: number;
}

export class SecureFileHandler {
  private initialized: boolean = false;
  private readonly maxFileSize: number = 100 * 1024 * 1024; // 100MB

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure all base directories exist
      for (const dir of Object.values(BASE_DIRS)) {
        await fs.ensureDir(dir);
      }

      // Ensure .gitignore exists in attachments and data directories
      const gitignoreContent = '*\n!.gitignore\n';
      await fs.writeFile(path.join(BASE_DIRS.attachments, '.gitignore'), gitignoreContent);
      await fs.writeFile(path.join(BASE_DIRS.data, '.gitignore'), gitignoreContent);

      this.initialized = true;
      // Secure file handler initialized
    } catch (error) {
      ensureLogger().error('Failed to initialize secure file handler:', error);
      throw error;
    }
  }

  /**
   * Sanitize a filename to prevent path traversal attacks
   */
  sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Invalid filename provided');
    }

    // Remove any path components and keep only the basename
    let sanitized = path.basename(filename);

    // Remove any remaining special characters that could cause issues
    sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Ensure the filename is not empty after sanitization
    if (!sanitized || sanitized === '.' || sanitized === '..') {
      sanitized = `file_${Date.now()}`;
    }

    // Limit filename length
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      sanitized = name.substring(0, 255 - ext.length) + ext;
    }

    return sanitized;
  }

  /**
   * Validate that a path is within the allowed base directory
   */
  isPathSafe(filePath: string, baseDir: string): boolean {
    try {
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(baseDir);
      return resolvedPath.startsWith(resolvedBase);
    } catch (error) {
      ensureLogger().error('Error validating path safety:', error);
      return false;
    }
  }

  /**
   * Get the full safe path for a file
   */
  getSafePath(filename: string, category: BaseDirectory = 'data'): string {
    const sanitizedName = this.sanitizeFilename(filename);
    const baseDir = BASE_DIRS[category];
    const fullPath = path.join(baseDir, sanitizedName);

    if (!this.isPathSafe(fullPath, baseDir)) {
      throw new Error('Invalid file path detected');
    }

    return fullPath;
  }

  /**
   * Save a file securely
   */
  async saveFile(
    filename: string,
    content: string | Buffer,
    category: BaseDirectory = 'data',
    options: SaveOptions = {}
  ): Promise<FileInfo> {
    await this.initialize();

    const safePath = this.getSafePath(filename, category);

    // Check if file exists and handle accordingly
    if (await fs.pathExists(safePath)) {
      if (!options.overwrite) {
        throw new Error(`File already exists: ${filename}`);
      }
      if (options.createBackup) {
        const backupPath = `${safePath}.backup.${Date.now()}`;
        await fs.copy(safePath, backupPath);
        ensureLogger().info(`Created backup: ${backupPath}`);
      }
    }

    // Validate content size
    const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content);
    if (size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    // Save the file
    await fs.writeFile(safePath, content);
    
    // Calculate hash
    const hash = crypto
      .createHash('sha256')
      .update(Buffer.isBuffer(content) ? content : Buffer.from(content))
      .digest('hex');

    const stats = await fs.stat(safePath);

    ensureLogger().debug(`File saved: ${safePath} (${size} bytes)`);

    return {
      name: filename,
      size,
      path: safePath,
      hash,
      created: stats.birthtime,
      modified: stats.mtime
    };
  }

  /**
   * Read a file securely
   */
  async readFile(
    filename: string,
    category: BaseDirectory = 'data',
    options: ReadOptions = {}
  ): Promise<string | Buffer> {
    await this.initialize();

    const safePath = this.getSafePath(filename, category);

    // Check if file exists
    if (!await fs.pathExists(safePath)) {
      throw new Error(`File not found: ${filename}`);
    }

    // Check file size
    const stats = await fs.stat(safePath);
    const maxSize = options.maxSize || this.maxFileSize;
    
    if (stats.size > maxSize) {
      throw new Error(`File size (${stats.size}) exceeds maximum allowed size (${maxSize})`);
    }

    // Read the file
    const content = options.encoding 
      ? await fs.readFile(safePath, options.encoding)
      : await fs.readFile(safePath);

    ensureLogger().debug(`File read: ${safePath} (${stats.size} bytes)`);

    return content;
  }

  /**
   * Delete a file securely
   */
  async deleteFile(filename: string, category: BaseDirectory = 'data'): Promise<boolean> {
    await this.initialize();

    const safePath = this.getSafePath(filename, category);

    if (!await fs.pathExists(safePath)) {
      ensureLogger().warn(`File not found for deletion: ${filename}`);
      return false;
    }

    await fs.unlink(safePath);
    ensureLogger().debug(`File deleted: ${safePath}`);
    return true;
  }

  /**
   * List files in a category
   */
  async listFiles(category: BaseDirectory = 'data', pattern?: RegExp): Promise<FileInfo[]> {
    await this.initialize();

    const baseDir = BASE_DIRS[category];
    const files: FileInfo[] = [];

    try {
      const entries = await fs.readdir(baseDir);

      for (const entry of entries) {
        if (pattern && !pattern.test(entry)) continue;
        
        const fullPath = path.join(baseDir, entry);
        const stats = await fs.stat(fullPath);

        if (stats.isFile()) {
          files.push({
            name: entry,
            size: stats.size,
            path: fullPath,
            created: stats.birthtime,
            modified: stats.mtime
          });
        }
      }
    } catch (error) {
      ensureLogger().error(`Error listing files in ${category}:`, error);
    }

    return files;
  }

  /**
   * Get file info
   */
  async getFileInfo(filename: string, category: BaseDirectory = 'data'): Promise<FileInfo | null> {
    await this.initialize();

    const safePath = this.getSafePath(filename, category);

    if (!await fs.pathExists(safePath)) {
      return null;
    }

    const stats = await fs.stat(safePath);

    return {
      name: filename,
      size: stats.size,
      path: safePath,
      created: stats.birthtime,
      modified: stats.mtime
    };
  }

  /**
   * Move file between categories
   */
  async moveFile(
    filename: string,
    fromCategory: BaseDirectory,
    toCategory: BaseDirectory
  ): Promise<FileInfo> {
    await this.initialize();

    const sourcePath = this.getSafePath(filename, fromCategory);
    const destPath = this.getSafePath(filename, toCategory);

    if (!await fs.pathExists(sourcePath)) {
      throw new Error(`Source file not found: ${filename}`);
    }

    await fs.move(sourcePath, destPath, { overwrite: false });
    
    const stats = await fs.stat(destPath);

    ensureLogger().debug(`File moved from ${fromCategory} to ${toCategory}: ${filename}`);

    return {
      name: filename,
      size: stats.size,
      path: destPath,
      created: stats.birthtime,
      modified: stats.mtime
    };
  }

  /**
   * Get available base directories
   */
  getBaseDirectories(): Record<BaseDirectory, string> {
    return { ...BASE_DIRS };
  }
}

// Singleton instance
let secureFileHandler: SecureFileHandler | null = null;

export function getSecureFileHandler(): SecureFileHandler {
  if (!secureFileHandler) {
    secureFileHandler = new SecureFileHandler();
  }
  return secureFileHandler;
}

export default SecureFileHandler;
