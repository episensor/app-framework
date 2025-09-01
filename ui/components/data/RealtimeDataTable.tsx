import { useState, useEffect, useCallback } from 'react';
import { Card } from '../base/card';
import { Badge } from '../base/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../base/table';
import { ActivityLED } from '../activity/ActivityLED';
import { Sparkline } from './Sparkline';
import { cn } from '../../utils/cn';

export interface DataColumn<T> {
  key: string;
  label: string;
  accessor: (item: T) => any;
  render?: (value: any, item: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface RealtimeDataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  keyField: string;
  title?: string;
  description?: string;
  
  // Real-time features
  showActivity?: boolean;
  activityField?: string;
  activityDecay?: number;
  
  // Sparkline features
  showSparkline?: boolean;
  sparklineField?: string;
  sparklineHistory?: Map<string, number[]>;
  sparklineColor?: string;
  
  // Status features
  showStatus?: boolean;
  statusField?: string;
  statusConfig?: {
    [key: string]: {
      label: string;
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      icon?: React.ReactNode;
    };
  };
  
  // Hierarchy features
  expandable?: boolean;
  childrenField?: string;
  defaultExpanded?: boolean;
  
  // Styling
  className?: string;
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
  
  // Callbacks
  onRowClick?: (item: T) => void;
  onRefresh?: () => void;
}

export function RealtimeDataTable<T extends Record<string, any>>({
  data,
  columns,
  keyField,
  title,
  description,
  showActivity = false,
  activityField = 'activity',
  activityDecay = 1000,
  showSparkline = false,
  sparklineField = 'value',
  sparklineHistory,
  sparklineColor = '#10b981',
  showStatus = false,
  statusField = 'status',
  statusConfig,
  expandable = false,
  childrenField = 'children',
  defaultExpanded = false,
  className,
  striped: _striped = false,
  hover = true,
  compact = false,
  onRowClick,
  onRefresh: _onRefresh
}: RealtimeDataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activityMap, setActivityMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (defaultExpanded && expandable) {
      const keys = data.map(item => item[keyField]);
      setExpandedRows(new Set(keys));
    }
  }, [defaultExpanded, expandable, data, keyField]);

  // Track activity changes
  useEffect(() => {
    if (showActivity) {
      const newActivityMap = new Map<string, string>();
      data.forEach(item => {
        const key = item[keyField];
        const activity = item[activityField];
        if (activity && activity !== 'inactive') {
          newActivityMap.set(key, activity);
          // Clear activity after decay time
          setTimeout(() => {
            setActivityMap(prev => {
              const next = new Map(prev);
              next.delete(key);
              return next;
            });
          }, activityDecay);
        }
      });
      setActivityMap(prev => new Map([...prev, ...newActivityMap]));
    }
  }, [data, showActivity, keyField, activityField, activityDecay]);

  const toggleRow = useCallback((key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const renderRow = (item: T, level: number = 0) => {
    const key = item[keyField];
    const isExpanded = expandedRows.has(key);
    const hasChildren = expandable && item[childrenField] && item[childrenField].length > 0;
    const activity = activityMap.get(key) || 'inactive';

    return (
      <>
        <TableRow
          key={key}
          className={cn(
            hover && 'hover:bg-gray-50 transition-colors',
            onRowClick && 'cursor-pointer',
            level > 0 && 'bg-gray-50/50'
          )}
          onClick={() => onRowClick?.(item)}
        >
          {columns.map((column, idx) => (
            <TableCell
              key={column.key}
              className={cn(
                column.align === 'center' && 'text-center',
                column.align === 'right' && 'text-right',
                compact && 'py-2',
                idx === 0 && level > 0 && `pl-${4 + level * 4}`
              )}
              style={{ width: column.width }}
            >
              <div className="flex items-center gap-2">
                {/* Expand/collapse button */}
                {idx === 0 && hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRow(key);
                    }}
                    className="p-0.5 hover:bg-gray-200 rounded"
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                )}
                
                {/* Activity indicator */}
                {idx === 0 && showActivity && (
                  <ActivityLED
                    type={activity as any}
                    size="sm"
                    decayTime={activityDecay}
                  />
                )}
                
                {/* Column content */}
                {column.render ? 
                  column.render(column.accessor(item), item) : 
                  column.accessor(item)
                }
                
                {/* Status badge */}
                {column.key === statusField && showStatus && statusConfig && (
                  <Badge variant={statusConfig[item[statusField]]?.variant || 'default'}>
                    {statusConfig[item[statusField]]?.icon}
                    {statusConfig[item[statusField]]?.label || item[statusField]}
                  </Badge>
                )}
                
                {/* Sparkline */}
                {column.key === sparklineField && showSparkline && sparklineHistory && (
                  <Sparkline
                    data={sparklineHistory.get(key) || []}
                    color={sparklineColor}
                    width={60}
                    height={20}
                  />
                )}
              </div>
            </TableCell>
          ))}
        </TableRow>
        
        {/* Render children if expanded */}
        {isExpanded && hasChildren && item[childrenField].map((child: T) => 
          renderRow(child, level + 1)
        )}
      </>
    );
  };

  return (
    <Card className={className}>
      {(title || description) && (
        <div className="p-4 border-b">
          {title && <h3 className="font-semibold text-lg">{title}</h3>}
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
      )}
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(column => (
                <TableHead
                  key={column.key}
                  className={cn(
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right'
                  )}
                  style={{ width: column.width }}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-gray-500">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              data.map(item => renderRow(item))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
