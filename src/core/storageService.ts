/**
 * Storage Service
 * Unified service for secure file operations, user uploads, and internal data storage
 * Provides path sanitization, validation, and consistent file handling
 */

import path from 'path';
import fs from 'fs-extra';
import { createLogger } from './index.js';
import crypto from 'crypto';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('StorageService');
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

export interface FileUploadOptions {
  maxSize?: number; // bytes
  allowedTypes?: string[]; // file extensions
  destination?: string;
  generateUniqueName?: boolean;
  preserveExtension?: boolean;
}

export interface UploadedFile {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype?: string;
  extension: string;
  hash?: string;
}

export class StorageService {
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
      // Storage service initialized
    } catch (_error) {
      ensureLogger().error('Failed to initialize storage service:', _error);
      throw _error;
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
    } catch (_error) {
      ensureLogger().error('Error validating path safety:', _error);
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
    content: string | Buffer,
    filename: string,
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
    } catch (_error) {
      ensureLogger().error(`Error listing files in ${category}:`, _error);
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

  /**
   * Save a user upload with security checks
   * @param file - File buffer or stream
   * @param originalName - Original filename from user
   * @param options - Upload options
   * @returns Information about the uploaded file
   */
  async saveUserUpload(
    file: Buffer | NodeJS.ReadableStream,
    originalName: string,
    options: FileUploadOptions = {}
  ): Promise<UploadedFile> {
    await this.initialize();

    const {
      maxSize = this.maxFileSize,
      allowedTypes = [],
      destination = 'uploads',
      generateUniqueName = true,
      preserveExtension = true
    } = options;

    // Sanitize the original filename
    const sanitizedName = this.sanitizeFilename(originalName);
    const ext = path.extname(sanitizedName).toLowerCase();
    const nameWithoutExt = path.basename(sanitizedName, ext);

    // Check file extension if restrictions are specified
    if (allowedTypes.length > 0 && !allowedTypes.includes(ext)) {
      throw new Error(`File type ${ext} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Generate filename
    let filename: string;
    if (generateUniqueName) {
      const uniqueId = crypto.randomBytes(8).toString('hex');
      filename = preserveExtension ? `${nameWithoutExt}_${uniqueId}${ext}` : `${uniqueId}`;
    } else {
      filename = sanitizedName;
    }

    // Determine the upload path
    const uploadPath = this.getSafePath(filename, destination as BaseDirectory);

    // Save the file
    if (Buffer.isBuffer(file)) {
      // Check size for buffer
      if (file.length > maxSize) {
        throw new Error(`File size exceeds maximum allowed size of ${maxSize} bytes`);
      }
      await fs.writeFile(uploadPath, file);
    } else {
      // For streams, we need to check size while writing
      const writeStream = fs.createWriteStream(uploadPath);
      let size = 0;

      await new Promise((resolve, reject) => {
        file.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxSize) {
            writeStream.destroy();
            fs.unlink(uploadPath).catch(() => {}); // Clean up partial file
            reject(new Error(`File size exceeds maximum allowed size of ${maxSize} bytes`));
          }
        });

        file.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', () => resolve(undefined));

        file.pipe(writeStream);
      });
    }

    // Generate file hash
    const fileBuffer = await fs.readFile(uploadPath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Get file stats
    const stats = await fs.stat(uploadPath);

    const uploadedFile: UploadedFile = {
      originalName,
      filename,
      path: uploadPath,
      size: stats.size,
      extension: ext,
      hash
    };

    ensureLogger().info('User file uploaded successfully', {
      originalName,
      filename,
      size: stats.size,
      hash
    });

    return uploadedFile;
  }

  /**
   * Save internal application data
   * @param data - Data to save
   * @param filename - Filename for the data
   * @param category - Category/directory for the data
   * @param options - Save options
   */
  async saveInternalData(
    data: string | Buffer | object,
    filename: string,
    category: BaseDirectory = 'data',
    options: SaveOptions = {}
  ): Promise<FileInfo> {
    // If data is an object, stringify it
    const finalData = typeof data === 'object' && !Buffer.isBuffer(data)
      ? JSON.stringify(data, null, 2)
      : data;

    // Use the existing save method
    return this.saveFile(finalData as string | Buffer, filename, category, options);
  }
}

// Singleton instance
let storageService: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = new StorageService();
  }
  return storageService;
}

// Backward compatibility export (deprecated)
export function getSecureFileHandler(): StorageService {
  console.warn('getSecureFileHandler is deprecated. Use getStorageService instead.');
  return getStorageService();
}

// Export for backward compatibility (deprecated)
export { StorageService as SecureFileHandler };

export default StorageService;
