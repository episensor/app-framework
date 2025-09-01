/**
 * Theme Toggle Component
 * Provides UI for switching between light/dark/system themes
 */

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../base/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../base/select';
import { Label } from '../base/label';
import { cn } from '../../utils/cn';

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'button' | 'select';
}

/**
 * Theme toggle component for settings pages
 */
export function ThemeToggle({ 
  className, 
  showLabel = true,
  variant = 'select' 
}: ThemeToggleProps) {
  const { themeConfig, setThemeMode, toggleTheme, isDark } = useTheme();

  if (variant === 'button') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {showLabel && <Label>Theme</Label>}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className="w-10 h-10"
        >
          {isDark ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {showLabel && <Label htmlFor="theme-select">Theme</Label>}
      <Select value={themeConfig.mode} onValueChange={(value: any) => setThemeMode(value)}>
        <SelectTrigger id="theme-select" className="w-[180px]">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="light">
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <span>Light</span>
            </div>
          </SelectItem>
          <SelectItem value="dark">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <span>Dark</span>
            </div>
          </SelectItem>
          <SelectItem value="system">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              <span>System</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Compact theme toggle for headers/toolbars
 */
export function CompactThemeToggle({ className }: { className?: string }) {
  const { toggleTheme, isDark } = useTheme();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn("w-8 h-8", className)}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
