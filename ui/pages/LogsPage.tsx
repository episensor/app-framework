/**
 * Logs Page Component
 * Complete log viewing and management interface
 */

import React, { useState, useEffect } from 'react';
import { LogViewer } from '../components/logs/LogViewer';
import { LogStats } from '../components/logs/LogStats';
import { useLogs } from '../contexts/LogContext';
import { Card, CardHeader, CardContent, CardTitle } from '../components/base/card';

export default function LogsPage() {
  const { 
    logs, 
    isLoading, 
    error, 
    fetchLogs, 
    clearLogs, 
    exportLogs,
    stats 
  } = useLogs();
  
  const [filter, setFilter] = useState({
    level: 'all',
    search: '',
    startDate: '',
    endDate: ''
  });
  
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  useEffect(() => {
    fetchLogs();
  }, []);
  
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs();
      }, 5000); // Refresh every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchLogs]);
  
  const handleExport = async () => {
    try {
      const blob = await exportLogs();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export logs:', err);
    }
  };
  
  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      await clearLogs();
      await fetchLogs();
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Application Logs
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              View and manage application logs in real-time.
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">Auto-refresh</span>
            </label>
            
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
            
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Export
            </button>
            
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>
      
      {/* Stats */}
      {stats && <LogStats stats={stats} />}
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Log Level
              </label>
              <select
                value={filter.level}
                onChange={(e) => setFilter({ ...filter, level: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                placeholder="Search logs..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="datetime-local"
                value={filter.startDate}
                onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="datetime-local"
                value={filter.endDate}
                onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
      
      {/* Log Viewer */}
      <LogViewer 
        logs={logs}
        filter={filter}
        isLoading={isLoading}
      />
    </div>
  );
}