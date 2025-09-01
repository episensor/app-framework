/**
 * System Health Monitor Component
 * Simplified system health visualization
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { SparklineChart } from './SparklineChart';
import { ActivityLED } from './ActivityLED';

export interface SystemHealthMonitorProps {
  apiUrl?: string;
  refreshInterval?: number;
  showDetails?: boolean;
}

interface SystemHealthData {
  cpu: {
    usage: number;
    cores: number;
    history: number[];
  };
  memory: {
    total: number;
    used: number;
    percentage: number;
    history: number[];
  };
  disk: Array<{
    name: string;
    total: number;
    used: number;
    percentage: number;
  }>;
  network?: {
    bytesReceived: number;
    bytesSent: number;
  };
}

export function SystemHealthMonitor({ 
  apiUrl = '/api/system/health',
  refreshInterval = 5000,
  showDetails = true
}: SystemHealthMonitorProps) {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Failed to fetch system health');
        const data = await response.json();
        setHealth(data);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, refreshInterval);
    return () => clearInterval(interval);
  }, [apiUrl, refreshInterval]);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <span className="text-gray-500">Loading system health...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !health) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-red-500">
            <span>Failed to load system health</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (percentage: number) => {
    if (percentage < 50) return 'text-green-500';
    if (percentage < 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatus = (percentage: number): 'active' | 'warning' | 'error' => {
    if (percentage < 50) return 'active';
    if (percentage < 80) return 'warning';
    return 'error';
  };

  return (
    <div className="space-y-4">
      {/* CPU Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>💻 CPU</CardTitle>
            <ActivityLED status={getStatus(health.cpu.usage)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Usage</span>
              <span className={`font-semibold ${getStatusColor(health.cpu.usage)}`}>
                {health.cpu.usage.toFixed(1)}%
              </span>
            </div>
            {health.cpu.history && health.cpu.history.length > 0 && (
              <SparklineChart
                data={health.cpu.history}
                width={200}
                height={40}
                strokeColor={health.cpu.usage > 80 ? "#ef4444" : "#10b981"}
              />
            )}
            {showDetails && (
              <div className="text-xs text-gray-500">
                {health.cpu.cores} cores
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Memory Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>🧠 Memory</CardTitle>
            <ActivityLED status={getStatus(health.memory.percentage)} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Usage</span>
              <span className={`font-semibold ${getStatusColor(health.memory.percentage)}`}>
                {health.memory.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all ${
                  health.memory.percentage > 80 ? 'bg-red-500' : 
                  health.memory.percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${health.memory.percentage}%` }}
              />
            </div>
            {showDetails && (
              <div className="text-xs text-gray-500">
                {(health.memory.used / 1024 / 1024 / 1024).toFixed(1)} GB / 
                {(health.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB
              </div>
            )}
            {health.memory.history && health.memory.history.length > 0 && (
              <SparklineChart
                data={health.memory.history}
                width={200}
                height={40}
                strokeColor={health.memory.percentage > 80 ? "#ef4444" : "#10b981"}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Disk Usage */}
      {health.disk && health.disk.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>💾 Disk Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {health.disk.map((disk, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{disk.name}</span>
                    <span className={`font-semibold ${getStatusColor(disk.percentage)}`}>
                      {disk.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        disk.percentage > 80 ? 'bg-red-500' : 
                        disk.percentage > 50 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${disk.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Network */}
      {health.network && (
        <Card>
          <CardHeader>
            <CardTitle>📡 Network</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Received</div>
                <div className="font-semibold">
                  {(health.network.bytesReceived / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Sent</div>
                <div className="font-semibold">
                  {(health.network.bytesSent / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}