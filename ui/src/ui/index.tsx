/**
 * Basic UI Primitives
 * Minimal implementations for framework components
 */


import { cn } from '../utils/cn';

// Button Component
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const variants = {
      default: 'bg-blue-600 text-white hover:bg-blue-700',
      outline: 'border border-gray-300 hover:bg-gray-50',
      ghost: 'hover:bg-gray-100'
    };
    
    const sizes = {
      sm: 'px-3 py-1 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg'
    };
    
    return (
      <button
        ref={ref}
        className={cn(
          'rounded-md font-medium transition-colors',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

// Select Components
export const Select: React.FC<{ children: React.ReactNode; value?: string; onValueChange?: (value: string) => void }> = 
  ({ children, value, onValueChange }) => {
    return <div className="relative">{children}</div>;
  };

export const SelectTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="border rounded-md px-3 py-2 cursor-pointer">{children}</div>;
};

export const SelectContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="absolute mt-1 w-full bg-white border rounded-md shadow-lg z-10">{children}</div>;
};

export const SelectItem: React.FC<{ value: string; children: React.ReactNode }> = ({ children }) => {
  return <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer">{children}</div>;
};

export const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  return <span>{placeholder}</span>;
};

// Progress Component
export const Progress: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  return (
    <div className={cn("w-full bg-gray-200 rounded-full h-2", className)}>
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

// Badge Component
export const Badge: React.FC<{ children: React.ReactNode; variant?: 'default' | 'success' | 'warning' | 'error' }> = 
  ({ children, variant = 'default' }) => {
    const variants = {
      default: 'bg-gray-100 text-gray-800',
      success: 'bg-green-100 text-green-800',
      warning: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={cn('px-2 py-1 rounded-md text-xs font-medium', variants[variant])}>
        {children}
      </span>
    );
  };

// Alert Components
export const Alert: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
  return (
    <div className={cn("border rounded-md p-4", className)}>
      {children}
    </div>
  );
};

export const AlertDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="text-sm">{children}</div>;
};

// Tooltip Components
export const TooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const Tooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="relative inline-block">{children}</div>;
};

export const TooltipTrigger: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const TooltipContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="absolute z-10 px-2 py-1 text-sm bg-gray-900 text-white rounded shadow-lg">
      {children}
    </div>
  );
};