/**
 * AI Service Interface for multiple AI providers
 * Provides a unified interface for OpenAI, Claude, and other AI services
 */

import { EventEmitter } from 'events';
import { createLogger } from '../core/index.js';
import { getStorageService } from '../core/storageService.js';
import OpenAI from 'openai';
import * as crypto from 'node:crypto';

/**
 * Custom AI Error class that preserves structured error information
 */
export class AIError extends Error {
  public statusCode: number;
  public errorType: string;
  public provider: string;
  
  constructor(message: string, statusCode: number = 500, errorType: string = 'AI_ERROR', provider: string = 'unknown') {
    super(message);
    this.name = 'AIError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.provider = provider;
  }
}

/**
 * Simple LRU Cache implementation to prevent memory leaks
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      // Move to end (most recent)
      const value = this.cache.get(key);
      this.cache.delete(key);
      this.cache.set(key, value!);
      return value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove oldest (first entry)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger('AIService');
  }
  return logger;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'mock';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  baseURL?: string;
  enableCaching?: boolean;
  enableLogging?: boolean;
  models?: {
    chat?: string;
    template?: string;
    fileAnalysis?: string;
    validation?: string;
  };
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  cached?: boolean;
}

export interface TemplateResponse extends AIResponse {
  template?: any;
}

export interface FileAnalysisResponse extends AIResponse {
  analysis?: string;
  dataPoints?: any[];
}

export interface AIAnalysisOptions {
  analysisType?: string;
  requiresStructuredOutput?: boolean;
  requiresReasoning?: boolean;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: { type: string };
}

/**
 * Abstract base class for AI providers
 */
export abstract class AIProvider {
  protected config: AIConfig;
  
  constructor(config: AIConfig) {
    this.config = config;
  }

  abstract analyze(prompt: string, options?: AIAnalysisOptions): Promise<AIResponse>;
  abstract chat(messages: AIMessage[], options?: AIAnalysisOptions): Promise<AIResponse>;
  abstract validateConfig(): boolean;
}

/**
 * Model cost configuration
 */
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-4': { input: 0.01, output: 0.03 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 }
};

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider extends AIProvider {
  private client: OpenAI | null = null;
  private models: {
    chat: string;
    template: string;
    fileAnalysis: string;
    validation: string;
  };

  constructor(config: AIConfig) {
    super(config);
    
    // Set default models or use provided ones
    this.models = {
      chat: config.models?.chat || config.model || 'gpt-3.5-turbo',
      template: config.models?.template || 'gpt-4-turbo-preview',
      fileAnalysis: config.models?.fileAnalysis || 'gpt-4-turbo',
      validation: config.models?.validation || 'gpt-3.5-turbo'
    };

    if (config.apiKey) {
      this.initializeClient();
    }
  }

  private initializeClient(): void {
    if (this.client) return;
    
    try {
      const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new AIError('OpenAI API key not configured. Set OPENAI_API_KEY environment variable or provide apiKey in config.', 401, 'AUTH_ERROR', 'openai');
      }
      
      // Basic validation - OpenAI keys start with 'sk-'
      if (!apiKey.startsWith('sk-')) {
        throw new AIError('Invalid OpenAI API key format', 401, 'AUTH_ERROR', 'openai');
      }
      
      this.client = new OpenAI({ 
        apiKey,
        baseURL: this.config.baseURL
      });
      ensureLogger().info('OpenAI client initialized');
    } catch (_error) {
      ensureLogger().error('Failed to initialize OpenAI client:', _error);
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError('Failed to initialize OpenAI client', 500, 'INIT_ERROR', 'openai');
    }
  }

  validateConfig(): boolean {
    return !!this.config.apiKey;
  }

  async analyze(prompt: string, options: AIAnalysisOptions = {}): Promise<AIResponse> {
    const messages: AIMessage[] = [];
    
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    return this.chat(messages, options);
  }

  async chat(messages: AIMessage[], options: AIAnalysisOptions = {}): Promise<AIResponse> {
    try {
      if (!this.client) {
        this.initializeClient();
      }

      const model = options.analysisType === 'template' ? this.models.template : 
                    options.analysisType === 'fileAnalysis' ? this.models.fileAnalysis :
                    options.analysisType === 'validation' ? this.models.validation :
                    this.models.chat;

      ensureLogger().debug('Sending request to OpenAI', {
        model,
        messageCount: messages.length
      });

      const completion = await this.client!.chat.completions.create({
        model,
        messages: messages as any,
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2000,
        ...(options.responseFormat && { response_format: options.responseFormat as any })
      });

      const content = completion.choices[0].message.content || '';
      const cost = this.calculateCost(completion.usage, model);

      const response: AIResponse = {
        content,
        model,
        usage: completion.usage ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens
        } : undefined,
        cost
      };

      if (this.config.enableLogging) {
        ensureLogger().info('OpenAI request completed', {
          model,
          tokens: completion.usage?.total_tokens,
          cost
        });
      }

      return response;
    } catch (_error: any) {
      ensureLogger().error('OpenAI API error', _error);
      throw this.handleOpenAIError(error);
    }
  }

  private calculateCost(usage: any, model: string): number {
    if (!usage) return 0;
    
    const costs = MODEL_COSTS[model] || MODEL_COSTS['gpt-3.5-turbo'];
    const inputCost = (usage.prompt_tokens / 1000) * costs.input;
    const outputCost = (usage.completion_tokens / 1000) * costs.output;
    
    return Math.round((inputCost + outputCost) * 1000000) / 1000000;
  }

  private handleOpenAIError(error: any): AIError {
    if (error.response?.status === 401) {
      return new AIError('Invalid API key', 401, 'AUTH_ERROR', 'openai');
    }
    if (error.response?.status === 429) {
      return new AIError('Rate limit exceeded. Please try again later.', 429, 'RATE_LIMIT', 'openai');
    }
    if (error.response?.status === 503) {
      return new AIError('OpenAI service temporarily unavailable', 503, 'SERVICE_UNAVAILABLE', 'openai');
    }
    if (error.message?.includes('timeout')) {
      return new AIError('Request timed out. Please try again.', 408, 'TIMEOUT', 'openai');
    }
    // Preserve original error info if not a known error type
    const statusCode = error.response?.status || error.statusCode || 500;
    const errorType = error.type || 'UNKNOWN_ERROR';
    return new AIError(error.message || 'Unknown error occurred', statusCode, errorType, 'openai');
  }
}

/**
 * Mock Provider for testing
 */
export class MockAIProvider extends AIProvider {
  validateConfig(): boolean {
    return true;
  }

  async analyze(prompt: string, _options: AIAnalysisOptions = {}): Promise<AIResponse> {
    return {
      content: `Mock analysis for: ${prompt.substring(0, 50)}...`,
      model: 'mock',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      },
      cost: 0
    };
  }

  async chat(messages: AIMessage[], _options: AIAnalysisOptions = {}): Promise<AIResponse> {
    return {
      content: `Mock chat response for ${messages.length} messages`,
      model: 'mock',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15
      },
      cost: 0
    };
  }
}

/**
 * Main AI Service with caching and model routing
 */
export class AIService extends EventEmitter {
  private providers: Map<string, AIProvider>;
  private cache: LRUCache<string, AIResponse>;
  private fileHandler = getStorageService();
  private defaultProvider: string;

  constructor() {
    super();
    this.providers = new Map();
    this.cache = new LRUCache(1000); // Limit cache to 1000 entries to prevent memory leaks
    this.defaultProvider = 'mock';
    
    ensureLogger().debug('AIService initialized');
  }

  /**
   * Register an AI provider
   */
  registerProvider(name: string, config: AIConfig): void {
    let provider: AIProvider;
    
    switch (config.provider) {
      case 'openai':
        provider = new OpenAIProvider(config);
        break;
      case 'mock':
        provider = new MockAIProvider(config);
        break;
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }

    if (!provider.validateConfig()) {
      throw new Error(`Invalid configuration for provider: ${name}`);
    }

    this.providers.set(name, provider);
    
    if (!this.defaultProvider || this.providers.size === 1) {
      this.defaultProvider = name;
    }

    ensureLogger().info(`Registered AI provider: ${name} (${config.provider})`);
  }

  /**
   * Set default provider
   */
  setDefaultProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider not found: ${name}`);
    }
    this.defaultProvider = name;
    ensureLogger().info(`Set default provider to: ${name}`);
  }

  /**
   * Analyze content using AI
   */
  async analyze(
    prompt: string,
    options: AIAnalysisOptions & { provider?: string; useCache?: boolean } = {}
  ): Promise<AIResponse> {
    const providerName = options.provider || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    // Check cache if enabled
    const cacheKey = this.getCacheKey(prompt, options);
    if (options.useCache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      ensureLogger().debug('Returning cached response', { cacheKey });
      return { ...cached, cached: true };
    }

    // Log the analysis request
    this.emit('analysis:start', { prompt, options, provider: providerName });
    
    try {
      const response = await provider.analyze(prompt, options);
      
      // Cache the response
      this.cache.set(cacheKey, response);
      
      // Log usage for tracking
      if (response.usage) {
        await this.logUsage(providerName, response);
      }

      this.emit('analysis:complete', { response, provider: providerName });
      
      return response;
    } catch (_error) {
      this.emit('analysis:error', { error, provider: providerName });
      throw error;
    }
  }

  /**
   * Chat with AI
   */
  async chat(
    messages: AIMessage[],
    options: AIAnalysisOptions & { provider?: string; useCache?: boolean } = {}
  ): Promise<AIResponse> {
    const providerName = options.provider || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    // Check cache if enabled
    const cacheKey = this.getCacheKey(JSON.stringify(messages), options);
    if (options.useCache !== false && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      ensureLogger().debug('Returning cached response', { cacheKey });
      return { ...cached, cached: true };
    }

    this.emit('chat:start', { messages, options, provider: providerName });
    
    try {
      const response = await provider.chat(messages, options);
      
      // Cache the response
      this.cache.set(cacheKey, response);
      
      // Log usage for tracking
      if (response.usage) {
        await this.logUsage(providerName, response);
      }

      this.emit('chat:complete', { response, provider: providerName });
      
      return response;
    } catch (_error) {
      this.emit('chat:error', { error, provider: providerName });
      throw error;
    }
  }

  /**
   * Generate template from conversation
   */
  async generateTemplate(
    messages: AIMessage[],
    options: AIAnalysisOptions & { provider?: string } = {}
  ): Promise<TemplateResponse> {
    const providerName = options.provider || this.defaultProvider;
    
    // Add template generation request
    const generationRequest: AIMessage = {
      role: 'user',
      content: 'Based on our conversation, generate a template. Return ONLY the JSON template, no explanation.'
    };
    
    const allMessages = [...messages, generationRequest];
    
    // Use structured output for template generation
    const response = await this.chat(allMessages, {
      ...options,
      analysisType: 'template',
      temperature: options.temperature ?? 0.2,
      maxTokens: options.maxTokens ?? 4000,
      responseFormat: { type: 'json_object' },
      provider: providerName
    });
    
    // Parse and validate the template
    let template;
    try {
      template = JSON.parse(response.content);
    } catch (_e) {
      throw new Error('Generated template is not valid JSON');
    }
    
    return {
      ...response,
      template
    } as TemplateResponse;
  }

  /**
   * Analyze uploaded file
   */
  async analyzeFile(
    fileContent: string,
    fileType: string,
    deviceInfo: Record<string, any> = {},
    options: AIAnalysisOptions & { provider?: string } = {}
  ): Promise<FileAnalysisResponse> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: options.systemPrompt || 'You are an expert at analyzing device documentation and extracting data point information.'
      },
      {
        role: 'user',
        content: `Analyze this ${fileType} file for device "${deviceInfo.name || 'Unknown'}" by ${deviceInfo.manufacturer || 'Unknown'}:\n\n${fileContent}\n\nExtract all data points, registers, and configuration information.`
      }
    ];
    
    const response = await this.chat(messages, {
      ...options,
      analysisType: 'fileAnalysis',
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 4000,
      provider: options.provider
    });
    
    // Try to extract data points from the response
    let dataPoints: any[] = [];
    try {
      // Attempt to parse JSON data points from the response
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        dataPoints = JSON.parse(jsonMatch[0]);
      }
    } catch (_e) {
      // If parsing fails, return empty array
      ensureLogger().debug('Could not parse data points from file analysis');
    }
    
    return {
      ...response,
      analysis: response.content,
      dataPoints
    } as FileAnalysisResponse;
  }

  /**
   * Select best model for task
   */
  selectModel(criteria: {
    contentLength?: number;
    complexity?: 'low' | 'medium' | 'high';
    requiresReasoning?: boolean;
    requiresStructuredOutput?: boolean;
    costSensitive?: boolean;
  }): { provider: string; model: string; reason: string } {
    // Simple model selection logic - can be enhanced
    if (criteria.costSensitive) {
      return {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        reason: 'Cost-optimized model'
      };
    }

    if (criteria.requiresReasoning || criteria.complexity === 'high') {
      return {
        provider: 'openai',
        model: 'gpt-4',
        reason: 'Advanced reasoning required'
      };
    }

    if (criteria.contentLength && criteria.contentLength > 8000) {
      return {
        provider: 'anthropic',
        model: 'claude-3-opus',
        reason: 'Long context window needed'
      };
    }

    return {
      provider: 'openai',
      model: 'gpt-4-turbo',
      reason: 'Default balanced model'
    };
  }

  /**
   * Generate cache key
   */
  private getCacheKey(content: string, options: any): string {
    const hash = crypto
      .createHash('sha256')
      .update(content + JSON.stringify(options))
      .digest('hex');
    return hash.substring(0, 16);
  }

  /**
   * Log AI usage for tracking
   */
  private async logUsage(provider: string, response: AIResponse): Promise<void> {
    const usage = {
      provider,
      model: response.model,
      timestamp: new Date().toISOString(),
      tokens: response.usage,
      cost: response.cost
    };

    try {
      await this.fileHandler.saveFile(
        `ai_usage_${Date.now()}.json`,
        JSON.stringify(usage, null, 2),
        'logs',
        { overwrite: false }
      );
    } catch (_error) {
      ensureLogger().error('Failed to log AI usage', _error);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    ensureLogger().info('AI response cache cleared');
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(_startDate?: Date, _endDate?: Date): Promise<{
    totalTokens: number;
    totalCost: number;
    byProvider: Record<string, { tokens: number; cost: number }>;
  }> {
    // Implementation would read from usage logs
    return {
      totalTokens: 0,
      totalCost: 0,
      byProvider: {}
    };
  }
}

// Export singleton instance with lazy initialization
let _aiService: AIService | null = null;

export function getAIService(): AIService {
  if (!_aiService) {
    _aiService = new AIService();
  }
  return _aiService;
}

// For backward compatibility - use a Proxy to lazy-load
export const aiService = new Proxy({} as AIService, {
  get(_target, prop) {
    return (getAIService() as any)[prop];
  }
});

export default AIService;