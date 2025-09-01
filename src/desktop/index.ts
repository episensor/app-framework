/**
 * Desktop Module Exports
 * Provides all desktop-related utilities for Tauri integration
 */

export * from './bundler.js';
export * from './tauri.js';
export * from './native-modules.js';

// Re-export as namespace for convenience
import * as bundler from './bundler.js';
import * as tauri from './tauri.js';
import * as nativeModules from './native-modules.js';

export const Desktop = {
  ...bundler,
  ...tauri,
  ...nativeModules
};

export default Desktop;