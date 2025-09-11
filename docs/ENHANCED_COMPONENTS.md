# Enhanced Settings and LogViewer Components

Framework v4.3.0 introduces enhanced Settings and LogViewer components based on the proven, working implementation from VPP Manager. These components provide production-ready alternatives to the basic components with comprehensive features.

## Overview

The enhanced components were created by extracting and improving the working Settings and Logs functionality from VPP Manager, ensuring they are battle-tested and production-ready.

### What's Available

- **EnhancedSettings**: Full-featured settings component with category navigation, validation, and form management
- **EnhancedLogViewer**: Comprehensive log viewer with real-time streaming, filtering, and export capabilities
- **EnhancedSettingsSchema**: Complete TypeScript interfaces and utility functions for settings management

## Enhanced Settings Component

### Features

- ✅ **Category Navigation**: Organized settings with icon-based navigation
- ✅ **Password Visibility**: Toggle password field visibility
- ✅ **Restart Indicators**: Shows when settings require restart
- ✅ **Rich Validation**: Custom validation with detailed error messages
- ✅ **Form State Management**: Tracks dirty state, touched fields, and validation
- ✅ **Network Interface Selection**: Built-in network interface picker
- ✅ **Comprehensive TypeScript**: Full type safety and IntelliSense support

### Basic Usage

```tsx
import { EnhancedSettings, EnhancedSettingsSchema } from '@episensor/app-framework';

const settingsSchema: EnhancedSettingsSchema = {
  version: '1.0.0',
  categories: [
    {
      id: 'general',
      label: 'General',
      description: 'General application settings',
      icon: 'Settings',
      settings: [
        {
          key: 'app.title',
          label: 'Application Title',
          description: 'The title shown in the browser tab',
          type: 'string',
          defaultValue: 'My App',
          category: 'general'
        },
        {
          key: 'app.debug',
          label: 'Debug Mode',
          description: 'Enable debug logging',
          type: 'boolean',
          defaultValue: false,
          requiresRestart: true,
          category: 'general'
        }
      ]
    }
  ]
};

export function SettingsPage() {
  return (
    <EnhancedSettings
      schema={settingsSchema}
      apiEndpoints={{
        get: '/api/settings',
        save: '/api/settings'
      }}
      onError={(error) => console.error('Settings error:', error)}
    />
  );
}
```

### Advanced Usage with Custom Handlers

```tsx
export function AdvancedSettingsPage() {
  const handleSave = async (settings: Record<string, any>, changedKeys: string[]) => {
    try {
      // Custom save logic
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      const result = await response.json();
      
      // Check if restart is required
      const restartRequired = changedKeys.some(key => {
        const setting = getSettingByKey(settingsSchema.categories, key);
        return setting?.requiresRestart;
      });
      
      return { 
        success: result.success, 
        requiresRestart: restartRequired 
      };
    } catch (error) {
      return { success: false, error };
    }
  };

  return (
    <EnhancedSettings
      schema={settingsSchema}
      onSave={handleSave}
      onSettingsChange={(settings) => {
        // React to settings changes
        console.log('Settings updated:', settings);
      }}
    />
  );
}
```

### Setting Types

```tsx
// String setting
{
  key: 'server.host',
  label: 'Server Host',
  type: 'string',
  defaultValue: 'localhost',
  placeholder: 'Enter hostname',
  inputWidth: 'medium'
}

// Number setting with validation
{
  key: 'server.port',
  label: 'Server Port',
  type: 'number',
  defaultValue: 3000,
  min: 1,
  max: 65535,
  validation: (value) => {
    if (value < 1024) return 'Port must be 1024 or higher';
    return true;
  }
}

// Select setting
{
  key: 'logging.level',
  label: 'Log Level',
  type: 'select',
  defaultValue: 'info',
  options: [
    { value: 'debug', label: 'Debug', description: 'Verbose logging' },
    { value: 'info', label: 'Info', description: 'Standard logging' },
    { value: 'warn', label: 'Warning', description: 'Warnings only' },
    { value: 'error', label: 'Error', description: 'Errors only' }
  ]
}

// Password setting
{
  key: 'auth.password',
  label: 'Password',
  type: 'password',
  defaultValue: '',
  sensitive: true,
  validation: (value) => {
    if (value.length < 8) return 'Password must be at least 8 characters';
    return true;
  }
}

// Network interface setting
{
  key: 'network.interface',
  label: 'Network Interface',
  type: 'network-interface',
  defaultValue: 'auto',
  placeholder: 'Select network interface'
}
```

## Enhanced LogViewer Component

### Features

- ✅ **Real-time Streaming**: WebSocket support for live log updates
- ✅ **Archive Management**: Browse and download archived log files
- ✅ **Advanced Filtering**: Filter by level, category, source, and search terms
- ✅ **Export Capabilities**: Export logs in txt, json, or csv formats
- ✅ **Multiple Log Formats**: Supports JSON, structured text, and plain text logs
- ✅ **Auto-scroll Control**: Automatic scrolling with manual override
- ✅ **Category Organization**: Organize logs by different categories

### Basic Usage

```tsx
import { EnhancedLogViewer, LogCategory } from '@episensor/app-framework';
import { Terminal, Archive } from 'lucide-react';

const logCategories: LogCategory[] = [
  {
    id: 'current',
    label: 'Current',
    icon: Terminal,
    description: 'View live system logs'
  },
  {
    id: 'archives',
    label: 'Archives', 
    icon: Archive,
    description: 'Download archived log files'
  }
];

export function LogsPage() {
  return (
    <EnhancedLogViewer
      categories={logCategories}
      apiEndpoints={{
        current: '/api/logs/current',
        archives: '/api/logs/archives',
        clear: '/api/logs/clear',
        export: '/api/logs/export'
      }}
      websocketUrl="ws://localhost:3000/logs"
      maxEntries={1000}
      autoScroll={true}
      onError={(error) => console.error('Log viewer error:', error)}
    />
  );
}
```

### Advanced Usage with Custom Handlers

```tsx
export function AdvancedLogsPage() {
  const handleClear = async () => {
    const confirmed = confirm('Clear all current logs?');
    if (!confirmed) return;
    
    await fetch('/api/logs/clear', { method: 'POST' });
    // Custom notification
    toast.success('Logs cleared successfully');
  };

  const handleExport = async (format: 'txt' | 'json' | 'csv') => {
    // Custom export logic
    const response = await fetch(`/api/logs/export?format=${format}`);
    const blob = await response.blob();
    
    // Custom filename
    const filename = `app-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    
    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWebSocketMessage = (message: any) => {
    // Custom WebSocket message handling
    if (message.type === 'alert') {
      toast.error(`Alert: ${message.message}`);
    }
  };

  return (
    <EnhancedLogViewer
      categories={logCategories}
      apiEndpoints={{
        current: '/api/logs/current',
        archives: '/api/logs/archives'
      }}
      websocketUrl="ws://localhost:3000/logs"
      onClear={handleClear}
      onExport={handleExport}
      onWebSocketMessage={handleWebSocketMessage}
      showTimestamps={true}
      showCategories={true}
      showSources={true}
    />
  );
}
```

## Migration from Basic Components

### From Basic Settings Component

**Before (Basic Settings):**
```tsx
import { Settings } from '@episensor/app-framework/ui';

<Settings
  schema={{ categories: [...] }}
  apiEndpoints={{ get: '/api/settings', save: '/api/settings' }}
  onSave={handleSave}
/>
```

**After (Enhanced Settings):**
```tsx
import { EnhancedSettings, EnhancedSettingsSchema } from '@episensor/app-framework';

const schema: EnhancedSettingsSchema = {
  version: '1.0.0',
  categories: [...] // Enhanced category structure
};

<EnhancedSettings
  schema={schema}
  apiEndpoints={{ get: '/api/settings', save: '/api/settings' }}
  onSave={handleSave}
/>
```

### From Basic LogViewer Component

**Before (Basic LogViewer):**
```tsx
import { LogViewer } from '@episensor/app-framework/ui';

<LogViewer
  apiUrl="/api/logs"
  maxEntries={1000}
/>
```

**After (Enhanced LogViewer):**
```tsx
import { EnhancedLogViewer } from '@episensor/app-framework';

<EnhancedLogViewer
  apiEndpoints={{
    current: '/api/logs/current',
    archives: '/api/logs/archives',
    clear: '/api/logs/clear',
    export: '/api/logs/export'
  }}
  websocketUrl="ws://localhost:3000/logs"
  maxEntries={1000}
/>
```

## Utility Functions

The enhanced components come with comprehensive utility functions:

```tsx
import {
  getSettingByKey,
  validateSetting,
  validateAllSettings,
  getRestartRequiredSettings,
  flattenSettingsValues,
  unflattenSettingsValues,
  createSettingsFormState
} from '@episensor/app-framework';

// Get a specific setting definition
const setting = getSettingByKey(categories, 'server.port');

// Validate a single setting
const error = validateSetting(setting, 3000);

// Validate all settings
const validation = validateAllSettings(categories, values);

// Check which settings require restart
const restartKeys = getRestartRequiredSettings(categories, changedKeys);

// Flatten nested settings for API
const flattened = flattenSettingsValues(nestedSettings);

// Create form state
const formState = createSettingsFormState(categories, initialValues);
```

## Best Practices

### Settings Schema Design

1. **Organize by Categories**: Group related settings together
2. **Use Clear Labels**: Make setting purposes obvious
3. **Provide Descriptions**: Help users understand what each setting does
4. **Add Help Text**: Use tooltips for complex settings
5. **Set Sensible Defaults**: Ensure the app works out of the box
6. **Mark Restart Requirements**: Be clear about when restarts are needed

### Log Management

1. **Use Structured Logging**: JSON logs are easier to parse and filter
2. **Include Context**: Add categories and sources to log entries
3. **Implement Log Rotation**: Prevent disk space issues
4. **Provide Export Options**: Allow users to download logs for analysis
5. **Real-time Updates**: Use WebSocket for live log streaming

### Performance Considerations

1. **Limit Log Entries**: Use `maxEntries` to prevent memory issues
2. **Debounce Searches**: Avoid excessive filtering on every keystroke
3. **Lazy Load Archives**: Only load archive list when needed
4. **Optimize WebSocket**: Handle connection failures gracefully

## API Requirements

### Settings API

Your backend should provide these endpoints:

```
GET /api/settings
- Returns: Flattened settings object

PUT /api/settings  
- Body: Flattened settings object
- Returns: { success: boolean, requiresRestart?: boolean }
```

### Logs API

Your backend should provide these endpoints:

```
GET /api/logs/current
- Returns: Current log file content (text or JSON lines)

GET /api/logs/archives
- Returns: Array of log file objects with name, size, modified

POST /api/logs/clear
- Clears current log file

POST /api/logs/purge
- Deletes all archived logs

GET /api/logs/export?format=txt|json|csv
- Returns: Log file in requested format

WebSocket /logs (optional)
- Streams real-time log entries
```

## Troubleshooting

### Common Issues

1. **Settings Not Saving**: Check API endpoints and CORS configuration
2. **Validation Errors**: Ensure setting definitions match expected types
3. **WebSocket Connection Failed**: Verify WebSocket URL and server support
4. **Logs Not Loading**: Check API endpoint responses and authentication
5. **TypeScript Errors**: Ensure proper imports and type definitions

### Debug Mode

Enable debug logging to troubleshoot issues:

```tsx
<EnhancedSettings
  schema={schema}
  onError={(error) => {
    console.error('Settings error:', error);
    // Add your error reporting here
  }}
/>
```

## Migration Timeline

**Recommended approach:**

1. **Phase 1**: Install framework v4.3.0+ 
2. **Phase 2**: Test enhanced components in development
3. **Phase 3**: Update API endpoints to match expected format
4. **Phase 4**: Migrate one component at a time
5. **Phase 5**: Remove old component imports after verification

**Do not migrate until:**
- ✅ Framework v4.3.0+ is stable in your environment
- ✅ API endpoints are updated and tested
- ✅ Enhanced components work correctly in development
- ✅ All team members are familiar with the new API

The enhanced components are designed to be drop-in replacements with significantly more functionality, but take time to test thoroughly before production deployment.
