/**
 * Unit tests for StorageService
 */

import { StorageService, getStorageService } from '../../../src/core/storageService';
import fs from 'fs-extra';
import crypto from 'crypto';

// Mock dependencies
jest.mock('fs-extra');
jest.mock('crypto');

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    log: jest.fn()
  }));
});

// Mock the logger
jest.mock('../../../src/core', () => ({
  ...jest.requireActual('../../../src/core'),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

describe('StorageService', () => {
  let handler: StorageService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    handler = new StorageService();
    
    // Setup default mocks
    (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as unknown as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as unknown as jest.Mock).mockResolvedValue(Buffer.from('test content'));
    (fs.stat as unknown as jest.Mock).mockResolvedValue({ 
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
      birthtime: new Date(),
      mtime: new Date()
    });
    (fs.pathExists as jest.Mock).mockResolvedValue(true);
    (fs.copy as jest.Mock).mockResolvedValue(undefined);
    (fs.remove as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as unknown as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as unknown as jest.Mock).mockResolvedValue([]);
    
    // Mock crypto
    (crypto.createHash as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'mockhash123')
    });
  });
  
  describe('initialize', () => {
    test('creates required directories', async () => {
      await handler.initialize();
      
      // Should create all base directories
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('data'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('templates'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('uploads'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('logs'));
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('config'));
    });
    
    test('creates .gitignore files', async () => {
      await handler.initialize();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.gitignore'),
        '*\n!.gitignore\n'
      );
    });
    
    test('only initializes once', async () => {
      await handler.initialize();
      await handler.initialize();
      
      // ensureDir should only be called once per directory
      const callCount = (fs.ensureDir as jest.Mock).mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(6); // Number of base directories
    });
    
    test('handles initialization errors', async () => {
      (fs.ensureDir as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(handler.initialize()).rejects.toThrow('Permission denied');
    });
  });
  
  describe('sanitizeFilename', () => {
    test('removes path traversal attempts', () => {
      const sanitized = handler.sanitizeFilename('../../../etc/passwd');
      expect(sanitized).toBe('passwd');
    });
    
    test('removes special characters', () => {
      const sanitized = handler.sanitizeFilename('file<>:|?"*name.txt');
      expect(sanitized).toBe('file_______name.txt');
    });
    
    test('handles empty filename', () => {
      expect(() => handler.sanitizeFilename('')).toThrow('Invalid filename provided');
    });
    
    test('handles dot files', () => {
      const sanitized = handler.sanitizeFilename('..');
      expect(sanitized).toMatch(/^file_\d+$/);
    });
    
    test('preserves valid characters', () => {
      const sanitized = handler.sanitizeFilename('valid-file_name.123.txt');
      expect(sanitized).toBe('valid-file_name.123.txt');
    });
    
    test('limits filename length', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const sanitized = handler.sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
      expect(sanitized.endsWith('.txt')).toBe(true);
    });
    
    test('throws on invalid input', () => {
      expect(() => handler.sanitizeFilename(null as any)).toThrow('Invalid filename provided');
      expect(() => handler.sanitizeFilename(undefined as any)).toThrow('Invalid filename provided');
      expect(() => handler.sanitizeFilename(123 as any)).toThrow('Invalid filename provided');
    });
  });
  
  describe('path validation', () => {
    test('accepts valid paths within base directory', async () => {
      await handler.initialize();
      // validatePath is internal, test through file operations
      const result = await handler.readFile('test.txt', 'data');
      expect(result).toBeTruthy();
    });
    
    test('sanitizes path traversal attempts', async () => {
      await handler.initialize();
      // Path traversal attempts are sanitized to just the filename
      const content = await handler.readFile('../../../etc/passwd', 'data');
      expect(content).toBeDefined();
      // The file read should be for 'passwd' not the full path
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('passwd')
      );
    });
    
    test('sanitizes absolute paths', async () => {
      await handler.initialize();
      // Absolute paths are sanitized to just the filename
      const content = await handler.readFile('/etc/passwd', 'data');
      expect(content).toBeDefined();
      // The file read should be for 'passwd' not the full path
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('passwd')
      );
    });
    
    test('throws on invalid base directory', async () => {
      await handler.initialize();
      await expect(handler.readFile('test.txt', 'invalid' as any))
        .rejects.toThrow();
    });
    
    test('automatically initializes when needed', async () => {
      const uninitializedHandler = new StorageService();
      // Handler will auto-initialize when readFile is called
      const content = await uninitializedHandler.readFile('test.txt', 'data');
      expect(content).toBeDefined();
    });
  });
  
  describe('saveFile', () => {
    beforeEach(async () => {
      await handler.initialize();
    });
    
    test('saves file content', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(false); // File doesn't exist yet
      const content = 'test content';
      const info = await handler.saveFile('test.txt', content, 'data');
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test.txt'),
        content
      );
      expect(info).toMatchObject({
        name: 'test.txt',
        size: content.length
      });
    });
    
    test('creates backup when requested', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      
      await handler.saveFile('test.txt', 'content', 'data', {
        overwrite: true,
        createBackup: true
      });
      
      expect(fs.copy).toHaveBeenCalledWith(
        expect.stringContaining('test.txt'),
        expect.stringContaining('.backup')
      );
    });
    
    test('prevents overwriting without permission', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      
      await expect(handler.saveFile('test.txt', 'content', 'data'))
        .rejects.toThrow('File already exists');
    });
    
    test('allows overwriting with permission', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      
      const info = await handler.saveFile('test.txt', 'content', 'data', {
        overwrite: true
      });
      
      expect(info).toBeDefined();
      expect(fs.writeFile).toHaveBeenCalled();
    });
    
    test('enforces max file size', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(false); // File doesn't exist yet
      const largeContent = Buffer.alloc(200 * 1024 * 1024); // 200MB
      
      await expect(handler.saveFile('large.txt', largeContent, 'data'))
        .rejects.toThrow('File size exceeds maximum allowed size');
    });
    
    test('calculates file hash', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(false); // File doesn't exist yet
      const info = await handler.saveFile('test.txt', 'content', 'data');
      
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(info.hash).toBe('mockhash123');
    });
  });
  
  describe('readFile', () => {
    beforeEach(async () => {
      await handler.initialize();
    });
    
    test('reads file content', async () => {
      const content = await handler.readFile('test.txt', 'data');
      
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test.txt')
      );
      expect(content).toBeDefined();
    });
    
    test('reads with specified encoding', async () => {
      await handler.readFile('test.txt', 'data', { encoding: 'base64' });
      
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test.txt'),
        'base64'
      );
    });
    
    test('enforces max size limit', async () => {
      (fs.stat as unknown as jest.Mock).mockResolvedValueOnce({
        size: 10 * 1024 * 1024, // 10MB
        isFile: () => true
      });
      
      await expect(handler.readFile('test.txt', 'data', { maxSize: 1024 }))
        .rejects.toThrow('File size');
    });
    
    test('throws on non-existent file', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(false);
      
      await expect(handler.readFile('missing.txt', 'data'))
        .rejects.toThrow('File not found');
    });
    
    test('reads directory as file', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (fs.stat as unknown as jest.Mock).mockResolvedValueOnce({
        size: 100,
        isFile: () => false,
        isDirectory: () => true
      });
      (fs.readFile as unknown as jest.Mock).mockResolvedValueOnce(Buffer.from('dir content'));
      
      const content = await handler.readFile('somedir', 'data');
      expect(content).toBeDefined();
    });
  });
  
  describe('deleteFile', () => {
    beforeEach(async () => {
      await handler.initialize();
    });
    
    test('deletes existing file', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (fs.unlink as unknown as jest.Mock).mockResolvedValueOnce(undefined);
      
      const result = await handler.deleteFile('test.txt', 'data');
      
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('test.txt'));
      expect(result).toBe(true);
    });
    
    test('returns false for non-existent file', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(false);
      
      const result = await handler.deleteFile('missing.txt', 'data');
      
      expect(fs.unlink).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
    
    test('handles deletion errors', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (fs.unlink as unknown as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
      
      await expect(handler.deleteFile('test.txt', 'data'))
        .rejects.toThrow('Permission denied');
    });
  });
  
  describe('listFiles', () => {
    beforeEach(async () => {
      await handler.initialize();
    });
    
    test('lists files in directory', async () => {
      (fs.readdir as unknown as jest.Mock).mockResolvedValueOnce(['file1.txt', 'file2.txt', 'subdir']);
      (fs.stat as unknown as jest.Mock)
        .mockResolvedValueOnce({ 
          size: 100, 
          isFile: () => true,
          birthtime: new Date(),
          mtime: new Date()
        })
        .mockResolvedValueOnce({ 
          size: 200, 
          isFile: () => true,
          birthtime: new Date(),
          mtime: new Date()
        })
        .mockResolvedValueOnce({ 
          isFile: () => false,
          isDirectory: () => true 
        });
      
      const files = await handler.listFiles('data');
      
      expect(files).toHaveLength(2); // Only files, not directories
      expect(files[0]).toMatchObject({
        name: 'file1.txt',
        size: 100
      });
      expect(files[1]).toMatchObject({
        name: 'file2.txt',
        size: 200
      });
    });
    
    test('returns empty array for empty directory', async () => {
      (fs.readdir as unknown as jest.Mock).mockResolvedValueOnce([]);
      
      const files = await handler.listFiles('data');
      
      expect(files).toEqual([]);
    });
    
    test('lists files matching pattern', async () => {
      (fs.readdir as unknown as jest.Mock).mockResolvedValueOnce(['test.txt', 'data.json', 'file.pdf']);
      (fs.stat as unknown as jest.Mock)
        .mockResolvedValueOnce({
          size: 50,
          isFile: () => true,
          birthtime: new Date(),
          mtime: new Date()
        })
        .mockResolvedValueOnce({
          size: 100,
          isFile: () => true,
          birthtime: new Date(),
          mtime: new Date()
        })
        .mockResolvedValueOnce({
          size: 200,
          isFile: () => true,
          birthtime: new Date(),
          mtime: new Date()
        });
      
      // listFiles takes category and pattern (RegExp)
      const files = await handler.listFiles('data', /\.txt$/);
      
      expect(files).toHaveLength(1);
      expect(files[0].name).toBe('test.txt');
    });
  });
  
  describe('getFileInfo', () => {
    beforeEach(async () => {
      await handler.initialize();
    });
    
    test('returns file information', async () => {
      const birthtime = new Date('2024-01-01');
      const mtime = new Date('2024-01-02');
      
      // Clear the default mock and set specific one
      (fs.stat as unknown as jest.Mock).mockReset();
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (fs.stat as unknown as jest.Mock).mockResolvedValueOnce({
        size: 1024,
        isFile: () => true,
        birthtime,
        mtime
      });
      
      const info = await handler.getFileInfo('test.txt', 'data');
      
      expect(info).toMatchObject({
        name: 'test.txt',
        size: 1024,
        created: birthtime,
        modified: mtime
      });
    });
    
    test('returns null for non-existent file', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(false);
      
      const info = await handler.getFileInfo('missing.txt', 'data');
      expect(info).toBeNull();
    });
    
    test('returns file info for directory', async () => {
      (fs.pathExists as jest.Mock).mockResolvedValueOnce(true);
      (fs.stat as unknown as jest.Mock).mockResolvedValueOnce({
        size: 0,
        isFile: () => false,
        isDirectory: () => true,
        birthtime: new Date(),
        mtime: new Date()
      });
      
      const info = await handler.getFileInfo('somedir', 'data');
      expect(info).toBeTruthy();
    });
  });
  
  describe('getStorageService singleton', () => {
    test('returns the same instance', () => {
      const handler1 = getStorageService();
      const handler2 = getStorageService();
      
      expect(handler1).toBe(handler2);
    });
    
    test('instance is StorageService', () => {
      const handler = getStorageService();
      
      expect(handler).toBeInstanceOf(StorageService);
    });
  });
});