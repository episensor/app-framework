/**
 * Sparkline Chart Component
 * Displays a minimal line chart for showing data trends
 */

import { useMemo } from 'react';
import { cn } from '../../src/utils/cn';

export interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  strokeColor?: string;
  fillColor?: string;
  showDots?: boolean;
  className?: string;
  animate?: boolean;
}

export function SparklineChart({
  data,
  width = 100,
  height = 30,
  strokeWidth = 1.5,
  strokeColor = 'currentColor',
  fillColor,
  showDots = false,
  className,
  animate = true
}: SparklineChartProps) {
  const { path, dots, bounds } = useMemo(() => {
    if (!data || data.length === 0) {
      return { path: '', dots: [], bounds: { min: 0, max: 1 } };
    }

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1 || 1)) * (width - padding * 2) + padding;
      const y = height - ((value - min) / range) * (height - padding * 2) - padding;
      return { x, y, value };
    });

    // Create SVG path
    const pathData = points.reduce((acc, point, index) => {
      if (index === 0) {
        return `M ${point.x},${point.y}`;
      }
      return `${acc} L ${point.x},${point.y}`;
    }, '');

    // Create fill path if needed
    const fillPath = fillColor
      ? `${pathData} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`
      : '';

    return {
      path: pathData,
      fillPath,
      dots: points,
      bounds: { min, max }
    };
  }, [data, width, height, fillColor]);

  if (!data || data.length === 0) {
    return (
      <div className={cn('inline-block', className)} style={{ width, height }}>
        <svg width={width} height={height} className="opacity-20">
          <line
            x1={0}
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray="2,2"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={cn('inline-block', className)} style={{ width, height }}>
      <svg width={width} height={height}>
        {/* Fill area under the line */}
        {fillColor && (
          <path
            d={path}
            fill={fillColor}
            opacity={0.1}
            className={cn(animate && 'transition-all duration-300')}
          />
        )}
        
        {/* Main line */}
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(animate && 'transition-all duration-300')}
        />
        
        {/* Dots at data points */}
        {showDots && dots.map((dot, index) => (
          <circle
            key={index}
            cx={dot.x}
            cy={dot.y}
            r={strokeWidth * 1.5}
            fill={strokeColor}
            className={cn(
              animate && 'transition-all duration-300',
              index === dots.length - 1 && 'animate-pulse'
            )}
          />
        ))}
      </svg>
    </div>
  );
}

export default SparklineChart;