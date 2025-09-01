/**
 * File Handler Service
 * Simple, practical file handling for desktop applications
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createLogger } from '../core/index.js';

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('FileHandler');
  }
  return logger;
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

export class FileHandler {
  private uploadDir: string;
  private tempDir: string;
  private maxFileSize: number;

  constructor(
    uploadDir: string = './uploads',
    tempDir: string = './temp',
    maxFileSize: number = 50 * 1024 * 1024 // 50MB default
  ) {
    this.uploadDir = path.resolve(uploadDir);
    this.tempDir = path.resolve(tempDir);
    this.maxFileSize = maxFileSize;

    // Ensure directories exist
    this.ensureDirectory(this.uploadDir);
    this.ensureDirectory(this.tempDir);
  }

  /**
   * Save uploaded file with validation
   */
  async saveUpload(
    fileBuffer: Buffer,
    originalName: string,
    options: FileUploadOptions = {}
  ): Promise<UploadedFile> {
    const {
      maxSize = this.maxFileSize,
      allowedTypes = [],
      destination = this.uploadDir,
      generateUniqueName = true,
      preserveExtension = true
    } = options;

    // Validate size
    if (fileBuffer.length > maxSize) {
      throw new Error(`File size (${fileBuffer.length} bytes) exceeds maximum allowed (${maxSize} bytes)`);
    }

    // Get file extension
    const extension = path.extname(originalName).toLowerCase();
    const nameWithoutExt = path.basename(originalName, extension);

    // Validate file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(extension)) {
      throw new Error(`File type ${extension} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Generate filename
    let filename: string;
    if (generateUniqueName) {
      const uniqueId = crypto.randomBytes(8).toString('hex');
      filename = `${this.sanitizeFilename(nameWithoutExt)}_${uniqueId}${preserveExtension ? extension : ''}`;
    } else {
      filename = this.sanitizeFilename(originalName);
    }

    // Ensure destination directory exists
    this.ensureDirectory(destination);

    // Full file path
    const filePath = path.join(destination, filename);

    // Calculate file hash
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Save file
    await fs.promises.writeFile(filePath, fileBuffer);

    ensureLogger().info(`File saved: ${filename} (${fileBuffer.length} bytes)`);

    return {
      originalName,
      filename,
      path: filePath,
      size: fileBuffer.length,
      extension,
      hash
    };
  }

  /**
   * Read file safely
   */
  async readFile(filePath: string): Promise<Buffer> {
    const resolvedPath = path.resolve(filePath);
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Check file size before reading
    const stats = await fs.promises.stat(resolvedPath);
    if (stats.size > this.maxFileSize) {
      throw new Error(`File too large to read: ${stats.size} bytes`);
    }

    return fs.promises.readFile(resolvedPath);
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    const resolvedPath = path.resolve(filePath);
    
    if (fs.existsSync(resolvedPath)) {
      await fs.promises.unlink(resolvedPath);
      ensureLogger().info(`File deleted: ${filePath}`);
    }
  }

  /**
   * Move file
   */
  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    const resolvedSource = path.resolve(sourcePath);
    const resolvedDest = path.resolve(destPath);

    // Ensure destination directory exists
    this.ensureDirectory(path.dirname(resolvedDest));

    await fs.promises.rename(resolvedSource, resolvedDest);
    ensureLogger().info(`File moved: ${sourcePath} -> ${destPath}`);
  }

  /**
   * Copy file
   */
  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    const resolvedSource = path.resolve(sourcePath);
    const resolvedDest = path.resolve(destPath);

    // Ensure destination directory exists
    this.ensureDirectory(path.dirname(resolvedDest));

    await fs.promises.copyFile(resolvedSource, resolvedDest);
    ensureLogger().info(`File copied: ${sourcePath} -> ${destPath}`);
  }

  /**
   * List files in directory
   */
  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    const resolvedPath = path.resolve(dirPath);
    
    if (!fs.existsSync(resolvedPath)) {
      return [];
    }

    const files = await fs.promises.readdir(resolvedPath);
    
    if (extension) {
      return files.filter(file => path.extname(file).toLowerCase() === extension.toLowerCase());
    }

    return files;
  }

  /**
   * Clean temporary files older than specified age
   */
  async cleanTempFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    const now = Date.now();
    let deletedCount = 0;

    try {
      const files = await fs.promises.readdir(this.tempDir);
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (now - stats.mtimeMs > maxAgeMs) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        ensureLogger().info(`Cleaned ${deletedCount} temporary files`);
      }
    } catch (error: any) {
      ensureLogger().error('Error cleaning temp files:', error);
    }

    return deletedCount;
  }

  /**
   * Get file info
   */
  async getFileInfo(filePath: string): Promise<{
    exists: boolean;
    size?: number;
    created?: Date;
    modified?: Date;
    isDirectory?: boolean;
  }> {
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      return { exists: false };
    }

    const stats = await fs.promises.stat(resolvedPath);

    return {
      exists: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isDirectory: stats.isDirectory()
    };
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(filename: string): string {
    // Remove any path components
    const name = path.basename(filename);
    
    // Replace problematic characters
    return name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}

/**
 * CSV Parser/Generator
 */
export class CSVHandler {
  /**
   * Parse CSV string to array of objects
   */
  static parse(csvString: string, delimiter: string = ','): any[] {
    const lines = csvString.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(delimiter).map(h => h.trim());
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter);
      const row: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        // Try to parse numbers
        const num = Number(value);
        row[header] = !isNaN(num) && value !== '' ? num : value;
      });
      
      data.push(row);
    }

    return data;
  }

  /**
   * Generate CSV string from array of objects
   */
  static generate(data: any[], delimiter: string = ','): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvLines: string[] = [];

    // Add headers
    csvLines.push(headers.join(delimiter));

    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Quote strings containing delimiter or quotes
        if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      });
      csvLines.push(values.join(delimiter));
    }

    return csvLines.join('\n');
  }

  /**
   * Parse CSV file
   */
  static async parseFile(filePath: string, delimiter: string = ','): Promise<any[]> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return this.parse(content, delimiter);
  }

  /**
   * Save data to CSV file
   */
  static async saveFile(filePath: string, data: any[], delimiter: string = ','): Promise<void> {
    const csv = this.generate(data, delimiter);
    await fs.promises.writeFile(filePath, csv, 'utf-8');
  }
}

/**
 * JSON Handler with validation
 */
export class JSONHandler {
  /**
   * Parse JSON safely
   */
  static parse<T = any>(jsonString: string): T {
    try {
      return JSON.parse(jsonString);
    } catch (error: any) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  /**
   * Read JSON file
   */
  static async readFile<T = any>(filePath: string): Promise<T> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return this.parse<T>(content);
  }

  /**
   * Save JSON file
   */
  static async saveFile(filePath: string, data: any, pretty: boolean = true): Promise<void> {
    const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs.promises.writeFile(filePath, json, 'utf-8');
  }

  /**
   * Validate JSON against a simple schema
   */
  static validate(data: any, requiredFields: string[]): boolean {
    if (!data || typeof data !== 'object') return false;
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        return false;
      }
    }
    
    return true;
  }
}

/**
 * Template processor for reports
 */
export class TemplateProcessor {
  /**
   * Replace placeholders in template
   */
  static process(template: string, data: Record<string, any>): string {
    let result = template;
    
    // Replace {{key}} with values
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }
    
    return result;
  }

  /**
   * Process template file
   */
  static async processFile(
    templatePath: string,
    data: Record<string, any>,
    outputPath?: string
  ): Promise<string> {
    const template = await fs.promises.readFile(templatePath, 'utf-8');
    const processed = this.process(template, data);
    
    if (outputPath) {
      await fs.promises.writeFile(outputPath, processed, 'utf-8');
    }
    
    return processed;
  }
}

// Export singleton instance
// Export singleton instance with lazy initialization
let _fileHandler: FileHandler | null = null;

export function getFileHandler(): FileHandler {
  if (!_fileHandler) {
    _fileHandler = new FileHandler();
  }
  return _fileHandler;
}

// For backward compatibility
export const fileHandler = new Proxy({} as FileHandler, {
  get(_target, prop) {
    return (getFileHandler() as any)[prop];
  }
});

export default {
  FileHandler,
  CSVHandler,
  JSONHandler,
  TemplateProcessor,
  fileHandler
};
