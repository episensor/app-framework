import { LogViewer } from '../../components/logs/LogViewer';
import type { LogEntry, LogFile } from '../../components/logs/LogViewer';

export interface LogsPageProps {
  // Data
  logs?: LogEntry[];
  logFiles?: LogFile[];
  loading?: boolean;
  
  // Actions
  onRefresh?: () => Promise<void>;
  onClear?: () => Promise<void>;
  onExport?: () => Promise<void>;
  onDownloadArchive?: (filename: string) => Promise<void>;
  onDeleteArchive?: (filename: string) => Promise<void>;
  onFetchArchives?: () => Promise<LogFile[]>;
  
  // WebSocket
  onLogReceived?: (handler: (log: LogEntry) => void) => void;
  offLogReceived?: (handler: (log: LogEntry) => void) => void;
  
  // Customization
  title?: string;
  className?: string;
}

/**
 * Logs page component that uses the LogViewer
 */
export function LogsPage({
  logs,
  logFiles,
  loading,
  onClear,
  onExport,
  onDownloadArchive,
  onDeleteArchive,
  onFetchArchives,
  onLogReceived,
  offLogReceived,
  title = 'Application Logs',
  className
}: LogsPageProps) {
  return (
    <div className={className}>
      <LogViewer
        logs={logs}
        logFiles={logFiles}
        loading={loading}
        onClear={onClear}
        onExport={onExport}
        onDownloadArchive={onDownloadArchive}
        onDeleteArchive={onDeleteArchive}
        onFetchArchives={onFetchArchives}
        onLogReceived={onLogReceived}
        offLogReceived={offLogReceived}
        title={title}
        autoScroll={true}
      />
    </div>
  );
}