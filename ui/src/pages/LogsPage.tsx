import { LogViewer } from '../../components/logs/LogViewer';
import type { LogEntry } from '../../components/logs/LogViewer';

export interface LogsPageProps {
  // Data
  logs?: LogEntry[];
  // Actions
  onClear?: () => void;
  onExport?: (logs: LogEntry[]) => void;
  // Customization
  title?: string;
  className?: string;
  apiUrl?: string; // Base logs API URL for LogViewer polling/file list
}

/**
 * Logs page component that uses the LogViewer
 */
export function LogsPage({
  logs,
  onClear,
  onExport,
  title = 'Application Logs',
  className,
  apiUrl
}: LogsPageProps) {
  return (
    <div className={className}>
      <LogViewer
        logs={logs}
        onClear={onClear}
        onExport={onExport}
        apiUrl={apiUrl}
        title={title}
        enableAutoScroll={true}
      />
    </div>
  );
}
