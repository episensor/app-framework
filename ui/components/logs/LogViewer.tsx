import { useState, useEffect, useRef } from 'react';
import { Card } from '../base/card';
import { Button } from '../base/button';
import { Badge } from '../base/badge';
import { Alert, AlertDescription } from '../base/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../base/select';
import {
  Terminal, Archive, Download, Trash2, Search, Copy as CopyIcon,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../src/utils/cn';
import { format } from 'date-fns';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose' | string;
  category?: string;
  source?: string;
  message: string;
  metadata?: Record<string, any>;
}

interface PartialLogEntry {
  id?: string;
  timestamp?: string;
  level?: 'error' | 'warn' | 'info' | 'debug' | 'verbose' | string;
  category?: string;
  source?: string;
  message?: string;
  metadata?: Record<string, any>;
}

export interface LogFile {
  filename?: string;
  name?: string;
  size: number;
  modified: string;
}

export interface LogCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

export interface LogViewerProps {
  // Data
  logs?: LogEntry[];
  logFiles?: LogFile[];


  // Callbacks
  onFetchLogs?: () => Promise<LogEntry[]>;
  onFetchArchives?: () => Promise<LogFile[]>;
  onClearLogs?: () => Promise<void>;
  onExportLogs?: () => Promise<void>;
  onDownloadArchive?: (filename: string) => void;
  onDeleteArchive?: (filename: string) => Promise<void>;

  // WebSocket handlers
  onLogReceived?: (handler: (log: LogEntry) => void) => () => void;

  // Configuration
  categories?: LogCategory[];
  levelBadgeColors?: Record<string, string>;
  currentLogLevel?: string;

  // UI Options
  showCategories?: boolean;
  showArchives?: boolean;
  height?: string;

  // Styling
  className?: string;
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

const defaultLevelBadgeColors: Record<string, string> = {
  error: 'bg-red-500 text-white',
  warn: 'bg-amber-500 text-white',
  info: 'bg-blue-500 text-white',
  debug: 'bg-gray-500 text-white',
  verbose: 'bg-gray-400 text-white'
};

export function LogViewer({
  logs: externalLogs = [],
  logFiles: externalLogFiles = [],
  onFetchLogs,
  onFetchArchives,
  onClearLogs,
  onExportLogs,
  onDownloadArchive,
  onDeleteArchive,
  onLogReceived,
  categories = defaultCategories,
  levelBadgeColors = defaultLevelBadgeColors,
  currentLogLevel = 'info',
  showCategories = true,
  showArchives = true,
  height = 'calc(100vh-320px)',
  className,
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(externalLogs);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [logFiles, setLogFiles] = useState<LogFile[]>(externalLogFiles);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const LevelChip = ({ level }: { level: string }) => {
    return (
      <span className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold',
        levelBadgeColors[level] || levelBadgeColors.info
      )}>
        {level.toUpperCase()}
      </span>
    );
  };

  // Normalize log entries
  const normalizeLog = (log: PartialLogEntry | LogEntry): LogEntry => {
    let { timestamp, level, message, category, source, metadata } = log;
    const embedded = message ? message.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\w+)\s+\[([^\]]+)\]\s+(.*)$/) : null;
    if (embedded) {
      timestamp = embedded[1];
      level = embedded[2].toLowerCase();
      source = embedded[3];
      category = source;
      message = embedded[4];
    }
    if (message && (/^\s*Error[:\s]/i.test(message) || /uncaught exception/i.test(message))) {
      level = 'error';
    }
    const finalTimestamp = timestamp || new Date().toISOString();
    return {
      ...log,
      id: log.id || `${finalTimestamp}-${Math.random().toString(36).slice(2)}`,
      timestamp: finalTimestamp,
      level: level || 'info',
      message: message || '',
      category: category || source,
      source,
      metadata
    };
  };

  // Coalesce stack traces
  const coalesceStackTraces = (entries: Array<PartialLogEntry | LogEntry>): LogEntry[] => {
    const out: LogEntry[] = [];
    for (const e of entries) {
      const normalized = normalizeLog(e);
      if (/^\s*at\s/.test(normalized.message) && out.length > 0) {
        const prev = out[out.length - 1];
        const stack = prev.metadata?.stack ? `${prev.metadata.stack}\n${normalized.message}` : normalized.message;
        prev.metadata = { ...(prev.metadata || {}), stack };
      } else {
        out.push(normalized);
      }
    }
    return out;
  };

  // Update logs from external source
  useEffect(() => {
    if (externalLogs.length > 0) {
      const normalized = coalesceStackTraces(externalLogs);
      setLogs(normalized);
      const cats = Array.from(new Set(normalized.map(l => l.category || l.source || '').filter(Boolean))).sort();
      setAvailableCategories(cats);
    }
  }, [externalLogs]);

  useEffect(() => {
    setLogFiles(externalLogFiles);
  }, [externalLogFiles]);

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

  // Fetch logs when category changes
  useEffect(() => {
    if (activeCategory === 'current' && onFetchLogs) {
      fetchLogs();
    } else if (activeCategory === 'archives' && onFetchArchives) {
      fetchArchives();
    }
  }, [activeCategory]);

  // Subscribe to log updates
  useEffect(() => {
    if (!onLogReceived) return;

    const handleLog = (raw: PartialLogEntry | LogEntry) => {
      const log = normalizeLog(raw);
      setLogs(prev => {
        const currentLogs = prev || [];
        if (/^\s*at\s/.test(log.message) && currentLogs.length > 0) {
          const updated = [...currentLogs];
          const top = { ...updated[0] };
          const stack = top.metadata?.stack ? `${top.metadata.stack}\n${log.message}` : log.message;
          top.metadata = { ...(top.metadata || {}), stack };
          updated[0] = top;
          return updated;
        }
        const entry = { ...log, id: `${Date.now()}-${Math.random()}` };
        const next = [entry, ...currentLogs];
        const cats = Array.from(new Set(next.map(l => (l.category || l.source || '')).filter(Boolean))).sort();
        setAvailableCategories(cats);
        return next;
      });
    };

    return onLogReceived(handleLog);
  }, [onLogReceived]);

  const fetchLogs = async () => {
    if (!onFetchLogs) return;
    setLoading(true);
    try {
      const fetchedLogs = await onFetchLogs();
      const normalized = coalesceStackTraces(fetchedLogs);
      const sorted = normalized.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setLogs(sorted);
      const cats = Array.from(new Set(sorted.map(l => (l.category || l.source || '')).filter(Boolean))).sort();
      setAvailableCategories(cats);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchives = async () => {
    if (!onFetchArchives) return;
    try {
      const archives = await onFetchArchives();
      setLogFiles(archives);
    } catch (error) {
      console.error('Failed to fetch archives:', error);
    }
  };

  const handleClearLogs = async () => {
    if (!onClearLogs) return;
    if (!confirm('Clear all logs? This action cannot be undone.')) return;
    await onClearLogs();
    setLogs([]);
  };

  const handleExportLogs = async () => {
    if (onExportLogs) {
      await onExportLogs();
    } else {
      // Default export implementation
      const text = filteredLogs.map(l => {
        const ts = formatTimestamp(l.timestamp);
        const src = l.category || l.source ? ` [${l.category || l.source}]` : '';
        const head = `${ts} ${l.level.toUpperCase()}${src} ${l.message}`;
        const stack = l.metadata?.stack ? `\n${l.metadata.stack}` : '';
        return head + stack;
      }).join('\n');

      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleCopyLogs = () => {
    const text = filteredLogs.map(l => {
      const ts = formatTimestamp(l.timestamp);
      const src = l.category || l.source ? ` [${l.category || l.source}]` : '';
      const head = `${ts} ${l.level.toUpperCase()}${src} ${l.message}`;
      const stack = l.metadata?.stack ? `\n${l.metadata.stack}` : '';
      return head + stack;
    }).join('\n');
    navigator.clipboard.writeText(text);
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return format(date, 'yyyy-MM-dd HH:mm:ss.SSS');
    } catch {
      return timestamp;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderLogEntry = (log: LogEntry) => (
    <div
      key={log.id}
      className="px-3 py-2 font-mono text-xs border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-900"
    >
      <div className="flex items-start gap-2">
        <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {formatTimestamp(log.timestamp)}
        </span>
        <span className="flex-shrink-0"><LevelChip level={log.level} /></span>
        {(log.category || log.source) && (
          <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
            [{log.category || log.source}]
          </span>
        )}
        <span className="whitespace-pre-wrap break-all">{log.message}</span>
      </div>
      {log.metadata?.stack && (
        <pre className="ml-[180px] whitespace-pre overflow-x-auto text-[10px] leading-snug mt-1 text-gray-500 dark:text-gray-400">
          {log.metadata.stack}
        </pre>
      )}
      {log.metadata && !log.metadata.stack && Object.keys(log.metadata).length > 0 && (
        <div className="ml-[180px] mt-1 text-gray-500 dark:text-gray-400">
          {Object.entries(log.metadata).map(([key, value]) => (
            <span key={key} className="mr-4">
              <span className="font-medium">{key}:</span>{' '}
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  const renderArchiveFile = (file: LogFile) => {
    const filename = file.filename || file.name || 'unknown';
    return (
      <div
        key={filename}
        className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        <div className="flex items-center gap-3">
          <Archive className="h-4 w-4 text-gray-400" />
          <div>
            <div className="font-medium text-sm">{filename}</div>
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
              onClick={() => onDownloadArchive(filename)}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {onDeleteArchive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDeleteArchive(filename)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const filteredCategories = showArchives ? categories : categories.filter(c => c.id !== 'archives');

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Logs</h1>
          <div className="text-muted-foreground flex items-center">
            View system logs and diagnostic information • Current level:{' '}
            <Badge className={cn('ml-1 text-xs px-2 py-0', levelBadgeColors[currentLogLevel] || levelBadgeColors.info)}>
              {currentLogLevel.toUpperCase()}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeCategory === 'current' && (
            <>
              <Button variant="outline" size="sm" onClick={handleCopyLogs}>
                <CopyIcon className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportLogs}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              {onClearLogs && (
                <Button variant="outline" size="sm" onClick={handleClearLogs}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        {showCategories && (
          <Card className="w-64 h-fit">
            <div className="p-4">
              <h3 className="font-semibold mb-4">Categories</h3>
              <div className="space-y-1">
                {filteredCategories.map((category) => {
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
        )}

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

                  {availableCategories.length > 0 && (
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-44 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {availableCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

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

              <div className={cn('overflow-y-auto overflow-x-auto bg-white dark:bg-gray-900')} style={{ height }} ref={logContainerRef}>
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
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
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}