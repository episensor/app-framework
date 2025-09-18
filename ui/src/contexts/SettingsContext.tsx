/**
 * Settings Context
 * Provides settings state and operations to the application
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/apiRequest';

interface SettingsContextValue {
  settings: Record<string, any>;
  isLoading: boolean;
  error: string | null;
  updateSetting: (key: string, value: any) => void;
  saveSettings: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Load settings on mount
  useEffect(() => {
    refreshSettings();
  }, []);
  
  // Auto-save settings when changes are made
  useEffect(() => {
    if (hasChanges) {
      const timer = setTimeout(() => {
        saveSettings();
      }, 1000); // Debounce for 1 second
      
      return () => clearTimeout(timer);
    }
  }, [settings, hasChanges]);
  
  const refreshSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await api.get('/api/settings');
      setSettings(data);
      setHasChanges(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const updateSetting = useCallback((key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  }, []);
  
  const saveSettings = useCallback(async () => {
    if (!hasChanges) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await api.put('/api/settings', settings);
      setHasChanges(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [settings, hasChanges]);
  
  const value: SettingsContextValue = {
    settings,
    isLoading,
    error,
    updateSetting,
    saveSettings,
    refreshSettings
  };
  
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}