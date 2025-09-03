import os from 'os';
import path from 'path';
import fs from 'fs-extra';

/**
 * Get the appropriate data directory for the application.
 * 
 * In desktop app mode (Tauri/Electron):
 * - macOS: ~/Library/Application Support/{appId}
 * - Windows: %APPDATA%/{appName}  
 * - Linux: ~/.local/share/{appName}
 * 
 * In development or web mode:
 * - Uses project root ./data directory
 * 
 * @param appId - The application identifier (e.g., 'com.episensor.app-name')
 * @param appName - The application name (e.g., 'app-name')
 * @returns The absolute path to the application data directory
 */
export function getAppDataPath(appId: string, appName: string): string {
  // Check if running in a desktop app environment
  const isTauriProduction = process.env.TAURI === '1';
  const isElectron = process.versions?.electron;
  const isDesktopApp = isTauriProduction || isElectron;

  if (isDesktopApp) {
    // Use platform-specific app data directories
    const platform = process.platform;
    const homeDir = os.homedir();
    let appDataDir: string;

    switch (platform) {
      case 'darwin': // macOS
        appDataDir = path.join(homeDir, 'Library', 'Application Support', appId);
        break;
      case 'win32': // Windows
        appDataDir = path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), appName);
        break;
      default: // Linux and others
        appDataDir = path.join(process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share'), appName);
        break;
    }

    // Ensure the directory exists
    fs.ensureDirSync(appDataDir);
    return appDataDir;
  }

  // In development or web mode, use the project root ./data directory
  const dataDir = path.join(process.cwd(), 'data');
  fs.ensureDirSync(dataDir);
  return dataDir;
}

/**
 * Get the full path for a data file within the application data directory.
 * 
 * @param filename - The name of the file
 * @param appId - The application identifier
 * @param appName - The application name
 * @returns The absolute path to the file
 */
export function getDataFilePath(filename: string, appId: string, appName: string): string {
  return path.join(getAppDataPath(appId, appName), filename);
}

/**
 * Get the logs directory path for the application.
 * 
 * @param appId - The application identifier
 * @param appName - The application name
 * @returns The absolute path to the logs directory
 */
export function getLogsPath(appId: string, appName: string): string {
  const logsDir = path.join(getAppDataPath(appId, appName), 'logs');
  fs.ensureDirSync(logsDir);
  return logsDir;
}

/**
 * Get the configuration directory path for the application.
 * 
 * @param appId - The application identifier
 * @param appName - The application name
 * @returns The absolute path to the config directory
 */
export function getConfigPath(appId: string, appName: string): string {
  const configDir = path.join(getAppDataPath(appId, appName), 'config');
  fs.ensureDirSync(configDir);
  return configDir;
}

/**
 * Get the cache directory path for the application.
 * 
 * @param appId - The application identifier
 * @param appName - The application name
 * @returns The absolute path to the cache directory
 */
export function getCachePath(appId: string, appName: string): string {
  const cacheDir = path.join(getAppDataPath(appId, appName), 'cache');
  fs.ensureDirSync(cacheDir);
  return cacheDir;
}

/**
 * Check if the application is running in desktop mode (Tauri or Electron).
 * 
 * @returns True if running as a desktop app, false otherwise
 */
export function isDesktopApp(): boolean {
  return process.env.TAURI === '1' || !!process.versions?.electron;
}

/**
 * Get platform-specific user documents directory.
 * 
 * @returns The path to the user's documents directory
 */
export function getDocumentsPath(): string {
  const platform = process.platform;
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'darwin': // macOS
    case 'linux':
      return path.join(homeDir, 'Documents');
    case 'win32': // Windows
      return path.join(homeDir, 'Documents');
    default:
      return homeDir;
  }
}

/**
 * Get platform-specific user desktop directory.
 * 
 * @returns The path to the user's desktop directory
 */
export function getDesktopPath(): string {
  const platform = process.platform;
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'darwin': // macOS
    case 'linux':
      return path.join(homeDir, 'Desktop');
    case 'win32': // Windows
      return path.join(homeDir, 'Desktop');
    default:
      return homeDir;
  }
}

/**
 * Get platform-specific user downloads directory.
 * 
 * @returns The path to the user's downloads directory
 */
export function getDownloadsPath(): string {
  const platform = process.platform;
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'darwin': // macOS
    case 'linux':
      return path.join(homeDir, 'Downloads');
    case 'win32': // Windows
      return path.join(homeDir, 'Downloads');
    default:
      return homeDir;
  }
}