import { useContext, useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

/**
 * Generic WebSocket hook for Socket.IO connections
 * Requires a SocketContext to be provided in the component tree
 * 
 * @example
 * ```tsx
 * // First, create a context provider
 * const SocketContext = React.createContext<{ socket: Socket | null; connected: boolean }>({
 *   socket: null,
 *   connected: false
 * });
 * 
 * // In your component
 * const MyComponent = () => {
 *   const { socket, connected, on, off, emit } = useWebSocket(SocketContext);
 * 
 *   useEffect(() => {
 *     const handleMessage = (data: any) => {
 *       console.log('Received:', data);
 *     };
 * 
 *     on('message', handleMessage);
 *     return () => off('message', handleMessage);
 *   }, [on, off]);
 * 
 *   const sendMessage = () => {
 *     emit('message', { text: 'Hello!' });
 *   };
 * 
 *   return (
 *     <div>
 *       {connected ? 'Connected' : 'Disconnected'}
 *       <button onClick={sendMessage}>Send</button>
 *     </div>
 *   );
 * };
 * ```
 */
export function useWebSocket<T extends { socket: Socket | null; connected?: boolean }>(
  SocketContext: React.Context<T>
) {
  const context = useContext(SocketContext);
  const socket = context?.socket;
  const [connected, setConnected] = useState(context?.connected || false);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Check initial connection state
    setConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  const on = useCallback(
    (event: string, handler: (...args: any[]) => void) => {
      if (socket) {
        socket.on(event, handler);
      }
    },
    [socket]
  );

  const off = useCallback(
    (event: string, handler: (...args: any[]) => void) => {
      if (socket) {
        socket.off(event, handler);
      }
    },
    [socket]
  );

  const emit = useCallback(
    (event: string, ...args: any[]) => {
      if (socket) {
        socket.emit(event, ...args);
      }
    },
    [socket]
  );

  return {
    socket,
    connected,
    on,
    off,
    emit,
  };
}

/**
 * Type-safe version with event maps
 */
export function createTypedWebSocketHook<
  ClientToServerEvents = Record<string, any>,
  ServerToClientEvents = Record<string, any>
>() {
  return function useTypedWebSocket<T extends { socket: Socket<ServerToClientEvents, ClientToServerEvents> | null; connected?: boolean }>(
    SocketContext: React.Context<T>
  ) {
    const context = useContext(SocketContext);
    const socket = context?.socket;
    const [connected, setConnected] = useState(context?.connected || false);

    useEffect(() => {
      if (!socket) return;

      const handleConnect = () => setConnected(true);
      const handleDisconnect = () => setConnected(false);

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);

      setConnected(socket.connected);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
      };
    }, [socket]);

    return {
      socket,
      connected,
      on: socket?.on.bind(socket) as typeof socket.on,
      off: socket?.off.bind(socket) as typeof socket.off,
      emit: socket?.emit.bind(socket) as typeof socket.emit,
    };
  };
}