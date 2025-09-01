import React from 'react';
import { 
  Gauge, 
  Sun, 
  Battery, 
  Thermometer, 
  Zap, 
  Cpu 
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DeviceIconProps {
  category?: string;
  className?: string;
  size?: number;
}

export function DeviceIcon({ 
  category, 
  className,
  size = 32 
}: DeviceIconProps) {
  const iconProps = {
    size,
    className: cn('text-gray-400', className)
  };

  switch (category?.toLowerCase()) {
    case 'meter':
    case 'metering':
      return <Gauge {...iconProps} />;
    case 'solar':
      return <Sun {...iconProps} />;
    case 'battery':
      return <Battery {...iconProps} />;
    case 'hvac':
      return <Thermometer {...iconProps} />;
    case 'generator':
      return <Zap {...iconProps} />;
    default:
      return <Cpu {...iconProps} />;
  }
}
