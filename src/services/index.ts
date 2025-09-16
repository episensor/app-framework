/**
 * Services Module Exports
 */

// Configuration management (unified)
// Re-export core ConfigManager to provide a single, authoritative implementation
export { ConfigManager, getConfigManager } from "../core/configManager.js";
export type { ConfigManagerOptions as ConfigOptions } from "../core/configManager.js";
import { ConfigManager as CoreConfigManager } from "../core/configManager.js";
import type { ConfigManagerOptions } from "../core/configManager.js";
// Backward-compatible factory alias
export function createConfigManager(options: ConfigManagerOptions = {}) {
  return new CoreConfigManager(options);
}

// Other services
export { getConversationStorage } from "./conversationStorage.js";
export { CrossPlatformBuffer } from "./crossPlatformBuffer.js";
export { getNetworkService } from "./networkService.js";
export { getUpdateService } from "./updateService.js";
export {
  createWebSocketServer,
  getWebSocketServer,
} from "./websocketServer.js";
export {
  SettingsService,
  CommonSettingsCategories,
} from "./settingsService.js";
export type {
  SettingsCategory,
  SettingsField,
  SettingsOptions,
} from "./settingsService.js";

// File handling
export {
  FileHandler,
  CSVHandler,
  JSONHandler,
  TemplateProcessor,
  fileHandler,
} from "./fileHandler.js";
export type { FileUploadOptions, UploadedFile } from "./fileHandler.js";

// WebSocket events
export {
  WebSocketEventManager,
  TypedEventEmitter,
  EventTypes,
  EventPatterns,
} from "./websocketEvents.js";
export type { EventPayload, EventResponse } from "./websocketEvents.js";

// AI Service
export { aiService, AIService } from "./aiService.js";
export type {
  AIConfig,
  AIMessage,
  AIResponse,
  AIAnalysisOptions,
  AIProvider,
} from "./aiService.js";

// Queue Service
export { default as QueueService } from "./queueService.js";
export type { QueueJob, QueueConfig, JobHandler } from "./queueService.js";

// Browser Automation Service - commented out as file was removed
// export { browserAutomation, BrowserAutomationService, LinkedInAutomation } from './browserAutomationService.js';
// export type { BrowserConfig, PageAction, AutomationSession, DataExtractionSchema } from './browserAutomationService.js';
