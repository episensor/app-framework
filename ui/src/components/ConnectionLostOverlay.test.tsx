import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ConnectionLostOverlay } from './ConnectionLostOverlay';

describe('ConnectionLostOverlay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should not render when connected', () => {
    const { container } = render(<ConnectionLostOverlay isConnected={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('should show overlay after delay when disconnected', async () => {
    render(<ConnectionLostOverlay isConnected={false} />);
    
    // Should not show immediately
    expect(screen.queryByText('Connection Lost')).toBeNull();
    
    // Fast-forward delay timer
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    // Should show after delay
    expect(screen.getByText('Connection Lost')).toBeInTheDocument();
  });

  it('should hide overlay when connection restored', () => {
    const { rerender } = render(<ConnectionLostOverlay isConnected={false} />);
    
    // Show overlay
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Connection Lost')).toBeInTheDocument();
    
    // Reconnect
    rerender(<ConnectionLostOverlay isConnected={true} />);
    expect(screen.queryByText('Connection Lost')).toBeNull();
  });

  it('should display custom app name', () => {
    render(<ConnectionLostOverlay isConnected={false} appName="My Application" />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText(/• Restarting My Application/)).toBeInTheDocument();
  });

  it('should call onRetry when retry button clicked', () => {
    const onRetry = jest.fn();
    render(<ConnectionLostOverlay isConnected={false} onRetry={onRetry} />);
    
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    const retryButton = screen.getByRole('button', { name: /Retry Now/i });
    fireEvent.click(retryButton);
    
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should reload page when retry clicked without onRetry handler', () => {
    // Mock reload using a different approach
    delete (window as any).location;
    window.location = { ...window.location, reload: jest.fn() };
    
    render(<ConnectionLostOverlay isConnected={false} />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    const retryButton = screen.getByRole('button', { name: /Retry Now/i });
    fireEvent.click(retryButton);
    
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });

  it('should auto-retry after 5 seconds', () => {
    render(<ConnectionLostOverlay isConnected={false} />);
    
    // Show overlay
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Connection Lost')).toBeInTheDocument();
    
    // Auto-retry after 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    
    // Should show retrying state
    expect(screen.getByText(/Attempting to reconnect/)).toBeInTheDocument();
  });


  it('should display red circle icon with animation', () => {
    render(<ConnectionLostOverlay isConnected={false} />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    // Check for circle icons (one static, one animated)
    const circles = screen.getByTestId('connection-icon');
    expect(circles).toBeInTheDocument();
  });

  it('should show help text with troubleshooting steps', () => {
    render(<ConnectionLostOverlay isConnected={false} />);
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText(/If this problem persists/)).toBeInTheDocument();
    expect(screen.getByText(/Checking if the backend server is running/)).toBeInTheDocument();
    expect(screen.getByText(/Checking the console for error messages/)).toBeInTheDocument();
  });
});