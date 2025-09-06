/**
 * Date formatting utilities
 */

/**
 * Format a date to a readable string
 * @param date Date to format
 * @param options Formatting options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const d = new Date(date);
  
  // Default options for readable format
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return d.toLocaleString('en-US', defaultOptions);
}

/**
 * Format a date to ISO string
 * @param date Date to format
 * @returns ISO date string
 */
export function toISOString(date: Date | string | number): string {
  return new Date(date).toISOString();
}

/**
 * Format a date to a relative time string (e.g., "2 hours ago")
 * @param date Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) {
    return diffSecs === 1 ? '1 second ago' : `${diffSecs} seconds ago`;
  } else if (diffMins < 60) {
    return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 30) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else {
    return formatDate(d, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

/**
 * Format a date to a short relative time string (e.g., "2h ago")
 * @param date Date to format
 * @returns Short relative time string
 */
export function formatShortRelativeTime(date: Date | string | number): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) {
    return `${diffSecs}s ago`;
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 30) {
    return `${diffDays}d ago`;
  } else {
    return formatDate(d, { month: 'short', day: 'numeric' });
  }
}

/**
 * Format a timestamp to time only
 * @param date Date to format
 * @returns Time string (HH:MM:SS)
 */
export function formatTime(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * Format a timestamp to date only
 * @param date Date to format
 * @returns Date string (YYYY-MM-DD)
 */
export function formatDateOnly(date: Date | string | number): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0] || '';
}
