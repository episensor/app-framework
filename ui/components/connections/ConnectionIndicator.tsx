import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Activity, Clock, Server, AlertCircle, RotateCcw } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/base/popover';
import { Badge } from '../../components/base/badge';
import { Button } from '../../components/base/button';
import { Separator } from '../../components/base/separator';
import { cn } from '../../lib/utils';

interface ConnectionIndicatorProps {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  retryCount: number;
  onRetry?: () => void;
  className?: string;
}

export function ConnectionIndicator({
  connected,
  connecting,
  error,
  retryCount,
  onRetry,
  className = ''
}: ConnectionIndicatorProps) {
  const [connectionTime, setConnectionTime] = useState<Date | null>(null);
  const [uptime, setUptime] = useState<string>('');

  useEffect(() => {
    if (connected && !connectionTime) {
      setConnectionTime(new Date());
    } else if (!connected) {
      setConnectionTime(null);
      setUptime('');
    }
  }, [connected, connectionTime]);

  useEffect(() => {
    if (!connectionTime) return;

    const interval = setInterval(() => {
      const now = new Date();
      const diff = now.getTime() - connectionTime.getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      if (hours > 0) {
        setUptime(`${hours}h ${minutes}m`);
      } else if (minutes > 0) {
        setUptime(`${minutes}m ${seconds}s`);
      } else {
        setUptime(`${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [connectionTime]);

  const getStatusColor = () => {
    if (connected) return 'bg-green-500';
    if (connecting) return 'bg-yellow-500';
    if (error) return 'bg-red-500';
    return 'bg-gray-500';
  };

  const getStatusText = () => {
    if (connected) return 'Connected';
    if (connecting) {
      const retryText = retryCount > 0 ? ` (${retryCount})` : '';
      return `Connecting${retryText}`;
    }
    if (error) return 'Error';
    return 'Disconnected';
  };
  
  const getStatusIcon = () => {
    if (connected) return Wifi;
    if (error) return AlertCircle;
    return WifiOff;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-2 px-3 py-1 h-8 rounded-full",
            "bg-gray-800 hover:bg-gray-700 text-white",
            "transition-all duration-200",
            error && "bg-red-900 hover:bg-red-800",
            connecting && "bg-yellow-900 hover:bg-yellow-800",
            connected && "bg-green-900 hover:bg-green-800",
            className
          )}
        >
          <div className="relative flex items-center">
            {React.createElement(getStatusIcon(), {
              className: cn(
                "w-4 h-4",
                connected ? "text-green-400" : 
                connecting ? "text-yellow-400" :
                error ? "text-red-400" : "text-gray-400"
              )
            })}
            <div className={cn(
              "absolute -top-1 -right-1 w-2 h-2 rounded-full",
              getStatusColor(),
              (connected || connecting) && "animate-pulse"
            )} />
          </div>
          <span className="text-sm font-medium">{getStatusText()}</span>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">WebSocket Connection</h3>
            <Badge 
              variant={connected ? "default" : "secondary"}
              className={cn(
                connected ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
              )}
            >
              {getStatusText()}
            </Badge>
          </div>
          
          <Separator />
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Server className="w-4 h-4" />
                <span>Backend API</span>
              </div>
              <span className="font-mono text-xs">
                {connected ? (typeof window !== 'undefined' && window.location.origin) : 'Not connected'}
              </span>
            </div>
            
            {connected && uptime && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Uptime</span>
                </div>
                <span className="font-mono text-xs">{uptime}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="w-4 h-4" />
                <span>Status</span>
              </div>
              <span className="font-mono text-xs">
                {connected ? 'Real-time updates active' : 
                 connecting ? 'Establishing connection...' :
                 error ? `Connection failed${retryCount > 0 ? ` (retry ${retryCount})` : ''}` : 'Offline'}
              </span>
            </div>
            
            {retryCount > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry Count</span>
                </div>
                <span className="font-mono text-xs">{retryCount}</span>
              </div>
            )}
          </div>
          
          {error && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-600">
                    Connection Error
                  </p>
                  <p className="text-xs text-red-600">
                    {error.message || 'WebSocket connection failed'}
                  </p>
                  {retryCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Retry attempt: {retryCount}
                    </p>
                  )}
                </div>
                {onRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRetry}
                    className="w-full"
                    disabled={connecting}
                  >
                    <RotateCcw className={cn("h-4 w-4 mr-2", connecting && "animate-spin")} />
                    {connecting ? 'Connecting...' : 'Retry Connection'}
                  </Button>
                )}
              </div>
            </>
          )}
          
          <Separator />
          
          <div className="text-xs text-muted-foreground">
            The WebSocket connection enables real-time updates for simulators, 
            templates, and system status. Data is synchronized automatically 
            when connected.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
