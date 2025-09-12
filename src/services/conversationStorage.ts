/**
 * Conversation Storage Service
 * Provides persistent storage for AI conversations using lowdb
 */

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import fs from "fs-extra";
import { createLogger } from "../core/index.js";
let logger: any; // Will be initialized when needed

function ensureLogger() {
  if (!logger) {
    logger = createLogger("ConversationStorage");
  }
  return logger;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

interface Conversation {
  id: string;
  title?: string;
  messages: Message[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface ConversationsDB {
  conversations: Record<string, Conversation>;
}

const defaultData: ConversationsDB = {
  conversations: {},
};

class ConversationStorage {
  private db: Low<ConversationsDB> | null = null;
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      const dataDir = path.join(process.cwd(), "data");
      await fs.ensureDir(dataDir);

      // Initialize lowdb with JSON file adapter
      const dbPath = path.join(dataDir, "conversations.json");
      const adapter = new JSONFile<ConversationsDB>(dbPath);
      this.db = new Low<ConversationsDB>(adapter, defaultData);

      // Read data from file
      await this.db.read();

      // Initialize with default data if file doesn't exist
      if (!this.db.data) {
        this.db.data = defaultData;
        await this.db.write();
      }

      // Ensure conversations object exists
      if (!this.db.data.conversations) {
        this.db.data.conversations = {};
        await this.db.write();
      }

      this.initialized = true;
      ensureLogger().info("Conversation storage initialized");
    } catch (_error) {
      ensureLogger().error(
        "Failed to initialize conversation storage:",
        _error,
      );
      throw _error;
    }
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    await this.initialize();
    return this.db!.data!.conversations[conversationId] || null;
  }

  async saveConversation(
    conversationId: string,
    conversation: Partial<Conversation>,
  ): Promise<Conversation> {
    await this.initialize();

    const now = new Date().toISOString();
    const fullConversation: Conversation = {
      id: conversationId,
      messages: [],
      ...conversation,
      createdAt: conversation.createdAt || now,
      updatedAt: now,
    };

    this.db!.data!.conversations[conversationId] = fullConversation;
    await this.db!.write();

    ensureLogger().debug(`Saved conversation: ${conversationId}`);
    return fullConversation;
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    await this.initialize();

    if (this.db!.data!.conversations[conversationId]) {
      delete this.db!.data!.conversations[conversationId];
      await this.db!.write();
      ensureLogger().debug(`Deleted conversation: ${conversationId}`);
      return true;
    }

    return false;
  }

  async getAllConversations(): Promise<Conversation[]> {
    await this.initialize();
    return Object.values(this.db!.data!.conversations);
  }

  async getRecentConversations(limit: number = 10): Promise<Conversation[]> {
    await this.initialize();
    const conversations = Object.values(this.db!.data!.conversations);

    return conversations
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, limit);
  }

  async addMessage(
    conversationId: string,
    message: Message,
  ): Promise<Conversation> {
    await this.initialize();

    let conversation = this.db!.data!.conversations[conversationId];

    if (!conversation) {
      conversation = {
        id: conversationId,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    message.timestamp = message.timestamp || new Date().toISOString();
    conversation.messages.push(message);
    conversation.updatedAt = new Date().toISOString();

    this.db!.data!.conversations[conversationId] = conversation;
    await this.db!.write();

    return conversation;
  }

  async clearAllConversations(): Promise<void> {
    await this.initialize();
    this.db!.data!.conversations = {};
    await this.db!.write();
    ensureLogger().info("Cleared all conversations");
  }

  async exportConversations(): Promise<ConversationsDB> {
    await this.initialize();
    return { ...this.db!.data! };
  }

  async importConversations(data: ConversationsDB): Promise<void> {
    await this.initialize();
    this.db!.data = data;
    await this.db!.write();
    ensureLogger().info("Imported conversations");
  }

  async getConversationStats(): Promise<Record<string, any>> {
    await this.initialize();
    const conversations = Object.values(this.db!.data!.conversations);

    return {
      total: conversations.length,
      totalMessages: conversations.reduce(
        (sum, c) => sum + c.messages.length,
        0,
      ),
      averageLength:
        conversations.length > 0
          ? conversations.reduce((sum, c) => sum + c.messages.length, 0) /
            conversations.length
          : 0,
      oldestConversation:
        conversations.length > 0
          ? conversations.reduce((oldest, c) =>
              new Date(c.createdAt) < new Date(oldest.createdAt) ? c : oldest,
            ).createdAt
          : null,
      newestConversation:
        conversations.length > 0
          ? conversations.reduce((newest, c) =>
              new Date(c.createdAt) > new Date(newest.createdAt) ? c : newest,
            ).createdAt
          : null,
    };
  }
}

// Singleton instance
let conversationStorage: ConversationStorage | null = null;

export function getConversationStorage(): ConversationStorage {
  if (!conversationStorage) {
    conversationStorage = new ConversationStorage();
  }
  return conversationStorage;
}

export default ConversationStorage;
