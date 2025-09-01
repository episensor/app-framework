/**
 * Standard Configuration Loader
 * Provides consistent config loading across all EpiSensor applications
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';

export interface StandardAppConfig {
  app: {
    name: string;
    version: string;
    title: string;
    description?: string;
  };
  server: {
    port: number;
    host: string;
    webPort?: number;
    websocketPort?: number;
  };
  ui?: {
    theme?: 'light' | 'dark';
    branding?: {
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
    };
  };
  logging?: {
    level?: string;
    directory?: string;
    file_pattern?: string;
    maxSize?: string;
    maxFiles?: string;
    console_level?: string;
  };
  desktop?: {
    enabled: boolean;
    window?: {
      width?: number;
      height?: number;
      minWidth?: number;
      minHeight?: number;
    };
  };
  defaults?: {
    timeout?: number;
    retryAttempts?: number;
  };
  [key: string]: any; // Allow app-specific config
}

/**
 * Load application configuration with environment variable overrides
 */
export function loadStandardConfig(dirname: string): StandardAppConfig {
  // Load package.json for defaults
  const packageJsonPath = path.join(dirname, '../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  
  // Load app.json config if it exists
  const configPath = path.join(dirname, '../data/config/app.json');
  let appConfig: any = {};
  
  if (existsSync(configPath)) {
    appConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  }
  
  // Normalize config structure (handle different formats)
  const normalizedConfig: StandardAppConfig = {
    app: {
      name: process.env.APP_NAME || 
            appConfig.app?.name || 
            packageJson.name || 
            'EpiSensor App',
      version: appConfig.app?.version || 
               packageJson.version || 
               '1.0.0',
      title: process.env.APP_TITLE || 
             appConfig.app?.title || 
             appConfig.app_title ||  // Legacy support
             packageJson.displayName ||  // Some packages use displayName
             packageJson.name?.replace(/@[^/]+\//, '').replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 
             'EpiSensor Application',
      description: process.env.APP_DESCRIPTION || 
                   appConfig.app?.description || 
                   packageJson.description
    },
    server: {
      port: Number(process.env.PORT || 
                   process.env.API_PORT || 
                   appConfig.server?.port || 
                   appConfig.server?.api?.port || 
                   appConfig.api?.port || 
                   8080),
      host: process.env.HOST || 
            appConfig.server?.host || 
            appConfig.server?.api?.host || 
            appConfig.api?.host || 
            '0.0.0.0',
      webPort: Number(process.env.WEB_PORT || 
                      appConfig.server?.webPort || 
                      appConfig.server?.web?.port || 
                      appConfig.webPort || 
                      5173),
      websocketPort: Number(process.env.WEBSOCKET_PORT || 
                            appConfig.server?.websocketPort || 
                            appConfig.server?.websocket?.port || 
                            appConfig.webSocketPort || 
                            appConfig.server?.port || 
                            appConfig.api?.port)
    },
    ui: appConfig.ui || {},
    logging: {
      level: process.env.LOG_LEVEL || appConfig.logging?.level || 'INFO',
      directory: appConfig.logging?.directory || 'logs',
      file_pattern: appConfig.logging?.file_pattern || 'app.log',
      maxSize: appConfig.logging?.maxSize || '20m',
      maxFiles: appConfig.logging?.maxFiles || '14d',
      console_level: process.env.CONSOLE_LOG_LEVEL || appConfig.logging?.console_level || 'INFO'
    },
    desktop: {
      enabled: process.env.DESKTOP === 'true' || appConfig.desktop?.enabled || false,
      ...appConfig.desktop
    },
    defaults: appConfig.defaults || {
      timeout: 5000,
      retryAttempts: 3
    }
  };
  
  // Merge in any app-specific config
  Object.keys(appConfig).forEach(key => {
    if (!['app', 'server', 'api', 'ui', 'logging', 'desktop', 'defaults'].includes(key)) {
      normalizedConfig[key] = appConfig[key];
    }
  });
  
  return normalizedConfig;
}

/**
 * Get default ports for an application
 * Applications can override these by providing their own configuration
 */
export function getDefaultPorts(appName: string): { api: number; web: number } {
  // Return sensible defaults - applications should define their own ports
  return { api: 8080, web: 3000 };
}
