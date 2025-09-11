import { useEffect, useState } from 'react';
import { Loader2, Circle, AlertTriangle, RefreshCw } from 'lucide-react';

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

  useEffect(() => {
    // Show overlay when disconnected, hide when connected
    if (!isConnected) {
      // Delay showing overlay briefly to avoid flicker on quick reconnects
      const timer = setTimeout(() => {
        setShowOverlay(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setShowOverlay(false);
      setRetryCount(0);
      setIsRetrying(false);
    }
    return undefined;
  }, [isConnected]);

  // Auto-retry logic
  useEffect(() => {
    if (showOverlay && !isRetrying) {
      const retryTimer = setTimeout(() => {
        setIsRetrying(true);
        setRetryCount(prev => {
          const newCount = prev + 1;
          // Attempt to reconnect by reloading after several retries
          if (newCount > 5) {
            window.location.reload();
          }
          return newCount;
        });
        
        // Reset retry state after attempting
        setTimeout(() => setIsRetrying(false), 3000);
      }, 5000); // Retry every 5 seconds

      return () => clearTimeout(retryTimer);
    }
    return undefined;
  }, [showOverlay, isRetrying]);

  if (!showOverlay) return null;

  const handleManualRetry = () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    if (onRetry) {
      onRetry();
    } else {
      // Default behavior: force reload
      window.location.reload();
    }
  };

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
                    Will retry in a few seconds (attempt #{retryCount})
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
            </div>

            {/* Help text */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                If this problem persists, try:
              </p>
              <ul className="mt-2 text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <li>• Checking if the backend server is running</li>
                <li>• Restarting {appName}</li>
                <li>• Checking the console for error messages</li>
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