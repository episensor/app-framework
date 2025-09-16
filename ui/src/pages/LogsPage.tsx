import { useState, useEffect, useRef } from 'react';
import { Card } from '../../components/base/card';
import { Button } from '../../components/base/button';
import { Badge } from '../../components/base/badge';
import { Alert, AlertDescription } from '../../components/base/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/base/select';
import { Input } from '../../components/base/input';
import { format } from 'date-fns';
import { 
  Terminal, Archive, FileText, Download, Trash2, AlertCircle, 
  Search, Copy as CopyIcon, Eraser, RefreshCw
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useSocketIO } from '../hooks/useSocketIO';
import { apiRequest } from '../../utils/apiRequest';
import { toast } from 'sonner';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  category?: string;
  source?: string;
  message: string;
  metadata?: Record<string, any>;
}

interface LogFile {
  filename?: string;
  name?: string;
  size: number;
  modified: string;
}

interface LogCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const logCategories: LogCategory[] = [
  {
    id: 'current',
    label: 'Current Log',
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

const levelBadgeColors: Record<string, string> = {
  error: 'bg-red-500 text-white',
  warn: 'bg-amber-500 text-white', 
  info: 'bg-blue-500 text-white',
  debug: 'bg-gray-500 text-white',
  verbose: 'bg-gray-400 text-white'
};

export interface LogsPageProps {
  apiUrl?: string;
  title?: string;
  description?: string;
}

export function LogsPage({ 
  apiUrl = '/api/logs',
  title = 'Logs',
  description = 'View system logs and diagnostic information'
}: LogsPageProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [currentLogLevel, setCurrentLogLevel] = useState<string>('info');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [{ connected }, { on, off }] = useSocketIO();
  
  const LevelChip = ({ level }: { level: string }) => {
    const map: Record<string, string> = {
      error: 'bg-red-600 text-white',
      warn: 'bg-amber-500 text-white',
      info: 'bg-blue-600 text-white',
      debug: 'bg-gray-600 text-white',
      verbose: 'bg-gray-500 text-white'
    };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${map[level] || map.info}`}>
        {level.toUpperCase()}
      </span>
    );
  };

  useEffect(() => {
    if (activeCategory === 'current') {
      fetchLogs();
    } else if (activeCategory === 'archives') {
      fetchArchives();
    }
  }, [activeCategory]);

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

    // Drop any stack-only lines
    const cleaned: LogEntry[] = [];
    for (const e of filtered) {
      if (/^\s*at\s/.test(e.message)) {
        continue;
      }
      cleaned.push(e);
    }
    // Guarantee unique ids
    const withIds = cleaned.map((l, i) => ({ ...l, id: l.id || `${l.timestamp}-${i}-${Math.random().toString(36).slice(2)}` }));
    setFilteredLogs(withIds);
  }, [logs, levelFilter, categoryFilter, searchTerm]);

  useEffect(() => {
    if (!connected || !isStreaming) return;

    const normalizeLog = (log: LogEntry): LogEntry => {
      let { timestamp, level, message, category, source, metadata } = log;
      const embedded = message.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\w+)\s+\[([^\]]+)\]\s+(.*)$/);
      if (embedded) {
        timestamp = embedded[1];
        level = embedded[2].toLowerCase() as any;
        source = embedded[3];
        category = source;
        message = embedded[4];
      }
      if (/^\s*Error[:\s]/i.test(message) || /uncaught exception/i.test(message)) {
        level = 'error';
      }
      return { ...log, timestamp, level, message, category: category || source, source, metadata };
    };

    const handleLog = (raw: LogEntry) => {
      const log = normalizeLog(raw);
      setLogs(prev => {
        if (/^\s*at\s/.test(log.message) && prev.length > 0) {
          const updated = [...prev];
          const top = { ...updated[0] } as LogEntry;
          const stack = top.metadata?.stack ? `${top.metadata.stack}\n${log.message}` : log.message;
          top.metadata = { ...(top.metadata || {}), stack };
          updated[0] = top;
          return updated;
        }
        const entry = { ...log, id: `${Date.now()}-${Math.random()}` };
        const next = [entry, ...prev];
        const cats = Array.from(new Set(next.map(l => (l.category || l.source || '')).filter(Boolean))).sort();
        setAvailableCategories(cats);
        return next;
      });
    };

    on('log', handleLog);
    return () => {
      off('log', handleLog);
    };
  }, [connected, isStreaming, on, off]);

  useEffect(() => {
    fetchCurrentLogLevel();
  }, []);

  const fetchCurrentLogLevel = async () => {
    try {
      const response = await apiRequest('/api/settings');
      setCurrentLogLevel(response['logging.level'] || 'info');
    } catch (error) {
      console.error('Failed to fetch log level:', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await apiRequest(`${apiUrl}/entries`);
      const normalize = (log: LogEntry): LogEntry => {
        let { timestamp, level, message, category, source, metadata } = log;
        const embedded = message.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+(\w+)\s+\[([^\]]+)\]\s+(.*)$/);
        if (embedded) {
          timestamp = embedded[1];
          level = embedded[2].toLowerCase() as any;
          source = embedded[3];
          category = source;
          message = embedded[4];
        }
        if (/^\s*Error[:\s]/i.test(message) || /uncaught exception/i.test(message)) {
          level = 'error';
        }
        return { ...log, timestamp, level, message, category: category || source, source, metadata };
      };
      const coalesce = (entries: LogEntry[]): LogEntry[] => {
        const out: LogEntry[] = [];
        for (const e of entries) {
          if (/^\s*at\s/.test(e.message) && out.length > 0) {
            const prev = out[out.length - 1];
            const stack = prev.metadata?.stack ? `${prev.metadata.stack}\n${e.message}` : e.message;
            prev.metadata = { ...(prev.metadata || {}), stack };
          } else {
            out.push(e);
          }
        }
        return out;
      };
      const normalized = (response.logs || []).map(normalize);
      const grouped = coalesce(normalized);
      const sorted = grouped.sort((a: LogEntry, b: LogEntry) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(sorted);
      const cats = Array.from(new Set(sorted.map(l => (l.category || l.source || '')).filter(Boolean))).sort();
      setAvailableCategories(cats);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      if (error instanceof Error && !error.message.includes('404')) {
        toast.error('Failed to load logs');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchArchives = async () => {
    try {
      let response = await apiRequest(`${apiUrl}/archives`);
      let archives = (response.archives || []).map((a: any) => ({
        filename: a.filename || a.name,
        name: a.name,
        size: a.size,
        modified: a.modified,
      }));
      if (!archives.length) {
        response = await apiRequest(`${apiUrl}/all-files`);
        archives = (response.archives || []).map((a: any) => ({
          filename: a.filename || a.name,
          name: a.name,
          size: a.size,
          modified: a.modified,
        }));
      }
      setLogFiles(archives);
    } catch (error) {
      console.error('Failed to fetch archives:', error);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Clear all logs? This action cannot be undone.')) return;
    
    try {
      await apiRequest(`${apiUrl}/clear`, { method: 'POST' });
      setLogs([]);
      toast.success('Logs cleared');
    } catch (error) {
      toast.error('Failed to clear logs');
    }
  };

  const handleExportLogs = async () => {
    try {
      const text = await apiRequest(`${apiUrl}/export?level=all`);
      
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Logs exported');
    } catch (error) {
      toast.error('Failed to export logs');
    }
  };

  const handleDownloadArchive = (filename: string) => {
    window.open(`${apiUrl}/download-any/${filename}`, '_blank');
  };

  const handleDeleteArchive = async (filename: string) => {
    if (!confirm(`Delete archive ${filename}?`)) return;
    
    try {
      await apiRequest(`${apiUrl}/archive/${filename}`, { method: 'DELETE' });
      await fetchArchives();
      toast.success('Archive deleted');
    } catch (error) {
      toast.error('Failed to delete archive');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return format(date, 'yyyy-MM-dd HH:mm:ss.SSS');
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
          <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">[{log.category || log.source}]</span>
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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDownloadArchive(file.filename!)}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDeleteArchive(file.filename!)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <div className="text-muted-foreground flex items-center">
            {description} • Current level: <Badge className={cn("ml-1 text-xs px-2 py-0", levelBadgeColors[currentLogLevel] || levelBadgeColors.info)}>{currentLogLevel.toUpperCase()}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeCategory === 'current' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const text = filteredLogs.map(l => {
                    const ts = formatTimestamp(l.timestamp);
                    const src = l.category || l.source ? ` [${l.category || l.source}]` : '';
                    const head = `${ts} ${l.level.toUpperCase()}${src} ${l.message}`;
                    const stack = l.metadata?.stack ? `\n${l.metadata.stack}` : '';
                    return head + stack;
                  }).join('\n');
                  navigator.clipboard.writeText(text).then(() => toast.success('Copied logs to clipboard')).catch(() => toast.error('Copy failed'));
                }}
              >
                <CopyIcon className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLogs}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearLogs}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </>
          )}
          {activeCategory === 'archives' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => { 
                  if (!confirm('Purge all archived logs? This action cannot be undone.')) return;
                  await apiRequest(`${apiUrl}/purge-all`, { method: 'POST' }); 
                  toast.success('All logs purged'); 
                  await fetchArchives(); 
                }}
              >
                <Eraser className="h-4 w-4 mr-2" />
                Purge All
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        <Card className="w-64 h-fit">
          <div className="p-4">
            <h3 className="font-semibold mb-4">Categories</h3>
            <div className="space-y-1">
              {logCategories.map((category) => {
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
                      <SelectItem value="all">All Categories</SelectItem>
                      {availableCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 h-8 text-sm w-64"
                    />
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsStreaming(!isStreaming);
                    if (!isStreaming) {
                      fetchLogs();
                    }
                  }}
                >
                  {isStreaming ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isStreaming ? 'Streaming' : 'Paused'}
                </Button>
              </div>
              
              <div className="h-[calc(100vh-320px)] overflow-y-auto overflow-x-auto bg-white dark:bg-gray-900" ref={logContainerRef}>
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
              {/* Footer with line count */}
              <div className="border-t bg-muted/50 px-4 py-2 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {filteredLogs.length} {filteredLogs.length === 1 ? 'line' : 'lines'}
                </div>
                {connected && isStreaming && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
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