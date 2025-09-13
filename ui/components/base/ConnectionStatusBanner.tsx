import { AlertTriangle } from 'lucide-react';

export interface ConnectionStatusBannerProps {
  connected: boolean;
  connecting: boolean;
  transport: 'websocket' | 'polling' | null;
  apiReady?: boolean;
}

/**
 * Enhanced connection status banner that shows different states:
 * - Green: WebSocket connected (optimal)
 * - Blue: Polling connected (HTTP/2 fallback, fully functional)
 * - Yellow: Connecting/reconnecting
 * - Hidden: Disconnected (handled by ConnectionLostOverlay)
 */
export function ConnectionStatusBanner({ 
  connected, 
  connecting, 
  transport, 
  apiReady = true 
}: ConnectionStatusBannerProps) {
  if (!apiReady) return null;

  // Show polling status (HTTP/2 fallback)
  if (connected && transport === 'polling') {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-blue-800">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span>Connected via polling - Real-time updates active</span>
          <span className="text-xs text-blue-600">(WebSocket unavailable due to HTTP/2)</span>
        </div>
      </div>
    );
  }

  // Show connecting status
  if (connecting) {
    return (
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-yellow-800">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <span>Reconnecting...</span>
        </div>
      </div>
    );
  }

  // WebSocket connected (optimal) - no banner needed, handled by AppShell
  // Disconnected - handled by ConnectionLostOverlay
  return null;
}
