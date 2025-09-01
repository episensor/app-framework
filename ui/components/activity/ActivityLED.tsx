import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';

export interface ActivityLEDProps {
  type: 'read' | 'write' | 'inactive' | 'active' | 'error';
  decayTime?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  pulse?: boolean;
}

export function ActivityLED({ 
  type, 
  decayTime = 1000, 
  size = 'md',
  className,
  pulse = true
}: ActivityLEDProps) {
  const [isActive, setIsActive] = useState(type !== 'inactive');
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (type === 'inactive') {
      setIsActive(false);
      return;
    }

    // Set active immediately
    setIsActive(true);
    setOpacity(1);

    if (!pulse || type === 'active' || type === 'error') {
      // No decay for persistent states
      return;
    }

    // Start decay animation for transient states
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / decayTime, 1);
      
      if (progress < 1) {
        setOpacity(1 - progress * 0.7); // Don't fade completely
        requestAnimationFrame(animate);
      } else {
        setIsActive(false);
        setOpacity(0.3);
      }
    };

    const animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [type, decayTime, pulse]);

  const sizeClasses = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const colorClasses = {
    read: 'bg-green-500 shadow-green-500/50',
    write: 'bg-blue-500 shadow-blue-500/50',
    active: 'bg-green-500 shadow-green-500/50',
    error: 'bg-red-500 shadow-red-500/50',
    inactive: 'bg-gray-400'
  };

  return (
    <div
      className={cn(
        'rounded-full transition-all duration-100',
        sizeClasses[size],
        isActive ? colorClasses[type] : colorClasses.inactive,
        isActive && pulse && 'shadow-lg',
        className
      )}
      style={{
        opacity: isActive ? opacity : 0.3,
        boxShadow: isActive && pulse ? `0 0 ${opacity * 10}px currentColor` : undefined
      }}
      aria-label={`${type} activity indicator`}
    />
  );
}
