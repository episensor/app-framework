import { useCallback } from 'react';
import { LogViewer, LogEntry, LogFile } from './LogViewer';
import { apiRequest } from '../../src/utils/apiRequest';

export interface LogsPageProps {
  apiUrl?: string;
}

/**
 * A complete logs page component with file list and live log viewer
 *
 * @example
 * ```tsx
 * import { LogsPage } from '@superdangerous/app-framework/ui';
 *
 * function App() {
 *   return <LogsPage apiUrl="/api/logs" />;
 * }
 * ```
 */
export function LogsPage({
  apiUrl = '/api/logs'
}: LogsPageProps) {
  const fetchLogs = useCallback(async (): Promise<LogEntry[]> => {
    try {
      const response = await apiRequest<{ entries?: LogEntry[]; logs?: LogEntry[] }>(`${apiUrl}/entries`);
      return response?.entries || response?.logs || [];
    } catch (error) {
      console.warn('Failed to fetch logs:', error);
      return [];
    }
  }, [apiUrl]);

  const fetchArchives = useCallback(async (): Promise<LogFile[]> => {
    try {
      const response = await apiRequest<{ files?: LogFile[]; archives?: LogFile[] }>(`${apiUrl}/files`);
      return (response?.files || response?.archives || []).map(f => ({
        filename: f.filename || f.name,
        name: f.name,
        size: f.size,
        modified: f.modified
      }));
    } catch (error) {
      console.warn('Failed to fetch archives:', error);
      return [];
    }
  }, [apiUrl]);

  const clearLogs = useCallback(async (): Promise<void> => {
    await apiRequest(`${apiUrl}/clear`, { method: 'POST' });
  }, [apiUrl]);

  const downloadArchive = useCallback((filename: string) => {
    window.open(`${apiUrl}/download/${filename}`, '_blank');
  }, [apiUrl]);

  return (
    <LogViewer
      onFetchLogs={fetchLogs}
      onFetchArchives={fetchArchives}
      onClearLogs={clearLogs}
      onDownloadArchive={downloadArchive}
      enableSearch={true}
      enableFilter={true}
      enableExport={true}
      enableClear={true}
      enableAutoScroll={true}
      enablePause={true}
      showCategories={true}
      showArchives={true}
      height="calc(100vh - 200px)"
    />
  );
}
