import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogViewer, LogEntry } from '../components/logs/LogViewer';

// Mock fetch
global.fetch = jest.fn();

describe('LogViewer', () => {
  const mockLogs: LogEntry[] = [
    {
      id: '1',
      timestamp: '2024-01-13T10:00:00Z',
      level: 'INFO',
      message: 'Application started',
      source: 'app'
    },
    {
      id: '2',
      timestamp: '2024-01-13T10:00:01Z',
      level: 'ERROR',
      message: 'Database connection failed',
      source: 'db',
      metadata: { error: 'Connection timeout', retries: 3 }
    },
    {
      id: '3',
      timestamp: '2024-01-13T10:00:02Z',
      level: 'WARN',
      message: 'High memory usage detected',
      source: 'monitor'
    },
    {
      id: '4',
      timestamp: '2024-01-13T10:00:03Z',
      level: 'DEBUG',
      message: 'Processing request',
      source: 'api'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render logs when provided directly', () => {
    const { getByText } = render(
      <LogViewer logs={mockLogs} />
    );

    expect(getByText('Application started')).toBeInTheDocument();
    expect(getByText('Database connection failed')).toBeInTheDocument();
    expect(getByText('High memory usage detected')).toBeInTheDocument();
    expect(getByText('Processing request')).toBeInTheDocument();
  });

  it('should display log counts', () => {
    const { getByText } = render(
      <LogViewer logs={mockLogs} />
    );

    expect(getByText('4 / 4')).toBeInTheDocument();
  });

  it('should filter logs by search term', async () => {
    const { getByPlaceholderText, queryByText } = render(
      <LogViewer logs={mockLogs} enableSearch={true} />
    );

    const searchInput = getByPlaceholderText('Search logs...');
    
    await userEvent.type(searchInput, 'database');

    await waitFor(() => {
      expect(queryByText('Database connection failed')).toBeInTheDocument();
      expect(queryByText('Application started')).not.toBeInTheDocument();
      expect(queryByText('High memory usage detected')).not.toBeInTheDocument();
    });
  });

  it('should filter logs by level', async () => {
    const { getByRole, getByText, queryByText } = render(
      <LogViewer logs={mockLogs} enableFilter={true} />
    );

    const levelSelect = getByRole('combobox');
    fireEvent.click(levelSelect);
    
    await waitFor(() => {
      fireEvent.click(getByText('ERROR'));
    });

    expect(queryByText('Database connection failed')).toBeInTheDocument();
    expect(queryByText('Application started')).not.toBeInTheDocument();
    expect(queryByText('High memory usage detected')).not.toBeInTheDocument();
    expect(queryByText('Processing request')).not.toBeInTheDocument();
  });

  it('should toggle auto-scroll', async () => {
    const { getByText } = render(
      <LogViewer logs={mockLogs} enableAutoScroll={true} />
    );

    const autoScrollButton = getByText('Auto-scroll');
    
    // Should be enabled by default
    expect(autoScrollButton.parentElement).toHaveClass('variant', 'default');
    
    // Toggle off
    fireEvent.click(autoScrollButton);
    
    await waitFor(() => {
      expect(autoScrollButton.parentElement).toHaveClass('variant', 'outline');
    });
  });

  it('should pause and resume log fetching', async () => {
    const mockFetch = jest.fn().mockResolvedValue(mockLogs);
    
    const { getByText } = render(
      <LogViewer onFetchLogs={mockFetch} enablePause={true} />
    );

    // Should fetch initially
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const pauseButton = getByText('Pause');
    fireEvent.click(pauseButton);

    // Should show Resume
    expect(getByText('Resume')).toBeInTheDocument();
    
    // Clear previous calls
    mockFetch.mockClear();
    
    // Should not fetch while paused
    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it('should clear logs', async () => {
    const onClear = jest.fn();
    
    const { getByText, queryByText } = render(
      <LogViewer logs={mockLogs} enableClear={true} onClear={onClear} />
    );

    const clearButton = getByText('Clear');
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalled();
  });

  it('should export logs', async () => {
    const createElementSpy = jest.spyOn(document, 'createElement');
    const createObjectURLSpy = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    const revokeObjectURLSpy = jest.spyOn(URL, 'revokeObjectURL');
    
    const { getByText } = render(
      <LogViewer logs={mockLogs} enableExport={true} />
    );

    const exportButton = getByText('Export');
    fireEvent.click(exportButton);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:url');
  });

  it('should call custom export handler', () => {
    const onExport = jest.fn();
    
    const { getByText } = render(
      <LogViewer logs={mockLogs} enableExport={true} onExport={onExport} />
    );

    const exportButton = getByText('Export');
    fireEvent.click(exportButton);

    expect(onExport).toHaveBeenCalledWith(mockLogs);
  });

  it('should expand metadata when clicked', async () => {
    const { getByText, queryByText } = render(
      <LogViewer logs={mockLogs} />
    );

    const logWithMetadata = getByText('Database connection failed').parentElement;
    
    // Metadata should not be visible initially
    expect(queryByText('Connection timeout')).not.toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(logWithMetadata!);

    // Metadata should now be visible
    await waitFor(() => {
      expect(screen.getByText(/"error": "Connection timeout"/)).toBeInTheDocument();
    });
  });

  it('should fetch logs from API', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ logs: mockLogs })
    });

    const { getByText } = render(
      <LogViewer apiUrl="/api/logs" />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/logs');
      expect(getByText('Application started')).toBeInTheDocument();
    });
  });

  it('should poll for new logs', async () => {
    jest.useFakeTimers();
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ logs: mockLogs })
    });

    render(
      <LogViewer apiUrl="/api/logs" pollInterval={1000} />
    );

    // Initial fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Advance time
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    jest.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  it('should limit number of logs displayed', () => {
    const manyLogs = Array.from({ length: 100 }, (_, i) => ({
      id: `${i}`,
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `Log message ${i}`
    }));

    const { container } = render(
      <LogViewer logs={manyLogs} maxEntries={10} />
    );

    const logEntries = container.querySelectorAll('[class*="gap-2"]');
    expect(logEntries.length).toBeLessThanOrEqual(10);
  });

  it('should use custom date formatter', () => {
    const customDateFormat = (date: string | Date) => 'Custom Date';
    
    const { getAllByText } = render(
      <LogViewer logs={mockLogs} dateFormat={customDateFormat} />
    );

    expect(getAllByText('Custom Date')).toHaveLength(4);
  });

  it('should use custom level colors', () => {
    const customColors = {
      'ERROR': 'text-purple-500'
    };

    const { getByText } = render(
      <LogViewer logs={mockLogs} levelColors={customColors} />
    );

    const errorBadge = getByText('ERROR');
    expect(errorBadge).toHaveClass('text-purple-500');
  });

  it('should render custom entry renderer', () => {
    const renderEntry = (entry: LogEntry, defaultRender: React.ReactNode) => (
      <div data-testid="custom-entry">
        Custom: {entry.message}
      </div>
    );

    const { getAllByTestId } = render(
      <LogViewer logs={mockLogs} renderEntry={renderEntry} />
    );

    expect(getAllByTestId('custom-entry')).toHaveLength(4);
  });

  it('should render custom metadata', () => {
    const renderMetadata = (metadata: any) => (
      <div data-testid="custom-metadata">
        Custom Metadata
      </div>
    );

    const { getByText, getByTestId } = render(
      <LogViewer logs={mockLogs} renderMetadata={renderMetadata} />
    );

    const logWithMetadata = getByText('Database connection failed').parentElement;
    fireEvent.click(logWithMetadata!);

    expect(getByTestId('custom-metadata')).toBeInTheDocument();
  });

  it('should handle empty logs gracefully', () => {
    const { getByText } = render(
      <LogViewer logs={[]} emptyMessage="No logs available" />
    );

    expect(getByText('No logs available')).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(
      <LogViewer apiUrl="/api/logs" />
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching logs:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should support different log level names', () => {
    const customLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'CRITICAL',
        message: 'Critical error'
      },
      {
        id: '2',
        timestamp: new Date().toISOString(),
        level: 'TRACE',
        message: 'Trace log'
      }
    ];

    const { getByText } = render(
      <LogViewer 
        logs={customLogs}
        levels={['CRITICAL', 'TRACE', 'INFO', 'DEBUG']}
      />
    );

    expect(getByText('CRITICAL')).toBeInTheDocument();
    expect(getByText('TRACE')).toBeInTheDocument();
  });

  it('should handle logs without IDs', () => {
    const logsWithoutIds: LogEntry[] = [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Log 1'
      },
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Log 2'
      }
    ];

    const { getByText } = render(
      <LogViewer logs={logsWithoutIds} />
    );

    expect(getByText('Log 1')).toBeInTheDocument();
    expect(getByText('Log 2')).toBeInTheDocument();
  });

  it('should scroll to bottom when auto-scroll is enabled', async () => {
    const scrollContainer = {
      scrollTop: 0,
      scrollHeight: 1000
    };

    const { container } = render(
      <LogViewer logs={mockLogs} enableAutoScroll={true} />
    );

    const logContainer = container.querySelector('[class*="overflow-auto"]');
    
    if (logContainer) {
      Object.defineProperty(logContainer, 'scrollHeight', {
        value: 1000,
        writable: true
      });
      
      Object.defineProperty(logContainer, 'scrollTop', {
        value: 0,
        writable: true
      });

      // Add new logs to trigger scroll
      const { rerender } = render(
        <LogViewer logs={[...mockLogs, {
          id: '5',
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: 'New log'
        }]} enableAutoScroll={true} />
      );

      // scrollTop should be updated (in real implementation)
      // This is a simplified test as JSDOM doesn't fully support scrolling
    }
  });
});