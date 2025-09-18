/**
 * Date formatting utilities for displaying relative time
 */

/**
 * Formats a date/timestamp as relative time (e.g., "2 minutes ago", "3 hours ago")
 * @param date - Date object, timestamp string, or timestamp number
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (isNaN(seconds)) {
    return 'Unknown';
  }

  if (seconds < 0) {
    return 'In the future';
  }

  if (seconds < 10) {
    return 'Just now';
  }

  if (seconds < 60) {
    return `${seconds} seconds ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) {
    return '1 minute ago';
  }
  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours === 1) {
    return '1 hour ago';
  }
  if (hours < 24) {
    return `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return '1 day ago';
  }
  if (days < 7) {
    return `${days} days ago`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks === 1) {
    return '1 week ago';
  }
  if (weeks < 4) {
    return `${weeks} weeks ago`;
  }

  const months = Math.floor(days / 30);
  if (months === 1) {
    return '1 month ago';
  }
  if (months < 12) {
    return `${months} months ago`;
  }

  const years = Math.floor(days / 365);
  if (years === 1) {
    return '1 year ago';
  }
  return `${years} years ago`;
}

/**
 * Formats a date to a standard display format
 * @param date - Date object, timestamp string, or timestamp number
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string
 */
export function formatDateTime(
  date: Date | string | number,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    return dateObj.toLocaleString(undefined, options);
  } catch {
    return 'Invalid date';
  }
}

/**
 * Formats duration in seconds to human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "2h 15m", "5d 3h")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Gets a short relative time label (e.g., "2m", "3h", "5d")
 * @param date - Date object, timestamp string, or timestamp number
 * @returns Short relative time string
 */
export function formatShortRelativeTime(date: Date | string | number): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (isNaN(seconds) || seconds < 0) {
    return '--';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 365) {
    return `${days}d`;
  }

  const years = Math.floor(days / 365);
  return `${years}y`;
}