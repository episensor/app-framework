/**
 * EpiSensor UI Framework - Theme Provider
 * Provides theme context and configuration for all apps
 * 
 * @module @episensor/ui-framework/theme
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { theme as defaultTheme } from './index';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeConfig {
  mode: ThemeMode;
  theme: typeof defaultTheme;
  customColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
}

interface ThemeContextValue {
  themeConfig: ThemeConfig;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  theme?: typeof defaultTheme;
  customColors?: ThemeConfig['customColors'];
  persistPreference?: boolean;
}

/**
 * Theme Provider Component
 * Manages theme state and provides theme context to the app
 */
export function ThemeProvider({
  children,
  defaultMode = 'system',
  theme = defaultTheme,
  customColors,
  persistPreference = true,
}: ThemeProviderProps) {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
    mode: defaultMode,
    theme,
    customColors,
  });
  
  const [isDark, setIsDark] = useState(false);

  // Load saved theme preference
  useEffect(() => {
    if (persistPreference) {
      const savedMode = localStorage.getItem('theme-mode') as ThemeMode;
      if (savedMode) {
        setThemeConfig(prev => ({ ...prev, mode: savedMode }));
      }
    }
  }, [persistPreference]);

  // Apply theme mode
  useEffect(() => {
    const root = document.documentElement;
    
    if (themeConfig.mode === 'system') {
      // Use system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const actuallyDark = mediaQuery.matches;
      setIsDark(actuallyDark);
      root.classList.toggle('dark', actuallyDark);
      
      // Listen for system theme changes
      const handler = (e: MediaQueryListEvent) => {
        const isDarkMode = e.matches;
        setIsDark(isDarkMode);
        root.classList.toggle('dark', isDarkMode);
      };
      
      mediaQuery.addEventListener('change', handler);
      return () => {
        mediaQuery.removeEventListener('change', handler);
      };
    } else {
      // Use manual setting
      const actuallyDark = themeConfig.mode === 'dark';
      setIsDark(actuallyDark);
      root.classList.toggle('dark', actuallyDark);
      return undefined;
    }
  }, [themeConfig.mode]);

  // Apply custom colors
  useEffect(() => {
    if (customColors) {
      const root = document.documentElement;
      
      if (customColors.primary) {
        // Convert hex to HSL for CSS variables
        const hsl = hexToHSL(customColors.primary);
        root.style.setProperty('--primary', hsl);
      }
      
      if (customColors.secondary) {
        const hsl = hexToHSL(customColors.secondary);
        root.style.setProperty('--secondary', hsl);
      }
      
      if (customColors.accent) {
        const hsl = hexToHSL(customColors.accent);
        root.style.setProperty('--accent', hsl);
      }
    }
  }, [customColors]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeConfig(prev => ({ ...prev, mode }));
    if (persistPreference) {
      localStorage.setItem('theme-mode', mode);
    }
  };

  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark';
    setThemeMode(newMode);
  };

  const value: ThemeContextValue = {
    themeConfig,
    setThemeMode,
    toggleTheme,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to use theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Helper function to convert hex color to HSL
 */
function hexToHSL(hex: string): string {
  // Remove the hash if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
