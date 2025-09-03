/**
 * Desktop Module Exports
 * Provides all desktop-related utilities for Tauri integration
 */

export * from './bundler.js';
export * from './tauri.js';
export * from './native-modules.js';
export * from './sidecar.js';

// Re-export as namespace for convenience
import * as bundler from './bundler.js';
import * as tauri from './tauri.js';
import * as nativeModules from './native-modules.js';
import * as sidecar from './sidecar.js';

export const Desktop = {
  ...bundler,
  ...tauri,
  ...nativeModules,
  ...sidecar
};

export default Desktop;