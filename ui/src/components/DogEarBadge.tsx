
import { Cpu } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DogEarBadgeProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  color?: 'purple' | 'blue' | 'green' | 'red' | 'amber';
}

export function DogEarBadge({ 
  className, 
  size = 'md',
  icon,
  color = 'purple'
}: DogEarBadgeProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20
  };

  const colorGradients = {
    purple: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    blue: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    green: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    red: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    amber: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  };

  return (
    <div 
      className={cn(
        "absolute top-0 right-0 overflow-hidden",
        sizeClasses[size],
        className
      )}
    >
      {/* Triangle shape with gradient */}
      <div 
        className="absolute top-0 right-0 w-full h-full"
        style={{
          background: colorGradients[color],
          clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
        }}
      />
      
      {/* Icon */}
      <div className="absolute top-1 right-1 text-white">
        {icon || <Cpu size={iconSizes[size]} />}
      </div>
      
      {/* Subtle shadow for depth */}
      <div 
        className="absolute top-0 right-0 w-full h-full opacity-20"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.2) 50%)',
          clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
        }}
      />
    </div>
  );
}
