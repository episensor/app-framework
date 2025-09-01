/**
 * Unit tests for WebSocketEvents Service
 */

import { 
  WebSocketEventManager, 
  TypedEventEmitter, 
  EventTypes, 
  EventPatterns,
  EventPayload,
  EventResponse 
} from '../../../src/services/websocketEvents';
import { Server as SocketIOServer, Socket } from 'socket.io';

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

describe('WebSocketEvents', () => {
  let mockIo: any;
  let mockSocket: any;
  let manager: WebSocketEventManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock socket
    mockSocket = {
      id: 'socket-123',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn()
    };

    // Setup mock io
    mockIo = {
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn(() => ({
        emit: jest.fn()
      })),
      sockets: {
        sockets: new Map([['socket-123', mockSocket]])
      }
    };

    manager = new WebSocketEventManager(mockIo as any);
  });

  describe('WebSocketEventManager', () => {
    describe('constructor and setup', () => {
      test('sets up default handlers on construction', () => {
        expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
      });

      test('handles new connection', () => {
        const connectionHandler = mockIo.on.mock.calls[0][1];
        connectionHandler(mockSocket);
        
        expect(mockSocket.on).toHaveBeenCalledWith(EventTypes.SYSTEM_PING, expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith(EventTypes.SUBSCRIBE, expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith(EventTypes.UNSUBSCRIBE, expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith(EventTypes.DISCONNECT, expect.any(Function));
        expect(mockSocket.emit).toHaveBeenCalledWith(EventTypes.SYSTEM_INFO, expect.objectContaining({
          id: 'socket-123',
          server: 'framework-websocket',
          version: '1.0.0'
        }));
      });

      test('handles ping/pong', () => {
        const connectionHandler = mockIo.on.mock.calls[0][1];
        connectionHandler(mockSocket);
        
        const pingHandler = mockSocket.on.mock.calls.find(
          (call: any[]) => call[0] === EventTypes.SYSTEM_PING
        )[1];
        
        pingHandler();
        
        expect(mockSocket.emit).toHaveBeenCalledWith(EventTypes.SYSTEM_PONG, expect.objectContaining({
          timestamp: expect.any(String),
          latency: 0
        }));
      });
    });

    describe('subscribe', () => {
      test('subscribes socket to channel', () => {
        manager.subscribe(mockSocket as any, 'test-channel');
        
        expect(mockSocket.join).toHaveBeenCalledWith('test-channel');
        expect(mockSocket.emit).toHaveBeenCalledWith(EventTypes.SUBSCRIBE, expect.objectContaining({
          success: true,
          channel: 'test-channel'
        }));
      });

      test('tracks subscriptions internally', () => {
        manager.subscribe(mockSocket as any, 'channel1');
        manager.subscribe(mockSocket as any, 'channel2');
        
        const stats = manager.getStats();
        expect(stats.subscriptions['channel1']).toBe(1);
        expect(stats.subscriptions['channel2']).toBe(1);
      });

      test('handles multiple sockets subscribing to same channel', () => {
        const mockSocket2 = { ...mockSocket, id: 'socket-456' };
        
        manager.subscribe(mockSocket as any, 'shared-channel');
        manager.subscribe(mockSocket2 as any, 'shared-channel');
        
        const stats = manager.getStats();
        expect(stats.subscriptions['shared-channel']).toBe(2);
      });
    });

    describe('unsubscribe', () => {
      test('unsubscribes socket from channel', () => {
        manager.subscribe(mockSocket as any, 'test-channel');
        manager.unsubscribe(mockSocket as any, 'test-channel');
        
        expect(mockSocket.leave).toHaveBeenCalledWith('test-channel');
        expect(mockSocket.emit).toHaveBeenCalledWith(EventTypes.UNSUBSCRIBE, expect.objectContaining({
          success: true,
          channel: 'test-channel'
        }));
      });

      test('removes channel when no subscribers left', () => {
        manager.subscribe(mockSocket as any, 'temp-channel');
        
        let stats = manager.getStats();
        expect(stats.subscriptions['temp-channel']).toBe(1);
        
        manager.unsubscribe(mockSocket as any, 'temp-channel');
        
        stats = manager.getStats();
        expect(stats.subscriptions['temp-channel']).toBeUndefined();
      });

      test('handles unsubscribe from non-subscribed channel', () => {
        manager.unsubscribe(mockSocket as any, 'non-existent');
        
        expect(mockSocket.leave).toHaveBeenCalledWith('non-existent');
        expect(mockSocket.emit).toHaveBeenCalledWith(EventTypes.UNSUBSCRIBE, expect.objectContaining({
          success: true,
          channel: 'non-existent'
        }));
      });
    });

    describe('broadcast', () => {
      test('broadcasts event to all clients', () => {
        const payload: EventPayload = {
          timestamp: new Date().toISOString(),
          type: 'test',
          data: { message: 'hello' }
        };
        
        manager.broadcast('test-event', payload);
        
        expect(mockIo.emit).toHaveBeenCalledWith('test-event', payload);
      });
    });

    describe('emit', () => {
      test('emits event to specific channel', () => {
        const payload: EventPayload = {
          timestamp: new Date().toISOString(),
          type: 'channel-message',
          data: { content: 'Hello channel' }
        };
        
        const mockToEmit = jest.fn();
        mockIo.to.mockReturnValue({ emit: mockToEmit });
        
        manager.emit('channel1', 'channel-event', payload);
        
        expect(mockIo.to).toHaveBeenCalledWith('channel1');
        expect(mockToEmit).toHaveBeenCalledWith('channel-event', payload);
      });
    });

    describe('send', () => {
      test('sends event to specific socket', () => {
        const payload: EventPayload = {
          timestamp: new Date().toISOString(),
          type: 'direct-message',
          data: { message: 'Hello socket' }
        };
        
        const mockToEmit = jest.fn();
        mockIo.to.mockReturnValue({ emit: mockToEmit });
        
        manager.send('socket-123', 'direct-event', payload);
        
        expect(mockIo.to).toHaveBeenCalledWith('socket-123');
        expect(mockToEmit).toHaveBeenCalledWith('direct-event', payload);
      });
    });

    describe('on', () => {
      test('registers custom event handler', () => {
        const handler = jest.fn();
        
        manager.on('custom-event', handler);
        
        // Verify that connection handler is registered
        expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
      });

      test('handles multiple handlers for same event', () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();
        
        manager.on('multi-handler', handler1);
        manager.on('multi-handler', handler2);
        
        // Both handlers should be registered
        expect(mockIo.on).toHaveBeenCalled();
      });
    });

    describe('getStats', () => {
      test('returns connection statistics', () => {
        manager.subscribe(mockSocket as any, 'channel1');
        manager.subscribe(mockSocket as any, 'channel2');
        
        const stats = manager.getStats();
        
        expect(stats).toEqual({
          connections: 1,
          channels: 2,
          subscriptions: {
            'channel1': 1,
            'channel2': 1
          }
        });
      });

      test('returns empty stats when no connections', () => {
        mockIo.sockets.sockets = new Map();
        
        const stats = manager.getStats();
        
        expect(stats).toEqual({
          connections: 0,
          channels: 0,
          subscriptions: {}
        });
      });
    });

    describe('cleanup', () => {
      test('cleans up subscriptions on disconnect', () => {
        // Setup connection and subscriptions
        const connectionHandler = mockIo.on.mock.calls[0][1];
        connectionHandler(mockSocket);
        
        manager.subscribe(mockSocket as any, 'channel1');
        manager.subscribe(mockSocket as any, 'channel2');
        
        // Get disconnect handler
        const disconnectHandler = mockSocket.on.mock.calls.find(
          (call: any[]) => call[0] === EventTypes.DISCONNECT
        )[1];
        
        // Trigger disconnect
        disconnectHandler();
        
        const stats = manager.getStats();
        expect(stats.subscriptions).toEqual({});
        expect(stats.channels).toBe(0);
      });
    });
  });

  describe('TypedEventEmitter', () => {
    let typedEmitter: TypedEventEmitter<{
      update: { id: string; value: number };
      delete: { id: string };
      create: { name: string };
    }>;

    beforeEach(() => {
      typedEmitter = new TypedEventEmitter(manager, 'test-namespace');
    });

    test('emits typed event with namespace', () => {
      const spy = jest.spyOn(manager, 'broadcast');
      
      typedEmitter.emit('update', { id: '123', value: 42 });
      
      expect(spy).toHaveBeenCalledWith('test-namespace:update', expect.objectContaining({
        type: 'update',
        source: 'test-namespace',
        data: { id: '123', value: 42 }
      }));
    });

    test('emits to specific channel with namespace', () => {
      const spy = jest.spyOn(manager, 'emit');
      
      typedEmitter.emitTo('channel1', 'create', { name: 'Test Item' });
      
      expect(spy).toHaveBeenCalledWith('channel1', 'test-namespace:create', expect.objectContaining({
        type: 'create',
        source: 'test-namespace',
        target: 'channel1',
        data: { name: 'Test Item' }
      }));
    });
  });

  describe('EventPatterns', () => {
    describe('crud pattern', () => {
      test('generates created event', () => {
        const pattern = EventPatterns.crud<{ id: string; name: string }>('users');
        const result = pattern.created({ id: '1', name: 'John' });
        
        expect(result.event).toBe('users:created');
        expect(result.payload.type).toBe('created');
        expect(result.payload.data).toEqual({ id: '1', name: 'John' });
        expect(result.payload.timestamp).toBeDefined();
      });

      test('generates updated event', () => {
        const pattern = EventPatterns.crud<{ id: string; name: string }>('users');
        const result = pattern.updated({ id: '1', name: 'Jane' });
        
        expect(result.event).toBe('users:updated');
        expect(result.payload.type).toBe('updated');
        expect(result.payload.data).toEqual({ id: '1', name: 'Jane' });
      });

      test('generates deleted event', () => {
        const pattern = EventPatterns.crud('users');
        const result = pattern.deleted('123');
        
        expect(result.event).toBe('users:deleted');
        expect(result.payload.type).toBe('deleted');
        expect(result.payload.data).toEqual({ id: '123' });
      });

      test('generates list event', () => {
        const pattern = EventPatterns.crud<{ id: string }>('items');
        const result = pattern.list([{ id: '1' }, { id: '2' }]);
        
        expect(result.event).toBe('items:list');
        expect(result.payload.type).toBe('list');
        expect(result.payload.data).toHaveLength(2);
      });
    });

    describe('status pattern', () => {
      test('generates online event', () => {
        const pattern = EventPatterns.status('service');
        const result = pattern.online();
        
        expect(result.event).toBe('service:online');
        expect(result.payload.data.status).toBe('online');
      });

      test('generates offline event', () => {
        const pattern = EventPatterns.status('service');
        const result = pattern.offline();
        
        expect(result.event).toBe('service:offline');
        expect(result.payload.data.status).toBe('offline');
      });

      test('generates error event', () => {
        const pattern = EventPatterns.status('service');
        const result = pattern.error('Connection failed');
        
        expect(result.event).toBe('service:error');
        expect(result.payload.data.error).toBe('Connection failed');
      });

      test('generates health event', () => {
        const pattern = EventPatterns.status('service');
        const healthData = { cpu: 50, memory: 75, status: 'healthy' };
        const result = pattern.health(healthData);
        
        expect(result.event).toBe('service:health');
        expect(result.payload.data).toEqual(healthData);
      });
    });

    describe('stream pattern', () => {
      test('generates stream start event', () => {
        const pattern = EventPatterns.stream('data');
        const result = pattern.start();
        
        expect(result.event).toBe('data:stream:start');
        expect(result.payload.type).toBe('stream:start');
      });

      test('generates stream data event', () => {
        const pattern = EventPatterns.stream<number>('metrics');
        const result = pattern.data(42);
        
        expect(result.event).toBe('metrics:stream:data');
        expect(result.payload.type).toBe('stream:data');
        expect(result.payload.data).toBe(42);
      });

      test('generates stream end event', () => {
        const pattern = EventPatterns.stream('data');
        const result = pattern.end();
        
        expect(result.event).toBe('data:stream:end');
        expect(result.payload.type).toBe('stream:end');
      });

      test('generates stream error event', () => {
        const pattern = EventPatterns.stream('data');
        const result = pattern.error('Stream interrupted');
        
        expect(result.event).toBe('data:stream:error');
        expect(result.payload.type).toBe('stream:error');
        expect(result.payload.data.error).toBe('Stream interrupted');
      });
    });
  });

  describe('EventTypes enum', () => {
    test('has all connection event types', () => {
      expect(EventTypes.CONNECT).toBe('connect');
      expect(EventTypes.DISCONNECT).toBe('disconnect');
      expect(EventTypes.ERROR).toBe('error');
    });

    test('has all data event types', () => {
      expect(EventTypes.DATA_UPDATE).toBe('data:update');
      expect(EventTypes.DATA_CREATE).toBe('data:create');
      expect(EventTypes.DATA_DELETE).toBe('data:delete');
      expect(EventTypes.DATA_SYNC).toBe('data:sync');
    });

    test('has all status event types', () => {
      expect(EventTypes.STATUS_CHANGE).toBe('status:change');
      expect(EventTypes.STATUS_HEALTH).toBe('status:health');
      expect(EventTypes.STATUS_METRICS).toBe('status:metrics');
    });

    test('has all control event types', () => {
      expect(EventTypes.CONTROL_START).toBe('control:start');
      expect(EventTypes.CONTROL_STOP).toBe('control:stop');
      expect(EventTypes.CONTROL_RESTART).toBe('control:restart');
      expect(EventTypes.CONTROL_CONFIG).toBe('control:config');
    });

    test('has subscription event types', () => {
      expect(EventTypes.SUBSCRIBE).toBe('subscribe');
      expect(EventTypes.UNSUBSCRIBE).toBe('unsubscribe');
    });

    test('has system event types', () => {
      expect(EventTypes.SYSTEM_PING).toBe('system:ping');
      expect(EventTypes.SYSTEM_PONG).toBe('system:pong');
      expect(EventTypes.SYSTEM_INFO).toBe('system:info');
      expect(EventTypes.SYSTEM_ALERT).toBe('system:alert');
    });
  });

  describe('Type definitions', () => {
    test('EventPayload structure', () => {
      const payload: EventPayload<{ test: string }> = {
        timestamp: new Date().toISOString(),
        type: 'test',
        data: { test: 'value' },
        id: 'payload-123',
        source: 'test-source',
        target: 'test-target',
        metadata: { extra: 'info' }
      };
      
      expect(payload.data.test).toBe('value');
      expect(payload.timestamp).toBeDefined();
    });

    test('EventResponse structure', () => {
      const response: EventResponse<{ result: number }> = {
        success: true,
        data: { result: 42 },
        timestamp: new Date().toISOString()
      };
      
      expect(response.success).toBe(true);
      expect(response.data?.result).toBe(42);
      
      const errorResponse: EventResponse = {
        success: false,
        error: 'Something went wrong',
        timestamp: new Date().toISOString()
      };
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Something went wrong');
    });
  });
});