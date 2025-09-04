# Logging Architecture

## Overview

The framework provides a unified logging system built on Winston that works seamlessly in both development and production environments, with special enhancements for desktop applications.

## How It Works

### 1. Standard Usage (All Apps)

Every app uses the simple `createLogger` function:

```typescript
import { createLogger } from '@episensor/app-framework';

const logger = createLogger('ModuleName');

logger.info('Application started');
logger.error('An error occurred', { details: error });
logger.debug('Debug information');
```

### 2. Under the Hood

- `createLogger` returns a child logger from the singleton `EnhancedLogger` instance
- EnhancedLogger **auto-initializes** on first use with sensible defaults:
  - Console output: ✅ Enabled
  - File output: ✅ Enabled (to `./data/logs/`)
  - Log rotation: ✅ Automatic (daily files, 30-day retention)
  - Format: Timestamp, level, category, message, metadata

### 3. Desktop App Enhancement

Desktop apps (Tauri/Electron) can explicitly initialize EnhancedLogger for custom paths:

```typescript
import { getEnhancedLogger, isDesktopApp } from '@episensor/app-framework';

if (isDesktopApp()) {
  const enhancedLogger = getEnhancedLogger;
  if (!enhancedLogger.isInitialized()) {
    await enhancedLogger.initialize({
      appName: 'my-app',
      logLevel: process.env.LOG_LEVEL || 'info',
      consoleOutput: true,
      fileOutput: true,
      logsDir: getLogsPath() // Platform-specific app data directory
    });
  }
}
```

This ensures logs go to the appropriate platform-specific directories:
- macOS: `~/Library/Application Support/{appId}/logs/`
- Windows: `%APPDATA%/{appName}/logs/`
- Linux: `~/.local/share/{appName}/logs/`

### 4. Log Files

The system creates:
- Daily log files: `app-YYYY-MM-DD.log`
- Audit files: `.app-audit.json` and `.error-audit.json`
- Automatic rotation and cleanup of old files

## Current App Usage

All apps follow the same pattern:

1. **epi-cpcodebase**: Uses `createLogger` everywhere, with desktop enhancement for Tauri builds
2. **epi-modbus-simulator**: Standard `createLogger` usage
3. **epi-origami-simulator**: Standard `createLogger` usage
4. **epi-node-programmer**: Standard `createLogger` usage

## Key Points

- **No need to manually initialize** - EnhancedLogger auto-initializes with good defaults
- **File logging works in all modes** - Not just desktop apps
- **Consistent API** - All apps use the same `createLogger` function
- **Zero configuration** - Works out of the box
- **Desktop-aware** - Automatically uses platform directories when packaged

## Log Levels

The framework supports standard log levels:
- `error`: Error messages
- `warn`: Warning messages
- `info`: Informational messages (default)
- `debug`: Debug information
- `verbose`: Detailed operational information
- `http`: HTTP request logging
- `silly`: Very detailed debugging

Set via `LOG_LEVEL` environment variable or during initialization.

## Best Practices

1. **Always use `createLogger`** with a descriptive module name
2. **Don't manually initialize** unless you're in a desktop app with special requirements
3. **Use appropriate log levels** - info for normal operations, debug for development
4. **Include context** in log messages with metadata objects
5. **Don't log sensitive data** like passwords or API keys

## Migration Notes

If you see code like this in older apps:
```typescript
// OLD - Don't do this
const logger = winston.createLogger({...});

// NEW - Do this instead
const logger = createLogger('ModuleName');
```

The framework handles all the Winston configuration for you!
