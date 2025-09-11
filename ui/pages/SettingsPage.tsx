/**
 * Settings Page Component
 * Complete settings management interface
 */

import React from 'react';
import { SettingsFramework } from '../components/settings/SettingsFramework';
import { useSettings } from '../contexts/SettingsContext';

export default function SettingsPage() {
  const { settings, updateSetting, saveSettings, isLoading, error } = useSettings();
  
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Application Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Configure your application settings. Changes are saved automatically.
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
      
      <SettingsFramework
        settings={settings}
        onSettingChange={updateSetting}
        onSave={saveSettings}
        loading={isLoading}
      />
    </div>
  );
}