/**
 * Log Context
 * Provides log viewing and management functionality
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../utils/apiRequest';

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: string;
  metadata?: Record<string, any>;
}

export interface LogStats {
  total: number;
  error: number;
  warn: number;
  info: number;
  debug: number;
  fileSize: string;
  oldestEntry?: string;
  newestEntry?: string;
}

interface LogContextValue {
  logs: LogEntry[];
  stats: LogStats | null;
  isLoading: boolean;
  error: string | null;
  fetchLogs: (filters?: any) => Promise<void>;
  clearLogs: () => Promise<void>;
  exportLogs: () => Promise<Blob>;
}

const LogContext = createContext<LogContextValue | undefined>(undefined);

export function LogProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchLogs = useCallback(async (filters?: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (filters?.level && filters.level !== 'all') {
        params.append('level', filters.level);
      }
      if (filters?.search) {
        params.append('search', filters.search);
      }
      if (filters?.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters?.endDate) {
        params.append('endDate', filters.endDate);
      }
      
      const url = `/api/logs${params.toString() ? `?${params}` : ''}`;
      const data = await api.get<{ logs: LogEntry[], stats: LogStats }>(url);
      
      setLogs(data.logs || []);
      setStats(data.stats || null);
    } catch (err) {
      setError((err as Error).message);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const clearLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await api.delete('/api/logs');
      setLogs([]);
      setStats(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const exportLogs = useCallback(async (): Promise<Blob> => {
    try {
      const response = await fetch('/api/logs/export');
      if (!response.ok) {
        throw new Error('Failed to export logs');
      }
      return await response.blob();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }, []);
  
  const value: LogContextValue = {
    logs,
    stats,
    isLoading,
    error,
    fetchLogs,
    clearLogs,
    exportLogs
  };
  
  return (
    <LogContext.Provider value={value}>
      {children}
    </LogContext.Provider>
  );
}

export function useLogs() {
  const context = useContext(LogContext);
  if (!context) {
    throw new Error('useLogs must be used within a LogProvider');
  }
  return context;
}