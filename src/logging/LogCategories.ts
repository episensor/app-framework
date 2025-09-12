/**
 * Log Categories System
 * Provides a declarative way to define log categories with automatic UI generation
 */

export interface LogLevel {
  name: "error" | "warn" | "info" | "debug" | "verbose";
  color: string;
  badge: string;
  priority: number;
}

export const LogLevels: Record<string, LogLevel> = {
  error: {
    name: "error",
    color: "text-red-600 dark:text-red-400",
    badge: "bg-red-600 text-white",
    priority: 0,
  },
  warn: {
    name: "warn",
    color: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-500 text-white",
    priority: 1,
  },
  info: {
    name: "info",
    color: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-600 text-white",
    priority: 2,
  },
  debug: {
    name: "debug",
    color: "text-gray-600 dark:text-gray-400",
    badge: "bg-gray-600 text-white",
    priority: 3,
  },
  verbose: {
    name: "verbose",
    color: "text-gray-500 dark:text-gray-500",
    badge: "bg-gray-500 text-white",
    priority: 4,
  },
};

export interface LogCategory {
  id: string;
  label: string;
  description?: string;
  color?: string;
  icon?: string;
  enabled?: boolean;
}

export interface LogFilter {
  levels?: string[];
  categories?: string[];
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface LogViewerConfig {
  categories: LogCategory[];
  defaultLevel: string;
  maxLogEntries: number;
  enableRealtime: boolean;
  enableExport: boolean;
  enableArchives: boolean;
  archiveRetentionDays: number;
  horizontalScroll: boolean;
  timestampFormat: string;
  showCategories: boolean;
  showMetadata: boolean;
  theme?: "light" | "dark" | "system";
}

/**
 * Default log viewer configuration
 */
export const defaultLogViewerConfig: LogViewerConfig = {
  categories: [
    {
      id: "system",
      label: "System",
      description: "Core system operations",
      enabled: true,
    },
    {
      id: "api",
      label: "API",
      description: "API requests and responses",
      enabled: true,
    },
    {
      id: "auth",
      label: "Authentication",
      description: "Authentication and authorization",
      enabled: true,
    },
    {
      id: "database",
      label: "Database",
      description: "Database operations",
      enabled: true,
    },
    {
      id: "service",
      label: "Services",
      description: "Background services",
      enabled: true,
    },
  ],
  defaultLevel: "info",
  maxLogEntries: 1000,
  enableRealtime: true,
  enableExport: true,
  enableArchives: true,
  archiveRetentionDays: 7,
  horizontalScroll: true,
  timestampFormat: "YYYY-MM-DD HH:mm:ss.SSS",
  showCategories: true,
  showMetadata: true,
  theme: "system",
};

/**
 * Log entry interface
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: keyof typeof LogLevels;
  category?: string;
  message: string;
  metadata?: Record<string, any>;
  source?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  stack?: string;
}

/**
 * Log aggregation for summary statistics
 */
export interface LogStats {
  total: number;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  errorRate: number;
  warnRate: number;
}

/**
 * Helper to parse log entries from different formats
 */
export function parseLogEntry(raw: string | object): LogEntry | null {
  try {
    if (typeof raw === "string") {
      // Try to parse JSON log format
      if (raw.trim().startsWith("{")) {
        return JSON.parse(raw);
      }

      // Parse text log format: "2023-10-20 10:30:45.123 [INFO] [Category] Message"
      const match = raw.match(
        /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\s+\[(\w+)\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/,
      );
      if (match) {
        const [, timestamp, level, category, message] = match;
        return {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: timestamp || "",
          level: (level?.toLowerCase() || "info") as keyof typeof LogLevels,
          category: category || "",
          message: message || "",
        };
      }
    } else if (typeof raw === "object") {
      return raw as LogEntry;
    }
  } catch (_error) {
    console.error("Failed to parse log entry:", _error);
  }

  return null;
}

/**
 * Helper to format log entries for display
 */
export function formatLogEntry(
  entry: LogEntry,
  format: "full" | "compact" = "full",
): string {
  if (format === "compact") {
    return `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.message}`;
  }

  let formatted = `${entry.timestamp} [${entry.level.toUpperCase()}]`;
  if (entry.category) {
    formatted += ` [${entry.category}]`;
  }
  formatted += ` ${entry.message}`;

  if (entry.metadata && Object.keys(entry.metadata).length > 0) {
    formatted += "\n  Metadata: " + JSON.stringify(entry.metadata, null, 2);
  }

  if (entry.stack) {
    formatted += "\n  Stack: " + entry.stack;
  }

  return formatted;
}

/**
 * Calculate log statistics
 */
export function calculateLogStats(entries: LogEntry[]): LogStats {
  const stats: LogStats = {
    total: entries.length,
    byLevel: {},
    byCategory: {},
    errorRate: 0,
    warnRate: 0,
  };

  for (const entry of entries) {
    // Count by level
    stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;

    // Count by category
    if (entry.category) {
      stats.byCategory[entry.category] =
        (stats.byCategory[entry.category] || 0) + 1;
    }
  }

  // Calculate rates
  if (stats.total > 0) {
    stats.errorRate = (stats.byLevel.error || 0) / stats.total;
    stats.warnRate = (stats.byLevel.warn || 0) / stats.total;
  }

  return stats;
}

/**
 * Filter log entries
 */
export function filterLogEntries(
  entries: LogEntry[],
  filter: LogFilter,
): LogEntry[] {
  return entries.filter((entry) => {
    // Filter by level
    if (
      filter.levels &&
      filter.levels.length > 0 &&
      !filter.levels.includes(entry.level)
    ) {
      return false;
    }

    // Filter by category
    if (
      filter.categories &&
      filter.categories.length > 0 &&
      entry.category &&
      !filter.categories.includes(entry.category)
    ) {
      return false;
    }

    // Filter by search term
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const inMessage = entry.message.toLowerCase().includes(searchLower);
      const inCategory = entry.category?.toLowerCase().includes(searchLower);
      const inMetadata = entry.metadata
        ? JSON.stringify(entry.metadata).toLowerCase().includes(searchLower)
        : false;

      if (!inMessage && !inCategory && !inMetadata) {
        return false;
      }
    }

    // Filter by date range
    const entryDate = new Date(entry.timestamp);
    if (filter.startDate && entryDate < filter.startDate) {
      return false;
    }
    if (filter.endDate && entryDate > filter.endDate) {
      return false;
    }

    return true;
  });
}
