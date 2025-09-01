/**
 * Unit tests for WebSocket Server
 */

import { WebSocketServer, createWebSocketServer } from '../../../src/services/websocketServer';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

// Mock socket.io
jest.mock('socket.io');

describe('WebSocket Server', () => {
  let wsServer: WebSocketServer;
  let mockHttpServer: HTTPServer;
  let mockIO: jest.Mocked<SocketIOServer>;
  let mockSocket: jest.Mocked<Socket>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock HTTP server
    mockHttpServer = {} as HTTPServer;
    
    // Create mock Socket.IO server
    mockIO = {
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      sockets: {
        sockets: new Map()
      }
    } as any;
    
    // Create mock socket
    mockSocket = {
      id: 'test-socket-id',
      emit: jest.fn(),
      on: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn()
    } as any;
    
    // Setup Server mock to return our mock IO
    (SocketIOServer as unknown as jest.Mock).mockImplementation(() => mockIO);
    
    // Create WebSocket server
    wsServer = createWebSocketServer(mockHttpServer);
  });

  describe('initialization', () => {
    test('initializes socket.io server', () => {
      wsServer.initialize();
      
      expect(SocketIOServer).toHaveBeenCalledWith(
        mockHttpServer,
        expect.objectContaining({
          cors: expect.objectContaining({
            origin: "*"
          })
        })
      );
    });
    
    test('sets up connection handlers', () => {
      wsServer.initialize();
      
      expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('broadcast', () => {
    test('broadcasts simulator updates', () => {
      wsServer.initialize();
      
      wsServer.broadcast('simulator:created', {
        simulatorId: 'sim-123',
        name: 'Test Simulator'
      });
      
      expect(mockIO.emit).toHaveBeenCalledWith('simulator:created', expect.objectContaining({
        simulatorId: 'sim-123'
      }));
    });
    
    test('broadcasts template updates', () => {
      wsServer.initialize();
      
      wsServer.broadcast('template:updated', {
        templateId: 'tpl-123',
        name: 'Updated Template'
      });
      
      expect(mockIO.emit).toHaveBeenCalledWith('template:updated', expect.objectContaining({
        templateId: 'tpl-123'
      }));
    });
    
    test('broadcasts data updates', () => {
      wsServer.initialize();
      
      wsServer.broadcast('simulator:data', {
        simulatorId: 'sim-123',
        values: { register1: 100 }
      });
      
      expect(mockIO.emit).toHaveBeenCalledWith('simulator:data', expect.objectContaining({
        simulatorId: 'sim-123'
      }));
    });
  });
  
  describe('client management', () => {
    test('tracks connected clients', () => {
      wsServer.initialize();
      
      // Simulate connection
      const connectionHandler = mockIO.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      if (connectionHandler) {
        connectionHandler(mockSocket);
      }
      
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
    
    test('handles client subscriptions', () => {
      wsServer.initialize();
      
      // Simulate connection and subscription
      const connectionHandler = mockIO.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      if (connectionHandler) {
        connectionHandler(mockSocket);
        
        // Find and call the subscribe handler
        const subscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'subscribe:simulator')?.[1];
        if (subscribeHandler) {
          subscribeHandler('sim-123');
        }
      }
      
      expect(mockSocket.on).toHaveBeenCalledWith('subscribe:simulator', expect.any(Function));
    });
    
    test('handles client unsubscriptions', () => {
      wsServer.initialize();
      
      // Simulate connection and unsubscription
      const connectionHandler = mockIO.on.mock.calls.find(call => call[0] === 'connection')?.[1];
      if (connectionHandler) {
        connectionHandler(mockSocket);
        
        // Find and call the unsubscribe handler
        const unsubscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'unsubscribe:simulator')?.[1];
        if (unsubscribeHandler) {
          unsubscribeHandler('sim-123');
        }
      }
      
      expect(mockSocket.on).toHaveBeenCalledWith('unsubscribe:simulator', expect.any(Function));
    });
  });
  
  describe('error handling', () => {
    test('handles broadcast when IO is not initialized', () => {
      // Don't initialize wsServer - IO will be null
      const uninitializedServer = new WebSocketServer(mockHttpServer);
      
      // Should not throw when IO is null
      expect(() => {
        uninitializedServer.broadcast('test:event', { test: 'data' });
      }).not.toThrow();
    });
    
    test('handles initialization without HTTP server gracefully', () => {
      const wsServerWithoutHttp = new WebSocketServer(null as any);
      
      // Should not throw
      expect(() => {
        wsServerWithoutHttp.initialize();
      }).not.toThrow();
    });
  });
});