import { useState, useEffect, useRef, ReactNode } from 'react';
import { Card } from '../base/card';
import { Button } from '../base/button';
import { Input } from '../base/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../base/select';
import { Badge } from '../base/badge';
import { ScrollArea } from '../base/scroll-area';
import { 
  Play, Pause, Download, Trash2, ArrowDown, Search,
  FileText, Archive, Eye, EyeOff,
  Info, AlertTriangle, XCircle, Bug
} from 'lucide-react';
import { cn } from '../../utils/cn';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success' | 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | string;
  message: string;
  source?: string;
  details?: any;
  id?: string | number;
  metadata?: Record<string, any>;
}

// Export as a runtime value for JavaScript consumers
export const LogEntryType = {} as LogEntry;

export interface LogFile {
  name: string;
  size: number;
  modified: string | Date;
}

export interface LogViewerProps {
  // Data source
  logs?: LogEntry[];
  onFetchLogs?: () => Promise<LogEntry[]>;
  apiUrl?: string;
  
  // Configuration
  maxEntries?: number;
  pollInterval?: number;
  levels?: string[];
  
  // Features
  enableSearch?: boolean;
  enableFilter?: boolean;
  enableExport?: boolean;
  enableClear?: boolean;
  enableAutoScroll?: boolean;
  enablePause?: boolean;
  enableFileList?: boolean;
  enableRawView?: boolean;
  
  // Customization
  title?: string;
  emptyMessage?: string;
  dateFormat?: (date: string | Date) => string;
  levelColors?: Record<string, string>;
  renderEntry?: (entry: LogEntry, defaultRender: ReactNode) => ReactNode;
  renderMetadata?: (metadata: Record<string, any>) => ReactNode;
  onExport?: (logs: LogEntry[]) => void;
  onClear?: () => void;
  
  // Styling
  className?: string;
  containerClassName?: string;
  entryClassName?: string;
  height?: string | number;
}

const defaultLevelColors: Record<string, string> = {
  ERROR: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/20 dark:border-red-800',
  WARN: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/20 dark:border-yellow-800',
  INFO: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/20 dark:border-blue-800',
  DEBUG: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-950/20 dark:border-gray-800',
};

const levelIcons: Record<string, any> = {
  ERROR: XCircle,
  WARN: AlertTriangle,
  INFO: Info,
  DEBUG: Bug,
};

// Parse log entry from various formats
function parseLogEntry(line: string): LogEntry | null {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(line);
    if (typeof parsed === 'object') {
      return {
        timestamp: parsed.timestamp,
        level: parsed.level?.toUpperCase(),
        message: parsed.message || JSON.stringify(parsed),
        source: parsed.source || parsed.component,
        metadata: parsed.metadata
      };
    }
  } catch {
    // Not JSON, continue
  }
  
  // Try to parse structured log format: [timestamp] [level] [source] message
  const structuredMatch = line.match(/\[([\d-T:.Z]+)\]\s*\[(\w+)\]\s*(?:\[([^\]]+)\])?\s*(.*)/);
  if (structuredMatch) {
    return {
      timestamp: structuredMatch[1] || '',
      level: structuredMatch[2]?.toUpperCase() || 'INFO',
      source: structuredMatch[3] || '',
      message: structuredMatch[4] || ''
    };
  }
  
  // Try to parse simple format: timestamp level: message
  const simpleMatch = line.match(/^([\d-T:.Z]+)\s+(\w+):\s*(.*)/);
  if (simpleMatch) {
    return {
      timestamp: simpleMatch[1] || '',
      level: simpleMatch[2]?.toUpperCase() || 'INFO',
      message: simpleMatch[3] || ''
    };
  }
  
  // Return as plain message
  return { 
    timestamp: new Date().toISOString(),
    level: 'info',
    message: line 
  };
}

export function LogViewer({
  logs: externalLogs,
  onFetchLogs: _onFetchLogs,
  apiUrl,
  maxEntries = 1000,
  pollInterval = 2000,
  levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'],
  enableSearch = true,
  enableFilter = true,
  enableExport = true,
  enableClear = true,
  enableAutoScroll = true,
  enablePause = true,
  enableFileList = false,
  enableRawView = false,
  title = 'Logs',
  emptyMessage = 'No log entries to display',
  dateFormat,
  levelColors = defaultLevelColors,
  renderEntry,
  renderMetadata,
  onExport,
  onClear,
  className,
  containerClassName,
  entryClassName,
  height = 500
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(externalLogs || []);
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(enableAutoScroll);
  const [isPaused, setIsPaused] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string | number>>(new Set());
  const logContainerRef = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef<string | Date | null>(null);

  // Use external logs if provided
  useEffect(() => {
    if (externalLogs) {
      setLogs(externalLogs.slice(-maxEntries));
    }
  }, [externalLogs, maxEntries]);

  // Fetch logs from API
  useEffect(() => {
    if (!apiUrl || externalLogs || isPaused) return;

    const fetchLogs = async () => {
      try {
        // Try new API format first (/api/logs/recent)
        let response = await fetch(`${apiUrl}/recent/100`);
        
        if (!response.ok) {
          // Fallback to old format
          response = await fetch(apiUrl);
        }
        
        if (response.ok) {
          const data = await response.json();
          
          // Handle different response formats
          let entries: LogEntry[] = [];
          
          if (data.entries && Array.isArray(data.entries)) {
            // New format: { entries: string[] }
            entries = data.entries
              .map((line: string) => parseLogEntry(line))
              .filter(Boolean) as LogEntry[];
          } else if (data.logs && Array.isArray(data.logs)) {
            // Old format: { logs: LogEntry[] }
            entries = data.logs;
          } else if (data.data && Array.isArray(data.data)) {
            // Alternative format: { data: LogEntry[] }
            entries = data.data;
          } else if (Array.isArray(data)) {
            // Direct array
            entries = data;
          }
          
          // Add IDs if missing
          entries = entries.map((entry, index) => ({
            ...entry,
            id: entry.id || `${Date.now()}-${index}`
          }));
          
          setLogs(entries.slice(-maxEntries));
          
          // Update last fetch timestamp
          if (entries.length > 0) {
            const lastEntry = entries[entries.length - 1];
            lastFetchRef.current = lastEntry?.timestamp || new Date();
          }
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };

    // Initial fetch
    fetchLogs();

    // Set up polling
    const interval = setInterval(fetchLogs, pollInterval);
    return () => clearInterval(interval);
  }, [apiUrl, externalLogs, isPaused, pollInterval, maxEntries]);

  // Fetch log files if enabled
  useEffect(() => {
    if (!enableFileList || !apiUrl) return;

    const fetchFiles = async () => {
      try {
        // Remove /recent from the URL if present
        const baseUrl = apiUrl.replace(/\/recent.*$/, '');

        // Try several common endpoints to maximize compatibility
        const endpoints = [
          baseUrl,
          `${baseUrl}/files`,
          `${baseUrl}/archives`,
          `${baseUrl}/all-files`
        ];

        for (const url of endpoints) {
          try {
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const data = await resp.json();
            if (Array.isArray(data)) {
              setLogFiles(data as any);
              return;
            }
            if (data.files && Array.isArray(data.files)) {
              setLogFiles(data.files);
              return;
            }
            if (data.archives && Array.isArray(data.archives)) {
              setLogFiles(data.archives);
              return;
            }
          } catch {}
        }
      } catch (error) {
        console.error('Failed to fetch log files:', error);
      }
    };

    fetchFiles();
    const interval = setInterval(fetchFiles, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [apiUrl, enableFileList]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesText = !filter || 
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      (log.source && log.source.toLowerCase().includes(filter.toLowerCase())) ||
      JSON.stringify(log).toLowerCase().includes(filter.toLowerCase());
    
    const matchesLevel = levelFilter === 'all' || 
      log.level?.toUpperCase() === levelFilter.toUpperCase();
    
    return matchesText && matchesLevel;
  });

  // Format date
  const formatDate = (date: string | Date | undefined) => {
    if (!date) return '';
    
    if (dateFormat) {
      return dateFormat(date);
    }
    
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleTimeString();
    } catch {
      return String(date);
    }
  };

  // Get level styling
  const getLevelStyle = (level: string | undefined) => {
    const upperLevel = level?.toUpperCase() || 'INFO';
    return levelColors[upperLevel] || levelColors.INFO;
  };

  // Get level icon
  const getLevelIcon = (level: string | undefined) => {
    const upperLevel = level?.toUpperCase() || 'INFO';
    return levelIcons[upperLevel] || Info;
  };

  // Toggle entry expansion
  const toggleExpanded = (id: string | number | undefined) => {
    if (!id) return;
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEntries(newExpanded);
  };

  // Export logs
  const handleExport = () => {
    if (onExport) {
      onExport(filteredLogs);
    } else {
      const content = filteredLogs
        .map(log => `[${formatDate(log.timestamp)}] [${log.level}] ${log.source ? `[${log.source}] ` : ''}${log.message}`)
        .join('\n');
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Download log file
  const handleDownloadFile = async (filename: string) => {
    if (!apiUrl) return;
    
    try {
      const baseUrl = apiUrl.replace(/\/recent.*$/, '');
      const candidates = [
        `${baseUrl}/download-any/${filename}`,
        `${baseUrl}/download/${filename}`,
        `${baseUrl}/${filename}`
      ];
      let response: Response | null = null;
      for (const url of candidates) {
        try {
          const r = await fetch(url);
          if (r.ok) { response = r; break; }
        } catch {}
      }
      if (!response) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download log file:', error);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Render log entry
  const renderLogEntry = (log: LogEntry, index: number) => {
    const LevelIcon = getLevelIcon(log.level);
    const isExpanded = log.id ? expandedEntries.has(log.id) : false;
    
    const defaultRender = (
      <div
        key={log.id || index}
        className={cn(
          'group flex flex-col gap-1 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer',
          entryClassName
        )}
        onClick={() => toggleExpanded(log.id)}
      >
        {showRaw ? (
          <pre className="whitespace-pre-wrap break-all text-xs font-mono text-gray-700 dark:text-gray-300">
            {JSON.stringify(log, null, 2)}
          </pre>
        ) : (
          <>
            <div className="flex items-start gap-2">
              {log.timestamp && (
                <span className="text-xs text-gray-500 whitespace-nowrap font-mono">
                  {formatDate(log.timestamp)}
                </span>
              )}
              {log.level && (
                <Badge 
                  variant="outline" 
                  className={cn('text-xs gap-1', getLevelStyle(log.level))}
                >
                  <LevelIcon className="h-3 w-3" />
                  {log.level}
                </Badge>
              )}
              {log.source && (
                <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                  [{log.source}]
                </span>
              )}
              <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 break-all">
                {log.message}
              </span>
            </div>
            {log.metadata && isExpanded && (
              <div className="mt-2 ml-4 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs">
                {renderMetadata ? renderMetadata(log.metadata) : (
                  <pre className="whitespace-pre-wrap break-all font-mono">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
    
    return renderEntry ? renderEntry(log, defaultRender) : defaultRender;
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <Card className={cn('flex flex-col h-full', containerClassName)}>
        {/* Header */}
        <div className="border-b p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {filteredLogs.length} / {logs.length} entries
              </Badge>
              {!isPaused && apiUrl && (
                <Badge variant="outline" className="text-xs">
                  <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-1" />
                  Live
                </Badge>
              )}
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-2">
            {enableSearch && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
            
            {enableFilter && (
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {levels.map(level => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {enableRawView && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRaw(!showRaw)}
              >
                {showRaw ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            )}
            
            {enableAutoScroll && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAutoScroll(!autoScroll)}
                className={autoScroll ? 'bg-blue-50 dark:bg-blue-950' : ''}
              >
                <ArrowDown className={cn('h-4 w-4', autoScroll && 'animate-bounce')} />
              </Button>
            )}
            
            {enablePause && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPaused(!isPaused)}
                className={isPaused ? 'bg-yellow-50 dark:bg-yellow-950' : ''}
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            )}
            
            {enableClear && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setLogs([]);
                  onClear?.();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            
            {enableExport && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Log files sidebar */}
          {enableFileList && logFiles.length > 0 && (
            <div className="w-64 border-r p-4 overflow-auto">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Log Files
              </h4>
              <div className="space-y-2">
                {logFiles.map(file => (
                  <div
                    key={file.name}
                    className="p-2 text-xs border rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 truncate">
                        <div className="font-medium">{file.name}</div>
                        <div className="text-gray-500">
                          {formatFileSize(file.size)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadFile(file.name)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Log entries */}
          <ScrollArea className="flex-1">
            <div
              ref={logContainerRef}
              className="p-4"
              style={{ height: typeof height === 'number' ? `${height}px` : height }}
            >
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <FileText className="h-12 w-12 mb-3 opacity-50" />
                  <p>{emptyMessage}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLogs.map((log, index) => renderLogEntry(log, index))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </Card>
    </div>
  );
}
