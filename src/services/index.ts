/**
 * Services Module Exports
 */

// Configuration management - use SettingsService

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
