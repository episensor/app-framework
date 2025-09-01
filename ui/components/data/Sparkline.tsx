import { useMemo } from 'react';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  fill?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = '#10b981',
  strokeWidth = 2,
  fill = false,
  className
}: SparklineProps) {
  const points = useMemo(() => {
    if (!data || data.length === 0) return '';
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    return data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
  }, [data, width, height]);

  if (!data || data.length === 0) {
    return (
      <svg width={width} height={height} className={className}>
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      </svg>
    );
  }

  const fillPoints = points ? `0,${height} ${points} ${width},${height}` : '';

  return (
    <svg width={width} height={height} className={className}>
      {fill && points && (
        <polygon
          points={fillPoints}
          fill={color}
          fillOpacity={0.1}
        />
      )}
      {points && (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {/* Optional: Add dots for last point */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1]! - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * height}
          r={strokeWidth}
          fill={color}
        />
      )}
    </svg>
  );
}
