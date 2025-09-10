import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { 
  Card, 
  Button, 
  Badge, 
  Alert, 
  AlertDescription, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Input
} from '../base';
import { 
  FileText, 
  Download, 
  Trash2, 
  Archive, 
  AlertCircle, 
  Terminal, 
  Search, 
  Copy as CopyIcon, 
  Eraser,
  RefreshCw,
  Play,
  Pause
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { 
  LogEntry, 
  LogLevels, 
  LogViewerConfig, 
  LogFilter,
  filterLogEntries,
  formatLogEntry,
  calculateLogStats
} from '../../../src/logging/LogCategories';

interface EnhancedLogViewerProps {
  config?: LogViewerConfig;
  apiEndpoints?: {
    current?: string;
    archives?: string;
    export?: string;
    clear?: string;
    purge?: string;
  };
  className?: string;
  onError?: (error: Error) => void;
}

export function EnhancedLogViewer({
  config = {
    categories: [],
    defaultLevel: 'info',
    maxLogEntries: 1000,
    enableRealtime: true,
    enableExport: true,
    enableArchives: true,
    archiveRetentionDays: 7,
    horizontalScroll: true,
    timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
    showCategories: true,
    showMetadata: true,
    theme: 'system'
  },
  apiEndpoints = {
    current: '/api/logs',
    archives: '/api/logs/archives',
    export: '/api/logs/export',
    clear: '/api/logs/clear',
    purge: '/api/logs/purge'
  },
  className,
  onError
}: EnhancedLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [archives, setArchives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'current' | 'archives'>('current');
  const [isStreaming, setIsStreaming] = useState(config.enableRealtime);
  const [filter, setFilter] = useState<LogFilter>({
    levels: [],
    categories: [],
    search: ''
  });
  const [stats, setStats] = useState<any>(null);
  
  const logContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), config.timestampFormat);
    } catch {
      return timestamp;
    }
  };

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!apiEndpoints.current) return;
    
    try {
      setLoading(true);
      const response = await fetch(apiEndpoints.current);
      const data = await response.json();
      
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoints.current, onError]);

  // Fetch archives
  const fetchArchives = useCallback(async () => {
    if (!apiEndpoints.archives) return;
    
    try {
      setLoading(true);
      const response = await fetch(apiEndpoints.archives);
      const data = await response.json();
      
      if (data.files) {
        setArchives(data.files);
      }
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoints.archives, onError]);

  // Clear logs
  const handleClear = async () => {
    if (!apiEndpoints.clear || !confirm('Are you sure you want to clear the current log?')) return;
    
    try {
      await fetch(apiEndpoints.clear, { method: 'POST' });
      await fetchLogs();
    } catch (error) {
      onError?.(error as Error);
    }
  };

  // Purge archives
  const handlePurge = async () => {
    if (!apiEndpoints.purge || !confirm('Are you sure you want to delete all archived logs?')) return;
    
    try {
      await fetch(apiEndpoints.purge, { method: 'POST' });
      await fetchArchives();
    } catch (error) {
      onError?.(error as Error);
    }
  };

  // Export logs
  const handleExport = async () => {
    if (!apiEndpoints.export) return;
    
    try {
      const params = new URLSearchParams();
      if (filter.levels?.length) {
        params.append('level', filter.levels.join(','));
      }
      
      const response = await fetch(`${apiEndpoints.export}?${params}`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  // Copy logs to clipboard
  const handleCopy = () => {
    const text = filteredLogs
      .map(log => formatLogEntry(log, 'full'))
      .join('\n');
    
    navigator.clipboard.writeText(text);
  };

  // Apply filters
  useEffect(() => {
    const filtered = filterLogEntries(logs, filter);
    setFilteredLogs(filtered);
    setStats(calculateLogStats(filtered));
  }, [logs, filter]);

  // Initial load
  useEffect(() => {
    if (activeView === 'current') {
      fetchLogs();
    } else {
      fetchArchives();
    }
  }, [activeView, fetchLogs, fetchArchives]);

  // WebSocket for real-time logs
  useEffect(() => {
    if (!config.enableRealtime || !isStreaming || activeView !== 'current') return;
    
    // This would be implemented with your WebSocket service
    // Example: ws.on('log', handleNewLog);
    
    return () => {
      // Cleanup WebSocket
    };
  }, [config.enableRealtime, isStreaming, activeView]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  const renderLogEntry = (log: LogEntry) => {
    const level = LogLevels[log.level];
    
    return (
      <div
        key={log.id}
        className={cn(
          "px-3 py-2 font-mono text-xs border-b border-gray-100 dark:border-gray-800",
          "hover:bg-gray-50 dark:hover:bg-gray-900"
        )}
      >
        <div className="flex items-start gap-2">
          <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {formatTimestamp(log.timestamp)}
          </span>
          <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", level.badge)}>
            {log.level.toUpperCase()}
          </span>
          {config.showCategories && log.category && (
            <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
              [{log.category}]
            </span>
          )}
          <span className={cn("whitespace-pre break-all", level.color)}>
            {log.message}
          </span>
        </div>
        
        {config.showMetadata && log.metadata && Object.keys(log.metadata).length > 0 && (
          <div className="ml-[180px] mt-1 text-gray-500 dark:text-gray-400">
            {Object.entries(log.metadata).map(([key, value]) => (
              <span key={key} className="mr-4">
                <span className="font-medium">{key}:</span>{' '}
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </span>
            ))}
          </div>
        )}
        
        {log.stack && (
          <pre className="ml-[180px] whitespace-pre overflow-x-auto text-[10px] leading-snug mt-1 text-gray-500 dark:text-gray-400">
            {log.stack}
          </pre>
        )}
      </div>
    );
  };

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <div className="flex-none border-b">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Logs</h2>
            <div className="flex items-center gap-2">
              {activeView === 'current' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={filteredLogs.length === 0}
                  >
                    <CopyIcon className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  {config.enableExport && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={filteredLogs.length === 0}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                </>
              )}
              {activeView === 'archives' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePurge}
                  disabled={archives.length === 0}
                >
                  <Eraser className="h-4 w-4 mr-1" />
                  Purge
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              <Button
                variant={activeView === 'current' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('current')}
              >
                <Terminal className="h-4 w-4 mr-1" />
                Current
              </Button>
              {config.enableArchives && (
                <Button
                  variant={activeView === 'archives' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveView('archives')}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Archives
                </Button>
              )}
            </div>

            {activeView === 'current' && (
              <>
                <div className="flex-1 flex items-center gap-2">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search logs..."
                      value={filter.search || ''}
                      onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                      className="pl-8 h-8"
                    />
                  </div>

                  <Select
                    value={filter.levels?.join(',') || 'all'}
                    onValueChange={(value) => {
                      setFilter({
                        ...filter,
                        levels: value === 'all' ? [] : [value]
                      });
                    }}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      {Object.keys(LogLevels).map(level => (
                        <SelectItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {config.showCategories && config.categories.length > 0 && (
                    <Select
                      value={filter.categories?.join(',') || 'all'}
                      onValueChange={(value) => {
                        setFilter({
                          ...filter,
                          categories: value === 'all' ? [] : [value]
                        });
                      }}
                    >
                      <SelectTrigger className="w-40 h-8">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {config.categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {config.enableRealtime && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsStreaming(!isStreaming)}
                  >
                    {isStreaming ? (
                      <><Pause className="h-4 w-4 mr-1" /> Pause</>
                    ) : (
                      <><Play className="h-4 w-4 mr-1" /> Resume</>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>

          {stats && activeView === 'current' && (
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
              <span>{stats.total} entries</span>
              {stats.errorRate > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {(stats.errorRate * 100).toFixed(1)}% errors
                </span>
              )}
              {stats.warnRate > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {(stats.warnRate * 100).toFixed(1)}% warnings
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : activeView === 'current' ? (
          <div 
            ref={logContainerRef}
            className={cn(
              "h-full overflow-y-auto bg-white dark:bg-gray-900",
              config.horizontalScroll ? "overflow-x-auto" : "overflow-x-hidden"
            )}
            onScroll={(e) => {
              const el = e.currentTarget;
              autoScrollRef.current = el.scrollHeight - el.scrollTop === el.clientHeight;
            }}
          >
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <FileText className="h-12 w-12 mb-2" />
                <p>No logs to display</p>
              </div>
            ) : (
              filteredLogs.map(renderLogEntry)
            )}
          </div>
        ) : (
          <div className="p-4">
            {archives.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No archived log files found.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {archives.map((file) => (
                  <div
                    key={file.filename}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">{file.filename}</p>
                        <p className="text-sm text-gray-500">
                          {(file.size / 1024).toFixed(1)} KB • {formatTimestamp(file.modified)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.downloadUrl, '_blank')}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
