import { Card } from '../base/card';
import { cn } from '../../utils/cn';
import { LucideIcon } from 'lucide-react';

export interface StatCard {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label?: string;
    positive?: boolean;
  };
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export interface DashboardStatsProps {
  stats: StatCard[];
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export function DashboardStats({
  stats,
  columns = 4,
  className
}: DashboardStatsProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-3 lg:grid-cols-6'
  };

  const colorClasses = {
    default: '',
    primary: 'border-blue-200 bg-blue-50/50',
    success: 'border-green-200 bg-green-50/50',
    warning: 'border-yellow-200 bg-yellow-50/50',
    danger: 'border-red-200 bg-red-50/50'
  };

  const iconColorClasses = {
    default: 'text-gray-600',
    primary: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600'
  };

  return (
    <div className={cn(`grid gap-4 ${gridCols[columns]}`, className)}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const color = stat.color || 'default';
        
        return (
          <Card
            key={index}
            className={cn(
              'p-4 transition-all hover:shadow-md',
              colorClasses[color],
              stat.className
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {Icon && (
                    <Icon className={cn('h-4 w-4', iconColorClasses[color])} />
                  )}
                  <p className="text-sm font-medium text-gray-600">
                    {stat.label}
                  </p>
                </div>
                
                <div className="mt-2">
                  <p className="text-2xl font-bold">
                    {stat.value}
                  </p>
                  
                  {stat.description && (
                    <p className="text-xs text-gray-500 mt-1">
                      {stat.description}
                    </p>
                  )}
                  
                  {stat.trend && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className={cn(
                        'text-xs font-medium',
                        stat.trend.positive ? 'text-green-600' : 'text-red-600'
                      )}>
                        {stat.trend.positive ? '↑' : '↓'}
                        {Math.abs(stat.trend.value)}%
                      </span>
                      {stat.trend.label && (
                        <span className="text-xs text-gray-500">
                          {stat.trend.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Compact stat card for smaller displays
 */
export interface CompactStatProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: number;
  className?: string;
}

export function CompactStat({
  label,
  value,
  icon: Icon,
  trend,
  className
}: CompactStatProps) {
  return (
    <div className={cn('flex items-center justify-between p-3 bg-white rounded-lg border', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 bg-gray-100 rounded">
            <Icon className="h-4 w-4 text-gray-600" />
          </div>
        )}
        <div>
          <p className="text-xs text-gray-600">{label}</p>
          <p className="font-semibold">{value}</p>
        </div>
      </div>
      {trend !== undefined && (
        <span className={cn(
          'text-xs font-medium',
          trend >= 0 ? 'text-green-600' : 'text-red-600'
        )}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  );
}
