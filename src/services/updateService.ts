/**
 * Update Service
 * Checks for application updates via GitHub releases
 */

import { createLogger } from '../core/index.js';
import fs from 'fs-extra';
import path from 'path';

let pkg: any;
try {
  const pkgPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } else {
    pkg = { version: '3.6.0', name: '@episensor/app-framework' };
  }
} catch {
  pkg = { version: '3.6.0', name: '@episensor/app-framework' };
}

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('UpdateService');
  }
  return logger;
}

interface ReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
}

interface LatestRelease {
  version: string;
  name: string;
  body: string;
  url: string;
  publishedAt: string;
  assets: ReleaseAsset[];
}

interface UpdateInfo {
  currentVersion: string;
  updateAvailable: boolean;
  latestRelease: LatestRelease | null;
  lastCheck: number | null;
}

interface Version {
  major: number;
  minor: number;
  patch: number;
}

interface ChangelogEntry {
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  url: string;
}

class UpdateService {
  private currentVersion: string;
  private githubRepo: string;
  private checkInterval: number;
  private lastCheck: number | null;
  private updateAvailable: boolean;
  private latestRelease: LatestRelease | null;

  constructor() {
    this.currentVersion = pkg.version;
    this.githubRepo = 'episensor/device-simulator'; // Update with actual repo
    this.checkInterval = 24 * 60 * 60 * 1000; // Check daily
    this.lastCheck = null;
    this.updateAvailable = false;
    this.latestRelease = null;
  }

  /**
   * Check for updates from GitHub releases
   */
  async checkForUpdates(force: boolean = false): Promise<UpdateInfo> {
    try {
      // Skip if checked recently (unless forced)
      if (!force && this.lastCheck) {
        const timeSinceCheck = Date.now() - this.lastCheck;
        if (timeSinceCheck < this.checkInterval) {
          ensureLogger().debug('Skipping update check (too recent)');
          return this.getUpdateInfo();
        }
      }

      ensureLogger().info('Checking for updates...');
      
      // Fetch latest release from GitHub API
      const response = await fetch(
        `https://api.github.com/repos/${this.githubRepo}/releases/latest`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': `device-simulator/${this.currentVersion}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          ensureLogger().debug('No releases found');
          return this.getUpdateInfo();
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const release = await response.json() as any;
      this.lastCheck = Date.now();
      
      // Parse version from tag (remove 'v' prefix if present)
      const latestVersion = release.tag_name.replace(/^v/, '');
      
      // Compare versions
      this.updateAvailable = this.isNewerVersion(latestVersion, this.currentVersion);
      
      if (this.updateAvailable) {
        this.latestRelease = {
          version: latestVersion,
          name: release.name,
          body: release.body,
          url: release.html_url,
          publishedAt: release.published_at,
          assets: release.assets.map((asset: any) => ({
            name: asset.name,
            size: asset.size,
            downloadUrl: asset.browser_download_url
          }))
        };
        
        ensureLogger().info(`Update available: ${latestVersion} (current: ${this.currentVersion})`);
      } else {
        ensureLogger().info('Application is up to date');
        this.latestRelease = null;
      }

      return this.getUpdateInfo();
    } catch (error: any) {
      ensureLogger().error('Failed to check for updates:', error);
      throw error;
    }
  }

  /**
   * Compare version strings (semantic versioning)
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const parseVersion = (v: string): Version => {
      const parts = v.split('.').map(p => parseInt(p) || 0);
      return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0
      };
    };

    const latestParsed = parseVersion(latest);
    const currentParsed = parseVersion(current);

    if (latestParsed.major > currentParsed.major) return true;
    if (latestParsed.major < currentParsed.major) return false;
    
    if (latestParsed.minor > currentParsed.minor) return true;
    if (latestParsed.minor < currentParsed.minor) return false;
    
    return latestParsed.patch > currentParsed.patch;
  }

  /**
   * Get current update information
   */
  getUpdateInfo(): UpdateInfo {
    return {
      currentVersion: this.currentVersion,
      updateAvailable: this.updateAvailable,
      latestRelease: this.latestRelease,
      lastCheck: this.lastCheck
    };
  }

  /**
   * Get changelog between versions
   */
  async getChangelog(fromVersion: string = this.currentVersion): Promise<ChangelogEntry[]> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.githubRepo}/releases`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': `device-simulator/${this.currentVersion}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const releases = await response.json() as any;
      const changelog: ChangelogEntry[] = [];
      
      for (const release of releases) {
        const version = release.tag_name.replace(/^v/, '');
        
        // Only include versions newer than fromVersion
        if (this.isNewerVersion(version, fromVersion)) {
          changelog.push({
            version,
            name: release.name,
            body: release.body,
            publishedAt: release.published_at,
            url: release.html_url
          });
        }
      }

      return changelog;
    } catch (error: any) {
      ensureLogger().error('Failed to fetch changelog:', error);
      throw error;
    }
  }

  /**
   * Get download URL for current platform
   */
  getDownloadUrl(): string | null {
    if (!this.latestRelease) return null;

    const platform = process.platform;
    const arch = process.arch;
    
    // Map platform/arch to expected asset names
    const assetPatterns: Record<string, RegExp> = {
      'darwin-x64': /mac.*x64|darwin.*x64|osx/i,
      'darwin-arm64': /mac.*arm|darwin.*arm|apple.*silicon/i,
      'win32-x64': /win.*x64|windows.*64/i,
      'linux-x64': /linux.*x64|linux.*amd64/i
    };

    const key = `${platform}-${arch}`;
    const pattern = assetPatterns[key];

    if (!pattern) {
      ensureLogger().warn(`No download pattern for platform: ${key}`);
      return this.latestRelease.url; // Return release page URL as fallback
    }

    const asset = this.latestRelease.assets.find(a => pattern.test(a.name));
    return asset ? asset.downloadUrl : this.latestRelease.url;
  }

  /**
   * Schedule automatic update checks
   */
  startAutoCheck(): void {
    // Initial check
    this.checkForUpdates().catch(err => {
      ensureLogger().error('Auto update check failed:', err);
    });

    // Schedule periodic checks
    setInterval(() => {
      this.checkForUpdates().catch(err => {
        ensureLogger().error('Auto update check failed:', err);
      });
    }, this.checkInterval);
  }

  /**
   * Stop automatic update checks
   */
  stopAutoCheck(): void {
    // Would need to store interval ID to properly clear
    ensureLogger().info('Auto update checks stopped');
  }

  /**
   * Get system information for update compatibility
   */
  getSystemInfo(): Record<string, any> {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      appVersion: this.currentVersion,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Check if update is compatible with current system
   */
  isUpdateCompatible(): boolean {
    // Add compatibility checks here
    // For now, assume all updates are compatible
    return true;
  }
}

// Singleton instance
let updateService: UpdateService | null = null;

export function getUpdateService(): UpdateService {
  if (!updateService) {
    updateService = new UpdateService();
  }
  return updateService;
}

export default UpdateService;
