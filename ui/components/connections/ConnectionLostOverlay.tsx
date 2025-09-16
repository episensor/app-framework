import { useEffect, useState, useRef } from 'react';
import { Loader2, Circle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useSocketIO } from '../../hooks/useSocketIO';
import { socketManager } from '../../hooks/useSocketIO';

interface ConnectionLostOverlayProps {
  isConnected: boolean;
  appName?: string;
  onRetry?: () => void;
}

export function ConnectionLostOverlay({ 
  isConnected, 
  appName = 'the application',
  onRetry 
}: ConnectionLostOverlayProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [, socketActions] = useSocketIO();
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Show overlay when disconnected, hide when connected
    if (!isConnected) {
      // Delay showing overlay briefly to avoid flicker on quick reconnects
      showTimeoutRef.current = setTimeout(() => {
        setShowOverlay(true);
      }, 1000);
      return () => {
        if (showTimeoutRef.current) {
          clearTimeout(showTimeoutRef.current);
        }
      };
    } else {
      setShowOverlay(false);
      setRetryCount(0);
      setIsRetrying(false);
      // Clear any pending retries
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }
    }
    return undefined;
  }, [isConnected]);

  // Improved auto-retry logic
  useEffect(() => {
    if (showOverlay && !isRetrying && !isConnected) {
      retryTimeoutRef.current = setTimeout(() => {
        handleRetry();
      }, 5000); // Retry every 5 seconds

      return () => {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
      };
    }
    return undefined;
  }, [showOverlay, isRetrying, isConnected]);

  const handleRetry = () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    // Try the custom retry handler first
    if (onRetry) {
      onRetry();
      // Give it time to reconnect
      setTimeout(() => {
        setIsRetrying(false);
      }, 3000);
    } else {
      // Use socket manager to reconnect
      const socket = socketManager.getSocket();
      if (socket) {
        if (socket.disconnected) {
          socket.connect();
        }
        // Check if we're actually reconnecting
        setTimeout(() => {
          if (socket.connected) {
            setIsRetrying(false);
          } else {
            setIsRetrying(false);
            // If still not connected after many retries, show a more serious error
            if (retryCount > 10) {
              console.error('Failed to reconnect after multiple attempts');
            }
          }
        }, 3000);
      } else {
        // No socket available, reset retry state
        setIsRetrying(false);
      }
    }
  };

  const handleManualRetry = () => {
    // Clear any pending auto-retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    handleRetry();
  };

  const handleRefreshPage = () => {
    window.location.reload();
  };

  if (!showOverlay) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="relative max-w-md w-full">
          {/* Main content card */}
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-8 text-center">
            {/* Icon - circle like the header beacon */}
            <div className="mb-6 flex justify-center">
              <div className="relative" data-testid="connection-icon">
                <div className="absolute inset-0 animate-ping">
                  <Circle className="h-16 w-16 text-red-500/30" fill="currentColor" />
                </div>
                <Circle className="h-16 w-16 text-red-500" fill="currentColor" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Connection Lost
            </h2>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Unable to connect to the backend server. This usually means the server has stopped or is restarting.
            </p>

            {/* Status indicator */}
            <div className="mb-6 flex items-center justify-center gap-2 text-sm">
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-blue-600 dark:text-blue-400">
                    Attempting to reconnect...
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-gray-600 dark:text-gray-400">
                    {retryCount === 0 
                      ? 'Connection lost'
                      : `Retry attempt #${retryCount} - will retry automatically`
                    }
                  </span>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleManualRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                Retry Now
              </button>
              
              {retryCount > 5 && (
                <button
                  onClick={handleRefreshPage}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Page
                </button>
              )}
            </div>

            {/* Help text */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {retryCount > 5 
                  ? 'Connection issues persist. The server may be down.'
                  : 'If this problem persists, try:'
                }
              </p>
              <ul className="mt-2 text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <li>• Checking if the backend server is running</li>
                <li>• Restarting {appName}</li>
                <li>• Checking the console for error messages</li>
                {retryCount > 5 && (
                  <li className="text-orange-500">• Consider refreshing the page if retries continue to fail</li>
                )}
              </ul>
            </div>
          </div>

          {/* Decorative background elements */}
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
}