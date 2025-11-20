import { createServer, Server as HTTPServer } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createWebSocketServer, WebSocketServer, getWebSocketServer } from '../../src/services/websocketServer.js';

jest.setTimeout(20000);

describe('WebSocket Integration', () => {
  let httpServer: HTTPServer;
  let wsServer: WebSocketServer;
  let client: ClientSocket;
  let port: number;
  const broadcastLog: Array<{ event: string; data: any }> = [];

  beforeEach(async () => {
    httpServer = createServer();
    broadcastLog.length = 0;
    wsServer = createWebSocketServer(httpServer, {
      reset: true,
      broadcastHook: (event, data) => broadcastLog.push({ event, data }),
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });

    const addr = httpServer.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  afterEach(async () => {
    if (client?.connected) {
      client.disconnect();
    }
    if (wsServer) {
      await wsServer.shutdown();
    }
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  const connectClient = async () => {
    client = ioClient(`http://localhost:${port}`, { timeout: 5000, forceNew: true, reconnection: false });
    return new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', reject);
    });
  };

  it('connects and receives a connected acknowledgement', async () => {
    expect(wsServer.isInitialized()).toBe(true);
    const connectPromise = connectClient();
    const connectedPayload = new Promise<any>((resolve, reject) => {
      client.once('connected', resolve);
      setTimeout(() => reject(new Error('connected event timeout')), 4000);
    });

    await connectPromise;
    const payload = await connectedPayload;

    expect(payload.id).toBe(client.id);
    expect(payload.timestamp).toBeDefined();
  });

  it('broadcasts events without throwing and records via hook', async () => {
    wsServer.broadcast('simulator:started', { simulatorId: 'sim-123', status: 'started' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(broadcastLog.find((entry) => entry.event === 'simulator:started')).toBeDefined();
  });

  it('tracks the singleton instance', () => {
    expect(getWebSocketServer()).toBe(wsServer);
  });
});
