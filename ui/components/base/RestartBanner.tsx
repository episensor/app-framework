import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '../../components/base/alert';
import { Button } from '../../components/base/button';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RestartBannerProps {
  show: boolean;
  onRestart?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function RestartBanner({ 
  show, 
  onRestart, 
  onDismiss,
  className 
}: RestartBannerProps) {
  const [isVisible, setIsVisible] = useState(show);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [show]);

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out",
        isAnimating ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
        className
      )}
    >
      <Alert className="rounded-none border-x-0 border-t-0 bg-amber-50 dark:bg-amber-950/50">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-amber-800 dark:text-amber-200">
            Configuration changes require a restart to take effect
          </span>
          <div className="flex items-center gap-2">
            {onRestart && (
              <Button
                size="sm"
                variant="default"
                onClick={onRestart}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Restart Now
              </Button>
            )}
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
