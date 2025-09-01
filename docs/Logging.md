# Logging System

The framework provides a unified, production-ready logging system with automatic file output, daily rotation, and structured logging using Winston.

## Features

- **Automatic File Output**: Logs are automatically written to `data/logs/`
- **Daily Rotation**: Log files rotate daily with configurable retention
- **Dual Output**: Console and file logging work simultaneously
- **Structured Logging**: JSON format for easy parsing and analysis
- **Error Separation**: Separate error log files for quick debugging
- **Compression**: Old logs are automatically compressed
- **No Configuration Required**: Works out of the box with sensible defaults

## Basic Usage

```typescript
import { createLogger } from '@episensor/app-framework';

const logger = createLogger('MyModule');

// Use the logger
logger.info('Application started');
logger.error('An error occurred', { errorCode: 500 });
logger.warn('Warning message');
logger.debug('Debug information');
```

## Log Levels

The logger supports standard log levels:
- `error` - Error messages
- `warn` - Warning messages  
- `info` - Informational messages
- `debug` - Debug messages
- `verbose` - Detailed debug messages
- `silly` - Very detailed debug messages

## File Structure

Logs are written to `data/logs/` with a flat structure:
```
data/logs/
├── app-2025-01-20.log      # Main application log
├── error-2025-01-20.log    # Error-only log
├── app-2025-01-19.log.gz   # Compressed old logs
└── error-2025-01-19.log.gz
```

## Configuration

The logger initializes automatically with these defaults:
- **Log Level**: `info` (or from `LOG_LEVEL` env var)
- **Console Output**: Enabled with colors
- **File Output**: Enabled to `data/logs/`
- **Max Files**: 7 days retention
- **Max Size**: 20MB per file
- **Compression**: Enabled for old files

## Environment Variables

- `LOG_LEVEL` - Set the minimum log level (debug, info, warn, error)
- `NODE_ENV` - Production mode defaults to `warn` level

## API Endpoints for Logs

The framework automatically provides log management endpoints:

### List Log Files
```http
GET /api/logs
```
Returns a list of available log files with metadata.

### Download Log File
```http
GET /api/logs/:filename
```
Downloads a specific log file.

### View Recent Logs
```http
GET /api/logs/recent/:lines
```
Returns the last N lines from today's log file.

## Best Practices

1. **Use Descriptive Module Names**: 
   ```typescript
   const logger = createLogger('AuthService');
   ```

2. **Include Context in Logs**:
   ```typescript
   logger.info('User logged in', { userId: user.id, ip: req.ip });
   ```

3. **Use Appropriate Log Levels**:
   - `error` - For errors that need immediate attention
   - `warn` - For recoverable issues or deprecations
   - `info` - For important business events
   - `debug` - For development and troubleshooting

4. **Avoid Logging Sensitive Data**:
   ```typescript
   // Bad
   logger.info('Login attempt', { password: req.body.password });
   
   // Good
   logger.info('Login attempt', { username: req.body.username });
   ```

## Advanced Usage

### Custom Logger Instance

For specialized logging needs:

```typescript
import { getEnhancedLogger } from '@episensor/app-framework';

const enhancedLogger = getEnhancedLogger();
const customLogger = enhancedLogger.createLogger('CustomModule', {
  level: 'debug',
  console: true,
  file: true
});
```

### Structured Logging

The logger automatically structures your logs for easy parsing:

```typescript
logger.info('API request', {
  method: req.method,
  path: req.path,
  duration: responseTime,
  statusCode: res.statusCode
});
```

## Migration from Old Logger

If migrating from the old basic logger:
1. No code changes needed - `createLogger()` works the same
2. Logs now automatically write to files
3. Check `data/logs/` for your log files
4. Use the API endpoints to view/download logs

## Troubleshooting

### Logs Not Writing
- Check `data/logs/` directory permissions
- Ensure the application has write access
- Check disk space

### Missing Log Output
- Verify `LOG_LEVEL` environment variable
- Check if running in production mode (defaults to `warn`)
- Ensure logger is created after framework initialization

### Performance Considerations
- Logs are written asynchronously
- File rotation happens automatically at midnight
- Compression runs in background for old files