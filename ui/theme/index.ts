/**
 * EpiSensor UI Framework - Centralized Theme Configuration
 * 
 * @module @episensor/ui-framework/theme
 */

export const theme = {
  colors: {
    // Primary brand colors
    primary: {
      DEFAULT: '#E21350', // EpiSensor pink
      hover: '#c01144',
      light: '#ff4d7d',
      dark: '#a00e3a',
    },
    
    // Dark theme colors (oxide-inspired)
    dark: {
      bg: {
        primary: '#0a0a0a',
        secondary: '#141414',
        tertiary: '#1a1a1a',
        elevated: '#242424',
      },
      border: {
        DEFAULT: '#2a2a2a',
        subtle: '#1f1f1f',
        strong: '#3a3a3a',
      },
    },
    
    // Light theme colors (current)
    light: {
      bg: {
        primary: '#ffffff',
        secondary: '#f8f9fa',
        tertiary: '#f3f4f6',
        elevated: '#ffffff',
      },
      border: {
        DEFAULT: '#e5e7eb',
        subtle: '#f3f4f6',
        strong: '#d1d5db',
      },
    },
    
    // Semantic colors
    success: {
      DEFAULT: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    warning: {
      DEFAULT: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      DEFAULT: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    info: {
      DEFAULT: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
    },
    
    // Special colors
    intelligent: {
      DEFAULT: '#8b5cf6', // Purple for intelligent templates
      light: '#a78bfa',
      dark: '#7c3aed',
    },
    
    // Activity indicators
    activity: {
      read: '#10b981', // Green
      write: '#3b82f6', // Blue
      inactive: '#6b7280', // Gray
    },
  },
  
  // Gradients (oxide-inspired)
  gradients: {
    subtle: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)',
    card: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
    glow: 'radial-gradient(circle at 50% 0%, rgba(226,19,80,0.15) 0%, transparent 70%)',
    intelligent: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(139,92,246,0.05) 100%)',
  },
  
  // Shadows (oxide-inspired)
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    glow: '0 0 20px rgba(226,19,80,0.3)',
    'glow-intelligent': '0 0 20px rgba(139,92,246,0.3)',
  },
  
  // Border radius
  radius: {
    sm: '0.25rem',
    DEFAULT: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  
  // Spacing
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    DEFAULT: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
    '2xl': '4rem',
  },
  
  // Typography
  typography: {
    fonts: {
      sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"JetBrains Mono", "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    weights: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
  
  // Transitions
  transitions: {
    fast: '150ms',
    DEFAULT: '200ms',
    slow: '300ms',
    timing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // Z-index layers
  zIndex: {
    base: 0,
    elevated: 10,
    dropdown: 20,
    sticky: 30,
    fixed: 40,
    modal: 50,
    popover: 60,
    tooltip: 70,
  },
  
  // Opacity values for oxide-style effects
  opacity: {
    hover: 0.8,
    disabled: 0.5,
    backdrop: 0.7,
    subtle: 0.1,
  },
};

// Helper function to get CSS variables
export const getCSSVariables = (isDark: boolean = false) => {
  const colors = isDark ? theme.colors.dark : theme.colors.light;
  
  return {
    '--color-bg-primary': colors.bg.primary,
    '--color-bg-secondary': colors.bg.secondary,
    '--color-bg-tertiary': colors.bg.tertiary,
    '--color-bg-elevated': colors.bg.elevated,
    '--color-border': colors.border.DEFAULT,
    '--color-border-subtle': colors.border.subtle,
    '--color-border-strong': colors.border.strong,
    '--color-text': isDark ? '#ffffff' : '#000000',
    '--color-text-secondary': isDark ? '#a1a1aa' : '#6b7280',
    '--color-text-tertiary': isDark ? '#71717a' : '#9ca3af',
  };
};

// Export theme type for TypeScript support
export type Theme = typeof theme;
