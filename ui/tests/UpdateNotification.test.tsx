import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { UpdateNotification, UpdateSettings } from '../components/updates/UpdateNotification';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Mock window.open
global.open = jest.fn();

describe('UpdateNotification', () => {
  const mockUpdateInfo = {
    currentVersion: '1.0.0',
    updateAvailable: true,
    latestRelease: {
      version: '2.0.0',
      name: 'Version 2.0.0 - Major Update',
      body: '## Changes\n- New feature\n- Bug fixes',
      url: 'https://github.com/user/repo/releases/tag/v2.0.0',
      publishedAt: '2024-01-13T10:00:00Z'
    },
    lastCheck: Date.now()
  };

  const noUpdateInfo = {
    currentVersion: '1.0.0',
    updateAvailable: false,
    lastCheck: Date.now()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should check for updates on mount', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUpdateInfo
    });

    render(<UpdateNotification />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/updates/check');
    });
  });

  it('should display update notification when update is available', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUpdateInfo
    });

    const { getByText } = render(<UpdateNotification />);

    await waitFor(() => {
      expect(getByText('Update Available: v2.0.0')).toBeInTheDocument();
      expect(getByText('Version 2.0.0 - Major Update')).toBeInTheDocument();
    });
  });

  it('should not display notification when no update is available', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => noUpdateInfo
    });

    const { container } = render(<UpdateNotification />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(container.firstChild).toBeNull();
  });

  it('should dismiss notification', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUpdateInfo
    });

    const { getByText, container } = render(<UpdateNotification />);

    await waitFor(() => {
      expect(getByText('Update Available: v2.0.0')).toBeInTheDocument();
    });

    // Find and click X button
    const dismissButton = container.querySelector('[class*="absolute"][class*="top-2"]');
    fireEvent.click(dismissButton!);

    // Should be dismissed
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });

    // Should save to localStorage
    expect(localStorageMock.setItem).toHaveBeenCalledWith('dismissedUpdateVersion', '2.0.0');
  });

  it('should toggle changelog visibility', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUpdateInfo
    });

    const { getByText, queryByText } = render(<UpdateNotification />);

    await waitFor(() => {
      expect(getByText('Update Available: v2.0.0')).toBeInTheDocument();
    });

    // Changelog should not be visible initially
    expect(queryByText(/## Changes/)).not.toBeInTheDocument();

    // Click to show changelog
    fireEvent.click(getByText('Show Changes'));

    // Changelog should be visible
    expect(screen.getByText(/New feature/)).toBeInTheDocument();
    expect(getByText('Hide Changes')).toBeInTheDocument();

    // Click to hide
    fireEvent.click(getByText('Hide Changes'));

    // Should be hidden again
    expect(queryByText(/## Changes/)).not.toBeInTheDocument();
  });

  it('should download update', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdateInfo
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://download.url/app.exe' })
      });

    const { getByText } = render(<UpdateNotification />);

    await waitFor(() => {
      expect(getByText('Download')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Download'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/updates/download-url');
      expect(global.open).toHaveBeenCalledWith('https://download.url/app.exe', '_blank');
    });
  });

  it('should use custom download handler', async () => {
    const onDownload = jest.fn();
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUpdateInfo
    });

    const { getByText } = render(
      <UpdateNotification onDownload={onDownload} />
    );

    await waitFor(() => {
      expect(getByText('Download')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Download'));

    expect(onDownload).toHaveBeenCalledWith(mockUpdateInfo);
  });

  it('should fallback to GitHub URL on download error', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdateInfo
      })
      .mockRejectedValueOnce(new Error('Network error'));

    const { getByText } = render(<UpdateNotification />);

    await waitFor(() => {
      expect(getByText('Download')).toBeInTheDocument();
    });

    fireEvent.click(getByText('Download'));

    await waitFor(() => {
      expect(global.open).toHaveBeenCalledWith(
        'https://github.com/user/repo/releases/tag/v2.0.0',
        '_blank'
      );
    });
  });

  it('should open GitHub release page', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUpdateInfo
    });

    const { container } = render(<UpdateNotification />);

    await waitFor(() => {
      expect(screen.getByText('Update Available: v2.0.0')).toBeInTheDocument();
    });

    // Find external link button
    const externalLinkButton = container.querySelector('[class*="ExternalLink"]')?.parentElement;
    fireEvent.click(externalLinkButton!);

    expect(global.open).toHaveBeenCalledWith(
      'https://github.com/user/repo/releases/tag/v2.0.0',
      '_blank'
    );
  });

  it('should check for updates periodically', async () => {
    jest.useFakeTimers();
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => noUpdateInfo
    });

    render(<UpdateNotification checkInterval={1000} />);

    // Initial check
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

  it('should use custom API URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUpdateInfo
    });

    render(<UpdateNotification apiUrl="/custom/updates" />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/custom/updates/check');
    });
  });

  it('should not show dismissed version again', async () => {
    localStorageMock.getItem.mockReturnValue('2.0.0');
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUpdateInfo
    });

    const { container } = render(<UpdateNotification />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Should not show because version is dismissed
    expect(container.firstChild).toBeNull();
  });

  it('should show new version after dismissing old one', async () => {
    localStorageMock.getItem.mockReturnValue('1.5.0');
    
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockUpdateInfo
    });

    const { getByText } = render(<UpdateNotification />);

    await waitFor(() => {
      // Should show because it's a newer version
      expect(getByText('Update Available: v2.0.0')).toBeInTheDocument();
    });
  });

  it('should handle fetch errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { container } = render(<UpdateNotification />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to check for updates:',
        expect.any(Error)
      );
    });

    // Should not show notification on error
    expect(container.firstChild).toBeNull();

    consoleSpy.mockRestore();
  });
});

describe('UpdateSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.alert = jest.fn();
  });

  it('should render update settings controls', () => {
    const { getByText } = render(<UpdateSettings />);

    expect(getByText('Automatic Updates')).toBeInTheDocument();
    expect(getByText('Check for updates automatically')).toBeInTheDocument();
    expect(getByText('Check Now')).toBeInTheDocument();
  });

  it('should check for updates manually', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        updateAvailable: true,
        latestRelease: { version: '2.0.0' }
      })
    });

    const { getByText } = render(<UpdateSettings />);

    fireEvent.click(getByText('Check Now'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/updates/check?force=true');
      expect(global.alert).toHaveBeenCalledWith('Update available: v2.0.0');
    });
  });

  it('should show no updates available message', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        updateAvailable: false
      })
    });

    const { getByText } = render(<UpdateSettings />);

    fireEvent.click(getByText('Check Now'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('You are running the latest version');
    });
  });

  it('should toggle auto-check setting', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    const { getByRole } = render(<UpdateSettings />);

    const checkbox = getByRole('checkbox');
    
    // Should be checked by default
    expect(checkbox).toBeChecked();

    // Toggle off
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/updates/auto-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false })
      });
      expect(checkbox).not.toBeChecked();
    });
  });

  it('should show last check time', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ updateAvailable: false })
    });

    const { getByText } = render(<UpdateSettings />);

    fireEvent.click(getByText('Check Now'));

    await waitFor(() => {
      expect(screen.getByText(/Last checked:/)).toBeInTheDocument();
    });
  });

  it('should show loading state while checking', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ updateAvailable: false })
      }), 100))
    );

    const { getByText } = render(<UpdateSettings />);

    fireEvent.click(getByText('Check Now'));

    // Should show checking state
    expect(getByText('Checking...')).toBeInTheDocument();

    await waitFor(() => {
      expect(getByText('Check Now')).toBeInTheDocument();
    });
  });

  it('should handle check errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { getByText } = render(<UpdateSettings />);

    fireEvent.click(getByText('Check Now'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to check for updates');
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('should handle auto-check toggle errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { getByRole } = render(<UpdateSettings />);

    const checkbox = getByRole('checkbox');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to update auto-check setting:',
        expect.any(Error)
      );
    });

    consoleSpy.mockRestore();
  });

  it('should use custom API URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ updateAvailable: false })
    });

    const { getByText } = render(<UpdateSettings apiUrl="/custom/updates" />);

    fireEvent.click(getByText('Check Now'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/custom/updates/check?force=true');
    });
  });
});