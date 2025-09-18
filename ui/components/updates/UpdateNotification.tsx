import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../base/alert';
import { Button } from '../base/button';
import { Download, X, RefreshCw, ExternalLink } from 'lucide-react';
// import { cn } from '../../src/utils/cn'; // Not used

interface UpdateInfo {
  currentVersion: string;
  updateAvailable: boolean;
  latestRelease?: {
    version: string;
    name: string;
    body: string;
    url: string;
    publishedAt: string;
  };
  lastCheck: number | null;
}

interface UpdateNotificationProps {
  apiUrl?: string;
  checkInterval?: number;
  onDownload?: (updateInfo: UpdateInfo) => void;
}

export function UpdateNotification({ 
  apiUrl = '/api/updates',
  checkInterval = 3600000, // 1 hour default
  onDownload
}: UpdateNotificationProps) {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [_isChecking, setIsChecking] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    checkForUpdates();
    
    // Check periodically
    const interval = setInterval(checkForUpdates, checkInterval);
    
    return () => clearInterval(interval);
  }, [checkInterval]);

  const checkForUpdates = async (force = false) => {
    setIsChecking(true);
    try {
      const response = await fetch(`${apiUrl}/check${force ? '?force=true' : ''}`);
      if (response.ok) {
        const data = await response.json();
        setUpdateInfo(data);
        
        // Reset dismissed state if new update available
        if (data.updateAvailable && isDismissed) {
          const dismissedVersion = localStorage.getItem('dismissedUpdateVersion');
          if (dismissedVersion !== data.latestRelease?.version) {
            setIsDismissed(false);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (updateInfo?.latestRelease) {
      localStorage.setItem('dismissedUpdateVersion', updateInfo.latestRelease.version);
    }
  };

  const handleDownload = async () => {
    if (onDownload && updateInfo) {
      onDownload(updateInfo);
    } else {
      try {
        const response = await fetch(`${apiUrl}/download-url`);
        if (response.ok) {
          const { url } = await response.json();
          window.open(url, '_blank');
        }
      } catch (error) {
        // Fallback to GitHub release page
        if (updateInfo?.latestRelease?.url) {
          window.open(updateInfo.latestRelease.url, '_blank');
        }
      }
    }
  };

  if (!updateInfo?.updateAvailable || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-2">
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
        <Download className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="pr-8">
          <div className="font-semibold text-green-800 dark:text-green-200 mb-1">
            Update Available: v{updateInfo.latestRelease?.version}
          </div>
          <div className="text-sm text-green-700 dark:text-green-300 mb-3">
            {updateInfo.latestRelease?.name || 'A new version is available'}
          </div>
          
          {showChangelog && updateInfo.latestRelease?.body && (
            <div className="mt-3 p-2 bg-white/50 dark:bg-black/20 rounded text-xs">
              <pre className="whitespace-pre-wrap font-sans">
                {updateInfo.latestRelease.body}
              </pre>
            </div>
          )}
          
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="default"
              onClick={handleDownload}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowChangelog(!showChangelog)}
            >
              {showChangelog ? 'Hide' : 'Show'} Changes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(updateInfo.latestRelease?.url, '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </AlertDescription>
        
        <Button
          size="sm"
          variant="ghost"
          className="absolute top-2 right-2 h-6 w-6 p-0"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </Alert>
    </div>
  );
}

// Settings component for update preferences
export function UpdateSettings({ apiUrl = '/api/updates' }) {
  const [autoCheck, setAutoCheck] = useState(true);
  const [_isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const handleCheckNow = async () => {
    setIsChecking(true);
    try {
      const response = await fetch(`${apiUrl}/check?force=true`);
      if (response.ok) {
        const data = await response.json();
        setLastCheck(new Date());
        
        if (data.updateAvailable) {
          alert(`Update available: v${data.latestRelease?.version}`);
        } else {
          alert('You are running the latest version');
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      alert('Failed to check for updates');
    } finally {
      setIsChecking(false);
    }
  };

  const handleAutoCheckToggle = async (enabled: boolean) => {
    try {
      const response = await fetch(`${apiUrl}/auto-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (response.ok) {
        setAutoCheck(enabled);
      }
    } catch (error) {
      console.error('Failed to update auto-check setting:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Automatic Updates</h3>
          <p className="text-xs text-muted-foreground">
            Check for updates automatically
          </p>
        </div>
        <input
          type="checkbox"
          checked={autoCheck}
          onChange={(e) => handleAutoCheckToggle(e.target.checked)}
          className="toggle"
        />
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleCheckNow}
          disabled={_isChecking}
        >
          {_isChecking ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              Check Now
            </>
          )}
        </Button>
        
        {lastCheck && (
          <span className="text-xs text-muted-foreground">
            Last checked: {lastCheck.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}