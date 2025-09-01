import React from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/base/popover';
import { cn } from '../../lib/utils';

interface HelpTooltipProps {
  content: string | React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  iconClassName?: string;
}

export function HelpTooltip({ 
  content, 
  title, 
  size = 'sm',
  align = 'start',
  side,
  className,
  iconClassName
}: HelpTooltipProps) {
  const iconSize = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }[size];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button" 
          className={cn(
            "inline-flex items-center text-muted-foreground hover:text-foreground transition-colors",
            className
          )}
          aria-label="Help"
        >
          <HelpCircle className={cn(iconSize, iconClassName)} />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 text-sm" 
        align={align}
        side={side}
      >
        {title && (
          <div className="font-semibold text-foreground mb-2">
            {title}
          </div>
        )}
        <div className="text-muted-foreground leading-relaxed">
          {content}
        </div>
      </PopoverContent>
    </Popover>
  );
}
