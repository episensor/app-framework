/**
 * Metric Card Component
 * Displays a metric with optional sparkline and status indicator
 */


import { Card } from './Card';
import { SparklineChart } from './SparklineChart';
import { ActivityLED, type LEDStatus } from './ActivityLED';
import { cn } from '../../utils/cn';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string | number;
  trendLabel?: string;
  sparklineData?: number[];
  status?: LEDStatus;
  statusLabel?: string;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
  onClick?: () => void;
}

export function MetricCard({
  title,
  value,
  unit,
  description,
  trend,
  trendValue,
  trendLabel,
  sparklineData,
  status,
  statusLabel,
  icon,
  className,
  valueClassName,
  onClick
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <Card 
      className={cn(
        'p-4 transition-all',
        onClick && 'cursor-pointer hover:shadow-md',
        className
      )}
      onClick={onClick}
    >
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {icon && (
              <div className="text-muted-foreground">{icon}</div>
            )}
            <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          </div>
          {status && (
            <ActivityLED status={status} size="xs" label={statusLabel} />
          )}
        </div>

        {/* Value */}
        <div className="flex items-baseline gap-1">
          <span className={cn(
            'text-2xl font-bold',
            valueClassName
          )}>
            {value}
          </span>
          {unit && (
            <span className="text-sm text-muted-foreground">{unit}</span>
          )}
        </div>

        {/* Trend or Description */}
        {(trend || trendValue !== undefined) && (
          <div className="flex items-center gap-2">
            <TrendIcon className={cn('h-4 w-4', trendColor)} />
            {trendValue !== undefined && (
              <span className={cn('text-sm font-medium', trendColor)}>
                {trendValue}
              </span>
            )}
            {trendLabel && (
              <span className="text-sm text-muted-foreground">
                {trendLabel}
              </span>
            )}
          </div>
        )}

        {!trend && description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="pt-2">
            <SparklineChart
              data={sparklineData}
              width={240}
              height={40}
              strokeColor={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280'}
              fillColor={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280'}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

export default MetricCard;