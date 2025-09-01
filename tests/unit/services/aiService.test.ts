/**
 * Unit tests for AIService
 */

import { 
  AIService, 
  OpenAIProvider, 
  MockAIProvider,
  AIConfig,
  AIMessage,
  AIAnalysisOptions
} from '../../../src/services/aiService';

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    log: jest.fn()
  }));
});

// Mock dependencies
jest.mock('../../../src/core', () => ({
  ...jest.requireActual('../../../src/core'),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

jest.mock('../../../src/core/secureFileHandler', () => ({
  getSecureFileHandler: jest.fn(() => ({
    saveFile: jest.fn()
  }))
}));

jest.mock('node:crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hash-1234567890abcdef')
  }))
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => {
    return {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock response', role: 'assistant' } }],
            usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 },
          }),
        },
      },
    };
  });
});

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    aiService = new AIService();
  });

  describe('constructor', () => {
    test('initializes with empty providers and cache', () => {
      expect(aiService).toBeDefined();
      expect(aiService['providers'].size).toBe(0);
      expect(aiService['cache'].size).toBe(0);
    });
  });

  describe('registerProvider', () => {
    test('registers OpenAI provider successfully', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'sk-test-api-key-12345',
        model: 'gpt-4'
      };

      aiService.registerProvider('openai-main', config);
      
      expect(aiService['providers'].has('openai-main')).toBe(true);
      expect(aiService['defaultProvider']).toBe('openai-main');
    });

    test('registers mock provider successfully', () => {
      const config: AIConfig = {
        provider: 'mock'
      };

      aiService.registerProvider('mock-provider', config);
      
      expect(aiService['providers'].has('mock-provider')).toBe(true);
    });

    test('throws error for unknown provider type', () => {
      const config: AIConfig = {
        provider: 'unknown' as any
      };

      expect(() => {
        aiService.registerProvider('unknown', config);
      }).toThrow('Unknown provider: unknown');
    });

    test('throws error for invalid provider config', () => {
      const config: AIConfig = {
        provider: 'openai'
        // Missing required apiKey
      };

      expect(() => {
        aiService.registerProvider('invalid', config);
      }).toThrow('Invalid configuration for provider: invalid');
    });

    test('sets first registered provider as default', () => {
      const config1: AIConfig = { provider: 'mock' };
      const config2: AIConfig = { provider: 'mock' };

      aiService.registerProvider('provider1', config1);
      expect(aiService['defaultProvider']).toBe('provider1');

      aiService.registerProvider('provider2', config2);
      expect(aiService['defaultProvider']).toBe('provider1'); // Should remain first
    });
  });

  describe('setDefaultProvider', () => {
    beforeEach(() => {
      const config: AIConfig = { provider: 'mock' };
      aiService.registerProvider('mock1', config);
      aiService.registerProvider('mock2', config);
    });

    test('sets default provider successfully', () => {
      aiService.setDefaultProvider('mock2');
      expect(aiService['defaultProvider']).toBe('mock2');
    });

    test('throws error for non-existent provider', () => {
      expect(() => {
        aiService.setDefaultProvider('non-existent');
      }).toThrow('Provider not found: non-existent');
    });
  });

  describe('analyze', () => {
    beforeEach(() => {
      const config: AIConfig = { provider: 'mock' };
      aiService.registerProvider('mock', config);
    });

    test('analyzes prompt successfully', async () => {
      const prompt = 'Test prompt';
      const response = await aiService.analyze(prompt);

      expect(response).toBeDefined();
      expect(response.content).toContain('Mock analysis for: Test prompt');
      expect(response.model).toBe('mock');
      expect(response.usage).toBeDefined();
    });

    test('uses specified provider', async () => {
      const config2: AIConfig = { provider: 'mock' };
      aiService.registerProvider('mock2', config2);

      const response = await aiService.analyze('test', { provider: 'mock2' });
      expect(response).toBeDefined();
    });

    test('throws error for non-existent provider', async () => {
      await expect(
        aiService.analyze('test', { provider: 'non-existent' })
      ).rejects.toThrow('Provider not found: non-existent');
    });

    test('caches responses by default', async () => {
      const prompt = 'Cached prompt';
      
      const response1 = await aiService.analyze(prompt);
      expect(response1.cached).toBeUndefined();

      const response2 = await aiService.analyze(prompt);
      expect(response2.cached).toBe(true);
      expect(response2.content).toBe(response1.content);
    });

    test('bypasses cache when useCache is false', async () => {
      const prompt = 'No cache prompt';
      
      await aiService.analyze(prompt);
      const response2 = await aiService.analyze(prompt, { useCache: false });
      
      expect(response2.cached).toBeUndefined();
    });

    test('emits analysis events', async () => {
      const startListener = jest.fn();
      const completeListener = jest.fn();
      
      aiService.on('analysis:start', startListener);
      aiService.on('analysis:complete', completeListener);

      await aiService.analyze('test prompt');

      expect(startListener).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'test prompt',
          provider: 'mock'
        })
      );
      
      expect(completeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'mock',
          response: expect.objectContaining({
            model: 'mock'
          })
        })
      );
    });

    test('emits error event on failure', async () => {
      const errorListener = jest.fn();
      aiService.on('analysis:error', errorListener);

      // Register a provider that will fail
      const config: AIConfig = { 
        provider: 'openai',
        apiKey: 'sk-invalid-key-1234567890123456789012345678901234567890'
      };
      aiService.registerProvider('failing-provider', config);

      // Mock the provider to throw an error
      const failingProvider = aiService['providers'].get('failing-provider');
      if (failingProvider) {
        jest.spyOn(failingProvider, 'analyze').mockRejectedValue(new Error('Mock failure'));
      }

      try {
        await aiService.analyze('test', { provider: 'failing-provider' });
      } catch (error) {
        // Expected to throw
      }

      expect(errorListener).toHaveBeenCalled();
    });

    test('logs usage when response has usage data', async () => {
      const fileHandler = aiService['fileHandler'];
      await aiService.analyze('test');

      expect(fileHandler.saveFile).toHaveBeenCalledWith(
        expect.stringContaining('ai_usage_'),
        expect.any(String),
        'logs',
        { overwrite: false }
      );
    });
  });

  describe('chat', () => {
    beforeEach(() => {
      const config: AIConfig = { provider: 'mock' };
      aiService.registerProvider('mock', config);
    });

    test('chats successfully', async () => {
      const messages: AIMessage[] = [
        { role: 'user', content: 'Hello' }
      ];
      
      const response = await aiService.chat(messages);

      expect(response).toBeDefined();
      expect(response.content).toContain('Mock response');
      expect(response.model).toBe('mock');
    });

    test('handles multiple messages', async () => {
      const messages: AIMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];
      
      const response = await aiService.chat(messages);

      expect(response.content).toContain('Mock response');
    });

    test('caches chat responses', async () => {
      const messages: AIMessage[] = [
        { role: 'user', content: 'Cached chat' }
      ];
      
      const response1 = await aiService.chat(messages);
      expect(response1.cached).toBeUndefined();

      const response2 = await aiService.chat(messages);
      expect(response2.cached).toBe(true);
    });

    test('emits chat events', async () => {
      const startListener = jest.fn();
      const completeListener = jest.fn();
      
      aiService.on('chat:start', startListener);
      aiService.on('chat:complete', completeListener);

      const messages: AIMessage[] = [{ role: 'user', content: 'test' }];
      await aiService.chat(messages);

      expect(startListener).toHaveBeenCalledWith(
        expect.objectContaining({
          messages,
          provider: 'mock'
        })
      );
      
      expect(completeListener).toHaveBeenCalled();
    });
  });

  describe('selectModel', () => {
    test('selects cost-optimized model when cost sensitive', () => {
      const result = aiService.selectModel({ costSensitive: true });
      
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-3.5-turbo');
      expect(result.reason).toContain('Cost-optimized');
    });

    test('selects advanced model for high complexity', () => {
      const result = aiService.selectModel({ complexity: 'high' });
      
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4');
      expect(result.reason).toContain('Advanced reasoning');
    });

    test('selects model for reasoning tasks', () => {
      const result = aiService.selectModel({ requiresReasoning: true });
      
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4');
    });

    test('selects model for long content', () => {
      const result = aiService.selectModel({ contentLength: 10000 });
      
      expect(result.provider).toBe('anthropic');
      expect(result.model).toBe('claude-3-opus');
      expect(result.reason).toContain('Long context');
    });

    test('returns default model for general use', () => {
      const result = aiService.selectModel({});
      
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4-turbo');
      expect(result.reason).toContain('Default balanced');
    });
  });

  describe('clearCache', () => {
    test('clears all cached responses', async () => {
      const config: AIConfig = { provider: 'mock' };
      aiService.registerProvider('mock', config);

      // Add some cached responses
      await aiService.analyze('prompt1');
      await aiService.analyze('prompt2');
      
      expect(aiService['cache'].size).toBeGreaterThan(0);

      aiService.clearCache();
      
      expect(aiService['cache'].size).toBe(0);
    });
  });

  describe('getUsageStats', () => {
    test('returns usage statistics structure', async () => {
      const stats = await aiService.getUsageStats();
      
      expect(stats).toEqual({
        totalTokens: 0,
        totalCost: 0,
        byProvider: {}
      });
    });

    test('accepts date range parameters', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const stats = await aiService.getUsageStats(startDate, endDate);
      
      expect(stats).toBeDefined();
    });
  });
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  describe('constructor', () => {
    test('creates provider with valid config', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'sk-test-key-1234567890123456789012345678901234567890',
        model: 'gpt-4'
      };

      provider = new OpenAIProvider(config);
      expect(provider).toBeDefined();
    });

    test('creates provider even without API key (validation happens later)', () => {
      const config: AIConfig = {
        provider: 'openai'
        // No apiKey provided
      };

      const provider = new OpenAIProvider(config);
      expect(provider).toBeDefined();
      expect(provider.validateConfig()).toBe(false);
    });
  });

  describe('validateConfig', () => {
    test('returns true for valid config', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'sk-test-key-1234567890123456789012345678901234567890'
      };

      provider = new OpenAIProvider(config);
      expect(provider.validateConfig()).toBe(true);
    });

    test('returns false for missing API key', () => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: undefined
      };

      // Force create provider for testing
      provider = Object.create(OpenAIProvider.prototype);
      provider['config'] = config;
      
      expect(provider.validateConfig()).toBe(false);
    });
  });

  describe('analyze', () => {
    beforeEach(() => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'sk-test-key-1234567890123456789012345678901234567890'
      };
      provider = new OpenAIProvider(config);
    });

    test('analyzes prompt successfully', async () => {
      const response = await provider.analyze('Test prompt');
      
      expect(response).toBeDefined();
      expect(response.content).toContain('Mock response');
      expect(response.model).toBe('gpt-4');
      expect(response.usage).toBeDefined();
      expect(response.cost).toBeGreaterThan(0);
    });

    test('includes system prompt when provided', async () => {
      const options: AIAnalysisOptions = {
        systemPrompt: 'You are a helpful assistant'
      };
      
      const response = await provider.analyze('Test prompt', options);
      expect(response).toBeDefined();
    });
  });

  describe('chat', () => {
    beforeEach(() => {
      const config: AIConfig = {
        provider: 'openai',
        apiKey: 'sk-test-key-1234567890123456789012345678901234567890',
        model: 'gpt-4-turbo'
      };
      provider = new OpenAIProvider(config);
    });

    test('handles chat messages', async () => {
      const messages: AIMessage[] = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Hello' }
      ];
      
      const response = await provider.chat(messages);
      
      expect(response).toBeDefined();
      expect(response.model).toBe('gpt-4-turbo');
      expect(response.usage?.totalTokens).toBe(150);
    });
  });
});

describe('MockAIProvider', () => {
  let provider: MockAIProvider;

  beforeEach(() => {
    const config: AIConfig = { provider: 'mock' };
    provider = new MockAIProvider(config);
  });

  describe('validateConfig', () => {
    test('always returns true', () => {
      expect(provider.validateConfig()).toBe(true);
    });
  });

  describe('analyze', () => {
    test('returns mock analysis', async () => {
      const response = await provider.analyze('Test prompt for mock');
      
      expect(response.content).toContain('Mock analysis for: Test prompt for mock');
      expect(response.model).toBe('mock');
      expect(response.cost).toBe(0);
    });
  });

  describe('chat', () => {
    test('returns mock chat response', async () => {
      const messages: AIMessage[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' }
      ];
      
      const response = await provider.chat(messages);
      
      expect(response.content).toBe('Mock response');
      expect(response.model).toBe('mock');
      expect(response.usage?.totalTokens).toBe(15);
    });
  });
});