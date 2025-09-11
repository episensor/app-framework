import { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/base/tooltip';
import { cn } from '../../lib/utils';

interface ConnectionStatusProps {
  url?: string;
  className?: string;
  checkInterval?: number;
}

/**
 * Connection status indicator with a calm, pulsing LED beacon
 * Shows WebSocket connection status between frontend and backend
 */
export function ConnectionStatus({ 
  url, 
  className,
  checkInterval = 5000 
}: ConnectionStatusProps) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    let mounted = true;
    
    // Determine the API URL - use empty string for relative URLs in dev
    const apiUrl = url || '';
    
    // Check connection by testing the API health endpoint
    const checkConnection = async () => {
      if (!mounted) return;
      
      try {
        const response = await fetch(`${apiUrl}/api/health`, {
          credentials: 'include'
        });
        if (mounted) {
          setConnected(response.ok);
          setChecking(false);
        }
      } catch (error) {
        if (mounted) {
          setConnected(false);
          setChecking(false);
        }
      }
    };

    // Initial check
    checkConnection();

    // Set up polling
    const interval = setInterval(checkConnection, checkInterval);

    return () => {
      mounted = false;
      clearInterval(interval);
      hasInitialized.current = false;
    };
  }, []); // Empty dependency array - set up only once

  const statusColor = checking 
    ? 'bg-gray-400' 
    : connected 
      ? 'bg-green-500' 
      : 'bg-red-500';

  const statusText = checking 
    ? 'Checking...' 
    : connected 
      ? 'Connected' 
      : 'Disconnected';

  const tooltipContent = checking
    ? 'Checking connection to backend API...'
    : connected
      ? 'Frontend is connected to the backend API via WebSockets. Real-time updates are enabled.'
      : 'Cannot connect to the backend API. Please check if the backend server is running.';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1 rounded-full",
              "bg-gray-800/50 backdrop-blur-sm",
              "hover:bg-gray-800/70 transition-all duration-200",
              "cursor-default select-none",
              className
            )}
            type="button"
            aria-label={`Connection status: ${statusText}`}
          >
            <div className="relative flex items-center justify-center w-2 h-2">
              {/* Main LED */}
              <div 
                className={cn(
                  "absolute w-2 h-2 rounded-full transition-all duration-300",
                  statusColor,
                  connected && "shadow-lg shadow-green-500/50"
                )}
              />
              {/* Calm ripple effect when connected */}
              {connected && (
                <>
                  <div 
                    className="absolute w-2 h-2 rounded-full bg-green-500 opacity-75"
                    style={{
                      animation: 'calm-ping 3s cubic-bezier(0, 0, 0.2, 1) infinite'
                    }}
                  />
                  <div 
                    className="absolute w-2 h-2 rounded-full bg-green-500 opacity-50"
                    style={{
                      animation: 'calm-ping 3s cubic-bezier(0, 0, 0.2, 1) infinite 1s'
                    }}
                  />
                </>
              )}
            </div>
            <span className="text-xs font-medium">
              {statusText}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Add CSS animation for the calm beacon effect
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes calm-ping {
      0% {
        transform: scale(1);
        opacity: 0.75;
      }
      75%, 100% {
        transform: scale(2.5);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
