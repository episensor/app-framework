/**
 * Live Data Table Component
 * Displays real-time data in a table format with activity indicators
 */

import React, { useEffect, useState } from 'react';
import { Card } from './Card';
import { ActivityLED, type LEDStatus } from './ActivityLED';
import { SparklineChart } from './SparklineChart';
import { cn } from '../utils/cn';
import { Clock, Activity } from 'lucide-react';

export interface LiveDataColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string | React.ReactNode;
}

export interface LiveDataRow {
  id: string;
  status?: LEDStatus;
  data: Record<string, any>;
  sparkline?: number[];
  lastUpdate?: Date;
  isNew?: boolean;
  isUpdated?: boolean;
}

export interface LiveDataTableProps {
  columns: LiveDataColumn[];
  rows: LiveDataRow[];
  title?: string;
  showActivity?: boolean;
  showSparklines?: boolean;
  showTimestamps?: boolean;
  onRowClick?: (row: LiveDataRow) => void;
  className?: string;
  maxRows?: number;
  emptyMessage?: string;
}

export function LiveDataTable({
  columns,
  rows,
  title,
  showActivity = true,
  showSparklines = false,
  showTimestamps = false,
  onRowClick,
  className,
  maxRows,
  emptyMessage = 'No data available'
}: LiveDataTableProps) {
  const [animatedRows, setAnimatedRows] = useState<Set<string>>(new Set());
  const displayRows = maxRows ? rows.slice(0, maxRows) : rows;

  // Track row updates for animation
  useEffect(() => {
    const newAnimated = new Set<string>();
    rows.forEach(row => {
      if (row.isNew || row.isUpdated) {
        newAnimated.add(row.id);
        
        // Remove animation after delay
        setTimeout(() => {
          setAnimatedRows(prev => {
            const next = new Set(prev);
            next.delete(row.id);
            return next;
          });
        }, 1000);
      }
    });
    
    if (newAnimated.size > 0) {
      setAnimatedRows(prev => new Set([...prev, ...newAnimated]));
    }
  }, [rows]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      {title && (
        <div className="border-b bg-muted/50 px-4 py-3">
          <h3 className="font-semibold">{title}</h3>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              {showActivity && (
                <th className="px-4 py-2 text-left">
                  <Activity className="h-4 w-4" />
                </th>
              )}
              {columns.map(column => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-2 text-sm font-medium text-muted-foreground',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.align !== 'center' && column.align !== 'right' && 'text-left'
                  )}
                  style={{ width: column.width }}
                >
                  {column.label}
                </th>
              ))}
              {showSparklines && (
                <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">
                  Trend
                </th>
              )}
              {showTimestamps && (
                <th className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">
                  <Clock className="inline h-4 w-4" />
                </th>
              )}
            </tr>
          </thead>
          
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    columns.length +
                    (showActivity ? 1 : 0) +
                    (showSparklines ? 1 : 0) +
                    (showTimestamps ? 1 : 0)
                  }
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayRows.map(row => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b transition-all',
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                    animatedRows.has(row.id) && 'animate-pulse bg-blue-50 dark:bg-blue-950/20'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {showActivity && (
                    <td className="px-4 py-2">
                      <ActivityLED
                        status={row.status || 'inactive'}
                        size="xs"
                        animate={row.status === 'active'}
                      />
                    </td>
                  )}
                  
                  {columns.map(column => {
                    const value = row.data[column.key];
                    const formatted = column.format ? column.format(value) : value;
                    
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          'px-4 py-2 text-sm',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                  
                  {showSparklines && (
                    <td className="px-4 py-2">
                      {row.sparkline && row.sparkline.length > 0 && (
                        <SparklineChart
                          data={row.sparkline}
                          width={80}
                          height={24}
                          strokeWidth={1}
                          strokeColor="#6b7280"
                        />
                      )}
                    </td>
                  )}
                  
                  {showTimestamps && (
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {row.lastUpdate && formatTimestamp(row.lastUpdate)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {maxRows && rows.length > maxRows && (
        <div className="border-t bg-muted/50 px-4 py-2 text-center text-sm text-muted-foreground">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </Card>
  );
}

export default LiveDataTable;