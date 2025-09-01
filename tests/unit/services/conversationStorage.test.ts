/**
 * Unit tests for ConversationStorage Service
 */

import ConversationStorage, { getConversationStorage } from '../../../src/services/conversationStorage';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import * as fs from 'fs-extra';
import path from 'path';

// Mock winston-daily-rotate-file
jest.mock('winston-daily-rotate-file', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    log: jest.fn()
  }));
});

// Mock dependencies
jest.mock('lowdb');
jest.mock('lowdb/node');
jest.mock('fs-extra');
jest.mock('../../../src/core', () => ({
  ...jest.requireActual('../../../src/core'),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock path and url modules
jest.mock('url', () => ({
  fileURLToPath: jest.fn(() => '/mocked/path/to/file.js')
}));

describe('ConversationStorage', () => {
  let storage: ConversationStorage;
  let mockDb: any;
  let mockAdapter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock database
    mockDb = {
      data: {
        conversations: {}
      },
      read: jest.fn().mockResolvedValue(undefined),
      write: jest.fn().mockResolvedValue(undefined)
    };

    mockAdapter = {};
    
    // Mock Low constructor
    (Low as jest.MockedClass<typeof Low>).mockImplementation(() => mockDb as any);
    (JSONFile as jest.MockedClass<typeof JSONFile>).mockImplementation(() => mockAdapter);
    
    // Mock fs-extra
    (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
    
    storage = new ConversationStorage();
  });

  describe('initialize', () => {
    test('initializes database successfully', async () => {
      await storage.initialize();
      
      expect(fs.ensureDir).toHaveBeenCalledWith(expect.stringContaining('data'));
      expect(JSONFile).toHaveBeenCalledWith(expect.stringContaining('conversations.json'));
      expect(Low).toHaveBeenCalled();
      expect(mockDb.read).toHaveBeenCalled();
    });

    test('creates default data if file does not exist', async () => {
      mockDb.data = null;
      
      await storage.initialize();
      
      expect(mockDb.data).toEqual({ conversations: {} });
      expect(mockDb.write).toHaveBeenCalled();
    });

    test('ensures conversations object exists', async () => {
      mockDb.data = {};
      
      await storage.initialize();
      
      expect(mockDb.data.conversations).toEqual({});
      expect(mockDb.write).toHaveBeenCalled();
    });

    test('does not reinitialize if already initialized', async () => {
      await storage.initialize();
      jest.clearAllMocks();
      
      await storage.initialize();
      
      expect(Low).not.toHaveBeenCalled();
    });

    test('handles initialization errors', async () => {
      (fs.ensureDir as jest.Mock).mockRejectedValue(new Error('Directory error'));
      
      await expect(storage.initialize()).rejects.toThrow('Directory error');
    });
  });

  describe('getConversation', () => {
    test('returns existing conversation', async () => {
      const mockConversation = {
        id: 'conv1',
        messages: [{ role: 'user', content: 'Hello' }],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      
      mockDb.data.conversations['conv1'] = mockConversation;
      
      const result = await storage.getConversation('conv1');
      
      expect(result).toEqual(mockConversation);
    });

    test('returns null for non-existent conversation', async () => {
      const result = await storage.getConversation('nonexistent');
      
      expect(result).toBeNull();
    });
  });

  describe('saveConversation', () => {
    test('saves new conversation', async () => {
      const conversation = {
        title: 'Test Conversation',
        messages: [
          { role: 'user' as const, content: 'Hello' },
          { role: 'assistant' as const, content: 'Hi there!' }
        ]
      };
      
      const result = await storage.saveConversation('conv1', conversation);
      
      expect(result).toMatchObject({
        id: 'conv1',
        title: 'Test Conversation',
        messages: conversation.messages
      });
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
      expect(mockDb.write).toHaveBeenCalled();
    });

    test('updates existing conversation', async () => {
      const originalCreatedAt = '2024-01-01T00:00:00Z';
      mockDb.data.conversations['conv1'] = {
        id: 'conv1',
        messages: [],
        createdAt: originalCreatedAt,
        updatedAt: originalCreatedAt
      };
      
      const update = {
        messages: [{ role: 'user' as const, content: 'Updated' }]
      };
      
      const result = await storage.saveConversation('conv1', update);
      
      expect(result.createdAt).toBe(originalCreatedAt);
      expect(result.updatedAt).not.toBe(originalCreatedAt);
      expect(result.messages).toEqual(update.messages);
    });

    test('preserves metadata', async () => {
      const conversation = {
        messages: [],
        metadata: {
          model: 'gpt-4',
          temperature: 0.7
        }
      };
      
      const result = await storage.saveConversation('conv1', conversation);
      
      expect(result.metadata).toEqual(conversation.metadata);
    });
  });

  describe('deleteConversation', () => {
    test('deletes existing conversation', async () => {
      mockDb.data.conversations['conv1'] = {
        id: 'conv1',
        messages: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      
      const result = await storage.deleteConversation('conv1');
      
      expect(result).toBe(true);
      expect(mockDb.data.conversations['conv1']).toBeUndefined();
      expect(mockDb.write).toHaveBeenCalled();
    });

    test('returns false for non-existent conversation', async () => {
      const result = await storage.deleteConversation('nonexistent');
      
      expect(result).toBe(false);
      expect(mockDb.write).not.toHaveBeenCalled();
    });
  });

  describe('getAllConversations', () => {
    test('returns all conversations', async () => {
      mockDb.data.conversations = {
        'conv1': { id: 'conv1', messages: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        'conv2': { id: 'conv2', messages: [], createdAt: '2024-01-02', updatedAt: '2024-01-02' },
        'conv3': { id: 'conv3', messages: [], createdAt: '2024-01-03', updatedAt: '2024-01-03' }
      };
      
      const result = await storage.getAllConversations();
      
      expect(result).toHaveLength(3);
      expect(result.map(c => c.id)).toEqual(['conv1', 'conv2', 'conv3']);
    });

    test('returns empty array when no conversations', async () => {
      mockDb.data.conversations = {};
      
      const result = await storage.getAllConversations();
      
      expect(result).toEqual([]);
    });
  });

  describe('getRecentConversations', () => {
    test('returns conversations sorted by updatedAt', async () => {
      mockDb.data.conversations = {
        'conv1': { id: 'conv1', messages: [], createdAt: '2024-01-01', updatedAt: '2024-01-05' },
        'conv2': { id: 'conv2', messages: [], createdAt: '2024-01-02', updatedAt: '2024-01-03' },
        'conv3': { id: 'conv3', messages: [], createdAt: '2024-01-03', updatedAt: '2024-01-07' }
      };
      
      const result = await storage.getRecentConversations();
      
      expect(result[0].id).toBe('conv3');
      expect(result[1].id).toBe('conv1');
      expect(result[2].id).toBe('conv2');
    });

    test('respects limit parameter', async () => {
      mockDb.data.conversations = {
        'conv1': { id: 'conv1', messages: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        'conv2': { id: 'conv2', messages: [], createdAt: '2024-01-02', updatedAt: '2024-01-02' },
        'conv3': { id: 'conv3', messages: [], createdAt: '2024-01-03', updatedAt: '2024-01-03' },
        'conv4': { id: 'conv4', messages: [], createdAt: '2024-01-04', updatedAt: '2024-01-04' },
        'conv5': { id: 'conv5', messages: [], createdAt: '2024-01-05', updatedAt: '2024-01-05' }
      };
      
      const result = await storage.getRecentConversations(2);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('conv5');
      expect(result[1].id).toBe('conv4');
    });

    test('uses default limit of 10', async () => {
      // Create 15 conversations
      mockDb.data.conversations = {};
      for (let i = 1; i <= 15; i++) {
        mockDb.data.conversations[`conv${i}`] = {
          id: `conv${i}`,
          messages: [],
          createdAt: `2024-01-${i.toString().padStart(2, '0')}`,
          updatedAt: `2024-01-${i.toString().padStart(2, '0')}`
        };
      }
      
      const result = await storage.getRecentConversations();
      
      expect(result).toHaveLength(10);
    });
  });

  describe('addMessage', () => {
    test('adds message to existing conversation', async () => {
      mockDb.data.conversations['conv1'] = {
        id: 'conv1',
        messages: [{ role: 'user', content: 'Hello' }],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      
      const newMessage = { role: 'assistant' as const, content: 'Hi there!' };
      const result = await storage.addMessage('conv1', newMessage);
      
      expect(result.messages).toHaveLength(2);
      expect(result.messages[1]).toMatchObject(newMessage);
      expect(result.messages[1].timestamp).toBeDefined();
      expect(mockDb.write).toHaveBeenCalled();
    });

    test('creates new conversation if not exists', async () => {
      const message = { role: 'user' as const, content: 'New conversation' };
      const result = await storage.addMessage('newconv', message);
      
      expect(result.id).toBe('newconv');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toMatchObject(message);
      expect(result.createdAt).toBeDefined();
      expect(mockDb.data.conversations['newconv']).toBeDefined();
    });

    test('preserves existing timestamp on message', async () => {
      const timestamp = '2024-01-01T12:00:00Z';
      const message = { 
        role: 'user' as const, 
        content: 'Message with timestamp',
        timestamp
      };
      
      const result = await storage.addMessage('conv1', message);
      
      expect(result.messages[0].timestamp).toBe(timestamp);
    });

    test('updates conversation updatedAt', async () => {
      const oldUpdatedAt = '2024-01-01T00:00:00Z';
      mockDb.data.conversations['conv1'] = {
        id: 'conv1',
        messages: [],
        createdAt: oldUpdatedAt,
        updatedAt: oldUpdatedAt
      };
      
      const message = { role: 'user' as const, content: 'Update trigger' };
      const result = await storage.addMessage('conv1', message);
      
      expect(result.updatedAt).not.toBe(oldUpdatedAt);
    });
  });

  describe('clearAllConversations', () => {
    test('clears all conversations', async () => {
      mockDb.data.conversations = {
        'conv1': { id: 'conv1', messages: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        'conv2': { id: 'conv2', messages: [], createdAt: '2024-01-02', updatedAt: '2024-01-02' }
      };
      
      await storage.clearAllConversations();
      
      expect(mockDb.data.conversations).toEqual({});
      expect(mockDb.write).toHaveBeenCalled();
    });
  });

  describe('exportConversations', () => {
    test('exports all data', async () => {
      const testData = {
        conversations: {
          'conv1': { id: 'conv1', messages: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          'conv2': { id: 'conv2', messages: [], createdAt: '2024-01-02', updatedAt: '2024-01-02' }
        }
      };
      
      mockDb.data = testData;
      
      const result = await storage.exportConversations();
      
      expect(result).toEqual(testData);
      expect(result).not.toBe(testData); // Should be a copy
    });
  });

  describe('importConversations', () => {
    test('imports conversation data', async () => {
      const importData = {
        conversations: {
          'imported1': { id: 'imported1', messages: [], createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          'imported2': { id: 'imported2', messages: [], createdAt: '2024-01-02', updatedAt: '2024-01-02' }
        }
      };
      
      await storage.importConversations(importData);
      
      expect(mockDb.data).toEqual(importData);
      expect(mockDb.write).toHaveBeenCalled();
    });
  });

  describe('getConversationStats', () => {
    test('calculates statistics correctly', async () => {
      mockDb.data.conversations = {
        'conv1': {
          id: 'conv1',
          messages: [
            { role: 'user', content: 'Message 1' },
            { role: 'assistant', content: 'Response 1' }
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-05T00:00:00Z'
        },
        'conv2': {
          id: 'conv2',
          messages: [
            { role: 'user', content: 'Message 2' },
            { role: 'assistant', content: 'Response 2' },
            { role: 'user', content: 'Message 3' }
          ],
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-06T00:00:00Z'
        },
        'conv3': {
          id: 'conv3',
          messages: [
            { role: 'user', content: 'Message 4' }
          ],
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-07T00:00:00Z'
        }
      };
      
      const stats = await storage.getConversationStats();
      
      expect(stats.total).toBe(3);
      expect(stats.totalMessages).toBe(6);
      expect(stats.averageLength).toBe(2);
      expect(stats.oldestConversation).toBe('2024-01-01T00:00:00Z');
      expect(stats.newestConversation).toBe('2024-01-03T00:00:00Z');
    });

    test('handles empty conversations', async () => {
      mockDb.data.conversations = {};
      
      const stats = await storage.getConversationStats();
      
      expect(stats.total).toBe(0);
      expect(stats.totalMessages).toBe(0);
      expect(stats.averageLength).toBe(0);
      expect(stats.oldestConversation).toBeNull();
      expect(stats.newestConversation).toBeNull();
    });

    test('calculates average correctly with single conversation', async () => {
      mockDb.data.conversations = {
        'conv1': {
          id: 'conv1',
          messages: [
            { role: 'user', content: 'Message 1' },
            { role: 'assistant', content: 'Response 1' },
            { role: 'user', content: 'Message 2' },
            { role: 'assistant', content: 'Response 2' }
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      };
      
      const stats = await storage.getConversationStats();
      
      expect(stats.averageLength).toBe(4);
    });
  });

  describe('getConversationStorage singleton', () => {
    test('returns singleton instance', () => {
      const instance1 = getConversationStorage();
      const instance2 = getConversationStorage();
      
      expect(instance1).toBe(instance2);
    });

    test('singleton instance works correctly', async () => {
      const instance = getConversationStorage();
      
      // Mock the internal db for this instance
      (instance as any).db = mockDb;
      (instance as any).initialized = true;
      
      const conversations = await instance.getAllConversations();
      
      expect(Array.isArray(conversations)).toBe(true);
    });
  });
});