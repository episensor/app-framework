/**
 * Activity LED Component
 * Shows a status indicator with optional animation
 */


import { cn } from '../../src/utils/cn';

export type LEDStatus = 'active' | 'inactive' | 'warning' | 'error' | 'success';

export interface ActivityLEDProps {
  status: LEDStatus;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  animate?: boolean;
  label?: string;
  className?: string;
}

const statusColors: Record<LEDStatus, { bg: string; ring: string }> = {
  active: { bg: 'bg-green-500', ring: 'ring-green-400' },
  success: { bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
  inactive: { bg: 'bg-gray-400', ring: 'ring-gray-300' },
  warning: { bg: 'bg-yellow-500', ring: 'ring-yellow-400' },
  error: { bg: 'bg-red-500', ring: 'ring-red-400' }
};

const sizeClasses = {
  xs: 'h-2 w-2',
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5'
};

export function ActivityLED({
  status,
  size = 'sm',
  animate = true,
  label,
  className
}: ActivityLEDProps) {
  const colors = statusColors[status];
  const shouldAnimate = animate && (status === 'active' || status === 'warning' || status === 'error');

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span className="relative inline-flex">
        {shouldAnimate && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-75',
              colors.bg,
              status === 'active' && 'animate-ping',
              status === 'warning' && 'animate-pulse',
              status === 'error' && 'animate-pulse'
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full',
            sizeClasses[size],
            colors.bg,
            shouldAnimate && 'ring-1',
            shouldAnimate && colors.ring
          )}
        />
      </span>
      {label && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}

export default ActivityLED;