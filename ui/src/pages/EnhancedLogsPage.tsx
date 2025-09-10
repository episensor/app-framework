import { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/base/card';
import { Button } from '../../components/base/button';
import { Badge } from '../../components/base/badge';
import { Alert, AlertDescription } from '../../components/base/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../../components/base/select';
import { 
  FileText, Download, Trash2, RefreshCw, Archive, 
  AlertCircle, Terminal, Search, Maximize2, Minimize2,
  Play, Pause
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface LogEntry {
  id?: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  category?: string;
  source?: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface LogFile {
  filename: string;
  size: number;
  modified: string;
}

export interface LogCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

export interface EnhancedLogsPageProps {
  // Data
  logs?: LogEntry[];
  logFiles?: LogFile[];
  loading?: boolean;
  currentLogLevel?: string;
  
  // Actions
  onRefresh?: () => Promise<void>;
  onClear?: () => Promise<void>;
  onExport?: () => Promise<void>;
  onDownloadArchive?: (filename: string) => Promise<void>;
  onDeleteArchive?: (filename: string) => Promise<void>;
  onFetchLogs?: () => Promise<LogEntry[]>;
  onFetchArchives?: () => Promise<LogFile[]>;
  onFetchLogLevel?: () => Promise<string>;
  
  // WebSocket
  connected?: boolean;
  onLogReceived?: (handler: (log: LogEntry) => void) => void;
  offLogReceived?: (handler: (log: LogEntry) => void) => void;
  
  // Customization
  title?: string;
  className?: string;
  categories?: LogCategory[];
  categoryOptions?: Array<{ value: string; label: string }>;
}

const defaultCategories: LogCategory[] = [
  {
    id: 'current',
    label: 'Current',
    icon: Terminal,
    description: 'View live system logs',
  },
  {
    id: 'archives',
    label: 'Archives',
    icon: Archive,
    description: 'Download archived log files',
  }
];

const defaultCategoryOptions = [
  { value: 'all', label: 'All Categories' },
  { value: 'server', label: 'Server' },
  { value: 'scanner', label: 'Scanner' },
  { value: 'api', label: 'API' },
  { value: 'system', label: 'System' }
];

const levelBadgeColors: Record<string, string> = {
  error: 'bg-red-500 text-white',
  warn: 'bg-amber-500 text-white', 
  info: 'bg-blue-500 text-white',
  debug: 'bg-gray-500 text-white',
  verbose: 'bg-gray-400 text-white'
};

export function EnhancedLogsPage({
  logs: initialLogs = [],
  logFiles: initialLogFiles = [],
  loading = false,
  currentLogLevel = 'info',
  onRefresh,
  onClear,
  onExport,
  onDownloadArchive,
  onDeleteArchive,
  onFetchLogs,
  onFetchArchives,
  onFetchLogLevel,
  connected = true,
  onLogReceived,
  offLogReceived,
  title = 'Logs',
  className,
  categories = defaultCategories,
  categoryOptions = defaultCategoryOptions
}: EnhancedLogsPageProps) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [logFiles, setLogFiles] = useState<LogFile[]>(initialLogFiles);
  const [activeCategory, setActiveCategory] = useState('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isStreaming, setIsStreaming] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [logLevel, setLogLevel] = useState(currentLogLevel);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Update logs when props change
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs]);

  // Update log files when props change
  useEffect(() => {
    setLogFiles(initialLogFiles);
  }, [initialLogFiles]);

  // Fetch data based on active category
  useEffect(() => {
    if (activeCategory === 'current' && onFetchLogs) {
      onFetchLogs().then(setLogs);
    } else if (activeCategory === 'archives' && onFetchArchives) {
      onFetchArchives().then(setLogFiles);
    }
  }, [activeCategory, onFetchLogs, onFetchArchives]);

  // Fetch current log level
  useEffect(() => {
    if (onFetchLogLevel) {
      onFetchLogLevel().then(setLogLevel);
    }
  }, [onFetchLogLevel]);

  // Filter logs
  useEffect(() => {
    let filtered = [...logs];
    
    if (levelFilter !== 'all') {
      filtered = filtered.filter(log => log.level === levelFilter);
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(log => {
        const logCategory = log.category || log.source || '';
        return logCategory.toLowerCase().includes(categoryFilter.toLowerCase());
      });
    }
    
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.metadata)?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredLogs(filtered);
  }, [logs, levelFilter, categoryFilter, searchTerm]);

  // WebSocket subscription
  useEffect(() => {
    if (!connected || !isStreaming || !onLogReceived || !offLogReceived) return;

    const handleLog = (log: LogEntry) => {
      setLogs(prev => [{ ...log, id: log.id || `${Date.now()}-${Math.random()}` }, ...prev]);
    };

    onLogReceived(handleLog);
    return () => {
      offLogReceived(handleLog);
    };
  }, [connected, isStreaming, onLogReceived, offLogReceived]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      // For newest-first, scroll to top
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    // Use full ISO format for clarity: YYYY-MM-DD HH:mm:ss.SSS
    const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    return `${dateStr} ${timeStr}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleClearLogs = async () => {
    if (!onClear || !confirm('Clear all logs? This action cannot be undone.')) return;
    await onClear();
    setLogs([]);
  };

  const handleExportLogs = async () => {
    if (!onExport) return;
    await onExport();
  };

  const handleDeleteArchive = async (filename: string) => {
    if (!onDeleteArchive || !confirm(`Delete archive ${filename}?`)) return;
    await onDeleteArchive(filename);
    if (onFetchArchives) {
      const updated = await onFetchArchives();
      setLogFiles(updated);
    }
  };

  const renderLogEntry = (log: LogEntry) => (
    <div
      key={log.id || `${log.timestamp}-${Math.random()}`}
      className="px-3 py-2 font-mono text-xs border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200"
    >
      <div className="flex items-start gap-2">
        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0">
          {formatTimestamp(log.timestamp)}
        </span>
        <Badge className={cn("text-[10px] px-1 py-0 flex-shrink-0", levelBadgeColors[log.level])}>
          {log.level.toUpperCase()}
        </Badge>
        {(log.category || log.source) && (
          <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">
            [{log.category || log.source}]
          </span>
        )}
        <span className="flex-1 break-words">{log.message}</span>
      </div>
      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <div className="mt-1 ml-[100px] text-gray-500 dark:text-gray-400">
          {Object.entries(log.metadata).map(([key, value]) => (
            <span key={key} className="mr-4">
              <span className="font-medium">{key}:</span> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const renderArchiveFile = (file: LogFile) => (
    <div
      key={file.filename}
      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"
    >
      <div className="flex items-center gap-3">
        <Archive className="h-4 w-4 text-gray-400" />
        <div>
          <div className="font-medium text-sm">{file.filename}</div>
          <div className="text-xs text-gray-500">
            {formatFileSize(file.size)} • {new Date(file.modified).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onDownloadArchive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDownloadArchive(file.filename)}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        {onDeleteArchive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeleteArchive(file.filename)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  const containerClass = cn(
    "space-y-6",
    isFullscreen && "fixed inset-0 z-50 bg-background p-6",
    className
  );

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <div className="text-muted-foreground flex items-center">
            View system logs and diagnostic information • Current level: 
            <Badge className={cn("ml-1 text-xs px-2 py-0", levelBadgeColors[logLevel] || levelBadgeColors.info)}>
              {logLevel.toUpperCase()}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeCategory === 'current' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoScroll(!autoScroll)}
                title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
              >
                {autoScroll ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              {(!isStreaming || !connected) && onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={loading}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                  Refresh
                </Button>
              )}
              {onExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportLogs}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
              {onClear && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearLogs}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        <Card className="w-64 h-fit">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Categories</h3>
            <div className="space-y-1">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      activeCategory === category.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-left">{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="flex-1">
          {activeCategory === 'archives' ? (
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Log Archives</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Download or manage archived log files
                </p>
              </div>
              <div className="space-y-2">
                {logFiles.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No archived log files available
                    </AlertDescription>
                  </Alert>
                ) : (
                  logFiles.map(renderArchiveFile)
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Filter:</span>
                    <Select value={levelFilter} onValueChange={setLevelFilter}>
                      <SelectTrigger className="w-32 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="debug">Debug</SelectItem>
                        <SelectItem value="verbose">Verbose</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-44 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm border rounded-md w-64 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>
              
              <div 
                className="h-[calc(100vh-320px)] overflow-y-auto overflow-x-hidden bg-white dark:bg-gray-900" 
                ref={logContainerRef}
              >
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <Terminal className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No logs to display</p>
                      <p className="text-xs mt-1">Logs will appear here as they are generated</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    {filteredLogs.map(renderLogEntry)}
                  </div>
                )}
              </div>
              
              <div className="border-t bg-muted/50 px-4 py-2 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {filteredLogs.length} {filteredLogs.length === 1 ? 'line' : 'lines'}
                </div>
                {connected && isStreaming && (
                  <div className="text-sm text-muted-foreground">
                    Live streaming active
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
