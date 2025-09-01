/**
 * Jest Setup File (TypeScript)
 * Global test configuration using TestServer utility
 */

import { setupTestServer, teardownTestServer, getTestServer } from '../src/testing/TestServer';
import type { TestServer } from '../src/testing/TestServer';

// Global test configuration
global.API_BASE = 'http://localhost:5174';
global.TEST_TIMEOUT = 5000;

// Extend global namespace for TypeScript
declare global {
  var API_BASE: string;
  var TEST_TIMEOUT: number;
  var testUtils: {
    request: (endpoint: string, options?: any) => Promise<any>;
    getServer: () => TestServer | null;
  };
}

// Jest global setup
beforeAll(async () => {
  await setupTestServer({
    entryPoint: 'src/index.ts',
    port: 5174,
    apiBase: 'http://localhost:5174',
    healthEndpoint: '/api/health',
    startupTimeout: 15000,
    silent: true
  });
}, 20000);

// Jest global teardown
afterAll(async () => {
  await teardownTestServer();
});

// Global test utilities
global.testUtils = {
  // HTTP request helper using TestServer
  async request(endpoint: string, options: any = {}) {
    const server = getTestServer();
    if (!server) {
      throw new Error('Test server not initialized');
    }
    return server.request(endpoint, options);
  },
  
  // Get server instance
  getServer() {
    return getTestServer();
  }
};

export {};