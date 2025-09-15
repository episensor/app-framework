import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface ConnectionOverlayProps {
  isConnected: boolean;
  onRetry: () => void;
}

export function ConnectionOverlay({ isConnected, onRetry }: ConnectionOverlayProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);

  useEffect(() => {
    if (isConnected) {
      setIsRetrying(false);
      setRetryAttempts(0);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected && !isRetrying) {
      // Auto-retry every 5 seconds
      const timer = setTimeout(() => {
        handleRetry();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, isRetrying, retryAttempts]);

  const handleRetry = () => {
    setIsRetrying(true);
    setRetryAttempts(prev => prev + 1);

    // Simulate retry attempt
    setTimeout(() => {
      setIsRetrying(false);
      onRetry();
    }, 2000);
  };

  if (isConnected) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="relative max-w-md w-full">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl p-8 text-center">
            {/* Smaller beacon */}
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping">
                  <div className="h-12 w-12 rounded-full bg-red-500/30" />
                </div>
                <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-red-600" />
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Connection Lost
            </h2>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Unable to connect to the application server. The app may be restarting.
            </p>

            <div className="mb-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Will retry automatically in a few seconds
              </div>
            </div>

            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Retry Now
                </>
              )}
            </button>
          </div>

          {/* Background decorations */}
          <div className="absolute -top-4 -left-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
}