import { useSocketIO } from './useSocketIO';

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  transport: 'websocket' | 'polling' | null;
  error: Error | null;
  retryCount: number;
  reconnect: () => void;
}

/**
 * Enhanced connection status hook that provides comprehensive connection information
 * including transport type detection for better UX in HTTP/2 environments
 */
export function useConnectionStatus(options?: Parameters<typeof useSocketIO>[0]): ConnectionStatus {
  const [state, actions] = useSocketIO(options);

  return {
    connected: state.connected,
    connecting: state.connecting,
    transport: state.transport,
    error: state.error,
    retryCount: state.retryCount,
    reconnect: actions.reconnect
  };
}
