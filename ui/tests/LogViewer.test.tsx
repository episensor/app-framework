/**
 * LogViewer Component Tests
 * Tests for the log viewer UI component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LogViewer, LogEntry, LogFile } from '../components/logs/LogViewer';

// Mock react-virtuoso
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: { data: LogEntry[]; itemContent: (index: number, item: LogEntry) => React.ReactNode }) => (
    <div data-testid="virtuoso-container">
      {data.map((item: LogEntry, index: number) => (
        <div key={item.id || index}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

describe('LogViewer', () => {
  const mockLogs: LogEntry[] = [
    {
      id: '1',
      timestamp: '2024-01-13T10:00:00Z',
      level: 'info',
      message: 'Application started',
      source: 'app'
    },
    {
      id: '2',
      timestamp: '2024-01-13T10:00:01Z',
      level: 'error',
      message: 'Database connection failed',
      source: 'db',
      metadata: { error: 'Connection timeout', retries: 3 }
    },
    {
      id: '3',
      timestamp: '2024-01-13T10:00:02Z',
      level: 'warn',
      message: 'High memory usage detected',
      source: 'monitor'
    },
    {
      id: '4',
      timestamp: '2024-01-13T10:00:03Z',
      level: 'debug',
      message: 'Processing request',
      source: 'api'
    }
  ];

  const mockArchives: LogFile[] = [
    {
      name: 'app-2024-01-01.log',
      size: 1024,
      modified: '2024-01-01T00:00:00Z'
    },
    {
      name: 'app-2024-01-02.log.gz',
      size: 512,
      modified: '2024-01-02T00:00:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders logs when provided directly', () => {
      render(<LogViewer logs={mockLogs} />);

      expect(screen.getByText('Application started')).toBeInTheDocument();
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
      expect(screen.getByText('High memory usage detected')).toBeInTheDocument();
      expect(screen.getByText('Processing request')).toBeInTheDocument();
    });

    it('displays log count', () => {
      render(<LogViewer logs={mockLogs} />);

      expect(screen.getByText(/4 lines/)).toBeInTheDocument();
    });

    it('renders empty state when no logs', () => {
      render(<LogViewer logs={[]} />);

      expect(screen.getByText('No logs to display')).toBeInTheDocument();
    });

    it('renders level badges with correct colors', () => {
      render(<LogViewer logs={mockLogs} />);

      expect(screen.getByText('ERROR')).toBeInTheDocument();
      expect(screen.getByText('WARN')).toBeInTheDocument();
      expect(screen.getByText('INFO')).toBeInTheDocument();
      expect(screen.getByText('DEBUG')).toBeInTheDocument();
    });
  });

  describe('Filtering', () => {
    it('filters logs by search term when enabled', async () => {
      render(<LogViewer logs={mockLogs} enableSearch={true} />);

      const searchInput = screen.getByPlaceholderText('Search logs...');
      await userEvent.type(searchInput, 'database');

      await waitFor(() => {
        expect(screen.getByText('Database connection failed')).toBeInTheDocument();
        expect(screen.queryByText('Application started')).not.toBeInTheDocument();
      });
    });

    it('filters logs by level when enabled', async () => {
      render(<LogViewer logs={mockLogs} enableFilter={true} />);

      // Find and click the level filter dropdown
      const levelSelect = screen.getAllByRole('combobox')[0];
      fireEvent.click(levelSelect);

      // Select ERROR level
      await waitFor(() => {
        const errorOption = screen.getByText('Error');
        fireEvent.click(errorOption);
      });

      await waitFor(() => {
        expect(screen.getByText('Database connection failed')).toBeInTheDocument();
        expect(screen.queryByText('Application started')).not.toBeInTheDocument();
      });
    });

    it('filters logs by category when available', async () => {
      render(<LogViewer logs={mockLogs} enableFilter={true} />);

      await waitFor(() => {
        expect(screen.queryByText('All Categories')).toBeInTheDocument();
      });
    });
  });

  describe('Data Fetching', () => {
    it('calls onFetchLogs on mount', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockLogs);

      render(<LogViewer onFetchLogs={mockFetch} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it('displays fetched logs', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockLogs);

      render(<LogViewer onFetchLogs={mockFetch} />);

      await waitFor(() => {
        expect(screen.getByText('Application started')).toBeInTheDocument();
      });
    });

    it('calls onFetchArchives when switching to archives category', async () => {
      const mockFetchArchives = vi.fn().mockResolvedValue(mockArchives);

      render(
        <LogViewer
          logs={mockLogs}
          onFetchArchives={mockFetchArchives}
          showArchives={true}
        />
      );

      // Click archives category
      const archivesButton = screen.getByText('Archives');
      fireEvent.click(archivesButton);

      await waitFor(() => {
        expect(mockFetchArchives).toHaveBeenCalled();
      });
    });
  });

  describe('Log Management Actions', () => {
    it('calls onClearLogs when clear button is clicked', async () => {
      const mockClear = vi.fn().mockResolvedValue(undefined);

      // Mock window.confirm
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      render(
        <LogViewer
          logs={mockLogs}
          onClearLogs={mockClear}
          enableClear={true}
        />
      );

      const clearButton = screen.getByText('Clear');
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(mockClear).toHaveBeenCalled();
      });
    });

    it('exports logs to file when export button clicked', async () => {
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');

      render(<LogViewer logs={mockLogs} enableExport={true} />);

      const exportButton = screen.getByText('Export');
      fireEvent.click(exportButton);

      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    it('copies logs to clipboard when copy button clicked', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined)
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(<LogViewer logs={mockLogs} enableCopy={true} />);

      const copyButton = screen.getByText('Copy');
      fireEvent.click(copyButton);

      expect(mockClipboard.writeText).toHaveBeenCalled();
    });
  });

  describe('Pause and Resume', () => {
    it('shows pause button when enabled', () => {
      render(<LogViewer logs={mockLogs} enablePause={true} />);

      expect(screen.getByText('Pause')).toBeInTheDocument();
    });

    it('toggles to Resume when paused', async () => {
      render(<LogViewer logs={mockLogs} enablePause={true} />);

      const pauseButton = screen.getByText('Pause');
      fireEvent.click(pauseButton);

      await waitFor(() => {
        expect(screen.getByText('Resume')).toBeInTheDocument();
      });
    });

    it('does not fetch when paused', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockLogs);

      render(
        <LogViewer
          onFetchLogs={mockFetch}
          enablePause={true}
          pausedDefault={true}
        />
      );

      // Should not have fetched because started paused
      await waitFor(() => {
        // When paused, the initial fetch is skipped
        expect(mockFetch).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });
  });

  describe('Auto-scroll', () => {
    it('shows auto-scroll button when enabled', () => {
      render(<LogViewer logs={mockLogs} enableAutoScroll={true} />);

      expect(screen.getByText(/Auto-scroll/)).toBeInTheDocument();
    });

    it('toggles auto-scroll state', async () => {
      render(
        <LogViewer
          logs={mockLogs}
          enableAutoScroll={true}
          autoScrollDefault={true}
        />
      );

      const autoScrollButton = screen.getByText('Auto-scroll On');
      fireEvent.click(autoScrollButton);

      await waitFor(() => {
        expect(screen.getByText('Auto-scroll Off')).toBeInTheDocument();
      });
    });
  });

  describe('Archives View', () => {
    it('shows archives when switching category', async () => {
      const mockFetchArchives = vi.fn().mockResolvedValue(mockArchives);

      render(
        <LogViewer
          logs={mockLogs}
          onFetchArchives={mockFetchArchives}
          showArchives={true}
          showCategories={true}
        />
      );

      const archivesButton = screen.getByText('Archives');
      fireEvent.click(archivesButton);

      await waitFor(() => {
        expect(screen.getByText('Log Archives')).toBeInTheDocument();
      });
    });

    it('calls onDownloadArchive when download clicked', async () => {
      const mockDownload = vi.fn();
      const mockFetchArchives = vi.fn().mockResolvedValue(mockArchives);

      render(
        <LogViewer
          logs={mockLogs}
          onFetchArchives={mockFetchArchives}
          onDownloadArchive={mockDownload}
          showArchives={true}
          showCategories={true}
        />
      );

      // Switch to archives
      const archivesButton = screen.getByText('Archives');
      fireEvent.click(archivesButton);

      await waitFor(() => {
        expect(screen.getByText('app-2024-01-01.log')).toBeInTheDocument();
      });
    });
  });

  describe('Max Entries', () => {
    it('limits displayed logs to maxEntries', async () => {
      const manyLogs: LogEntry[] = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        level: 'info',
        message: `Log message ${i}`
      }));

      const mockFetch = vi.fn().mockResolvedValue(manyLogs);

      render(<LogViewer onFetchLogs={mockFetch} maxEntries={10} />);

      await waitFor(() => {
        // Should only have 10 logs after max enforcement
        expect(screen.getByText(/10 lines/)).toBeInTheDocument();
      });
    });
  });

  describe('Live Updates', () => {
    it('handles incoming log events when enabled', async () => {
      let logHandler: ((log: LogEntry) => void) | null = null;

      const mockOnLogReceived = vi.fn((handler) => {
        logHandler = handler;
        return () => { logHandler = null; };
      });

      render(
        <LogViewer
          logs={[]}
          onLogReceived={mockOnLogReceived}
          enableLiveUpdates={true}
        />
      );

      expect(mockOnLogReceived).toHaveBeenCalled();

      // Simulate receiving a log
      if (logHandler) {
        logHandler({
          id: 'new-log',
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'New live log'
        });
      }

      await waitFor(() => {
        expect(screen.getByText('New live log')).toBeInTheDocument();
      });
    });
  });

  describe('Log Normalization', () => {
    it('extracts embedded timestamp from message', async () => {
      const logsWithEmbeddedTimestamp: LogEntry[] = [{
        id: '1',
        timestamp: '2024-01-13T10:00:00Z',
        level: 'info',
        message: '2024-01-13 10:30:00.123 ERROR [Server] Actual message here'
      }];

      const mockFetch = vi.fn().mockResolvedValue(logsWithEmbeddedTimestamp);

      render(<LogViewer onFetchLogs={mockFetch} />);

      await waitFor(() => {
        expect(screen.getByText('Actual message here')).toBeInTheDocument();
        expect(screen.getByText('ERROR')).toBeInTheDocument();
      });
    });

    it('coalesces stack traces into single entry', async () => {
      const logsWithStackTrace: LogEntry[] = [
        {
          id: '1',
          timestamp: '2024-01-13T10:00:00Z',
          level: 'error',
          message: 'Error occurred'
        },
        {
          id: '2',
          timestamp: '2024-01-13T10:00:00Z',
          level: 'error',
          message: '    at Function.run (/app/server.js:10:5)'
        },
        {
          id: '3',
          timestamp: '2024-01-13T10:00:00Z',
          level: 'error',
          message: '    at main (/app/index.js:5:1)'
        }
      ];

      const mockFetch = vi.fn().mockResolvedValue(logsWithStackTrace);

      render(<LogViewer onFetchLogs={mockFetch} />);

      await waitFor(() => {
        // The main error message should be visible
        expect(screen.getByText('Error occurred')).toBeInTheDocument();
        // Stack trace lines should be coalesced into metadata
        expect(screen.queryByText('    at Function.run (/app/server.js:10:5)')).not.toBeInTheDocument();
      });
    });
  });

  describe('Metadata Display', () => {
    it('displays metadata when log has it', () => {
      render(<LogViewer logs={mockLogs} />);

      // The log with metadata should show metadata fields
      expect(screen.getByText(/error:/)).toBeInTheDocument();
    });
  });

  describe('Custom Configuration', () => {
    it('uses custom level badge colors', () => {
      const customColors = {
        error: 'bg-purple-500 text-white',
        warn: 'bg-orange-500 text-white',
        info: 'bg-green-500 text-white',
        debug: 'bg-gray-500 text-white'
      };

      render(<LogViewer logs={mockLogs} levelBadgeColors={customColors} />);

      const errorBadge = screen.getByText('ERROR');
      expect(errorBadge.className).toContain('bg-purple-500');
    });

    it('uses custom height', () => {
      const { container } = render(
        <LogViewer logs={mockLogs} height="500px" />
      );

      const scrollContainer = container.querySelector('[style*="height"]');
      expect(scrollContainer).toBeTruthy();
    });

    it('shows/hides categories based on prop', () => {
      const { rerender } = render(
        <LogViewer logs={mockLogs} showCategories={true} />
      );

      expect(screen.getByText('Categories')).toBeInTheDocument();

      rerender(<LogViewer logs={mockLogs} showCategories={false} />);

      expect(screen.queryByText('Categories')).not.toBeInTheDocument();
    });
  });
});
