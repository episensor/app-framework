/**
 * File system utilities to replace fs-extra with native Node.js fs
 * Provides cross-platform compatibility without ESM issues
 */

import fs from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import path from "path";

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Check if a path exists
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a file or directory
 */
export async function copy(src: string, dest: string): Promise<void> {
  const stats = await fs.stat(src);

  if (stats.isDirectory()) {
    await ensureDir(dest);
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copy(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

/**
 * Move a file or directory
 */
export async function move(
  src: string,
  dest: string,
  options?: { overwrite?: boolean },
): Promise<void> {
  const { overwrite = true } = options || {};

  if (!overwrite && (await pathExists(dest))) {
    throw new Error(`Destination already exists: ${dest}`);
  }

  try {
    await fs.rename(src, dest);
  } catch (error: any) {
    // If cross-device move, copy then delete
    if (error.code === "EXDEV") {
      await copy(src, dest);
      await fs.rm(src, { recursive: true, force: true });
    } else {
      throw error;
    }
  }
}

/**
 * Remove a file or directory
 */
export async function remove(filePath: string): Promise<void> {
  await fs.rm(filePath, { recursive: true, force: true });
}

/**
 * Read a JSON file
 */
export async function readJson(filePath: string): Promise<any> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

/**
 * Write a JSON file
 */
export async function writeJson(
  filePath: string,
  data: any,
  options?: { spaces?: number },
): Promise<void> {
  const { spaces = 2 } = options || {};
  const content = JSON.stringify(data, null, spaces);
  await fs.writeFile(filePath, content, "utf8");
}

/**
 * Empty a directory without removing it
 */
export async function emptyDir(dir: string): Promise<void> {
  if (await pathExists(dir)) {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      await remove(path.join(dir, entry));
    }
  } else {
    await ensureDir(dir);
  }
}

// Re-export native fs methods that don't need replacement
export { fs };
export { createReadStream, createWriteStream };
export const readFile = fs.readFile.bind(fs);
export const writeFile = fs.writeFile.bind(fs);
export const readdir = fs.readdir.bind(fs);
export const stat = fs.stat.bind(fs);
export const unlink = fs.unlink;
