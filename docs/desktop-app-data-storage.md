# Desktop App Data Storage

## Overview

When EpiSensor applications run as desktop apps (using Tauri or Electron), they store user data in platform-specific directories to ensure proper data persistence and compatibility with operating system conventions.

## Data Storage Locations

### macOS
- **Location**: `~/Library/Application Support/{appId}`
- **Example**: `~/Library/Application Support/com.episensor.codebase-manager`
- **Contents**: Projects, prompts, logs, configuration files

### Windows
- **Location**: `%APPDATA%/{appName}`
- **Example**: `C:\Users\{username}\AppData\Roaming\codebase-manager`
- **Contents**: Projects, prompts, logs, configuration files

### Linux
- **Location**: `~/.local/share/{appName}`
- **Example**: `/home/{username}/.local/share/codebase-manager`
- **Contents**: Projects, prompts, logs, configuration files

## Directory Structure

Each application's data directory contains:

```
{app-data-directory}/
├── projects.json       # Project configurations
├── prompts.json        # Saved AI prompts
├── config/            # Application settings
│   └── settings.json
├── logs/              # Application logs
│   ├── app-2024-01-01.log
│   └── app-2024-01-02.log
└── cache/             # Temporary cached data
```

## Development vs Production

### Development Mode
- Data is stored in `./data` within the project directory
- Allows easy access and debugging during development
- Data is not persistent across different development environments

### Production Mode (Desktop App)
- Data is stored in the platform-specific directories listed above
- Ensures data persistence across app updates
- Follows OS conventions for application data storage

## Using the AppPaths Utility

The framework provides utility functions to handle platform-specific paths automatically:

```typescript
import { 
  getAppDataPath, 
  getDataFilePath, 
  getLogsPath, 
  getConfigPath,
  isDesktopApp 
} from '@episensor/app-framework';

// Get the main app data directory
const dataDir = getAppDataPath('com.episensor.my-app', 'my-app');

// Get path for a specific data file
const projectsFile = getDataFilePath('projects.json', 'com.episensor.my-app', 'my-app');

// Get logs directory
const logsDir = getLogsPath('com.episensor.my-app', 'my-app');

// Check if running as desktop app
if (isDesktopApp()) {
  console.log('Running as desktop application');
}
```

## Important Considerations

### App Identifiers
- Use consistent app identifiers across platforms
- Format: `com.episensor.{app-name}` for macOS
- Use simple app name for Windows/Linux directories

### Data Migration
- When updating from web to desktop versions, users may need to manually migrate their data
- Consider implementing an import/export feature for easy data transfer

### Permissions
- The app automatically creates directories if they don't exist
- Ensure the app has write permissions to the data directories
- On macOS, the app may need to request permission for certain operations

### Backup and Sync
- Users should be aware of data location for backup purposes
- Consider implementing cloud sync or export features for data portability

## Bundling Requirements

For desktop apps to work correctly, both backend and frontend must be bundled:

### Backend Bundling
- Node.js server code must be compiled and included
- Use `npm run build:server` to compile TypeScript
- Server runs on a fixed port (e.g., 3005) when launched by Tauri

### Frontend Bundling  
- Web UI must be built for production
- Use `npm run build:frontend` to create optimized bundle
- Static files served from `dist/web` directory

### Tauri Configuration
Ensure `tauri.conf.json` includes:
- `beforeBuildCommand`: Builds both backend and frontend
- `frontendDist`: Points to built web assets
- Environment variable `TAURI=1` passed to backend

## Testing Data Storage

To verify data is being stored correctly:

1. **macOS**: Check `~/Library/Application Support/`
2. **Windows**: Check `%APPDATA%` in File Explorer
3. **Linux**: Check `~/.local/share/`

Look for your app's directory and verify files are being created and updated.

## Troubleshooting

### Data Not Persisting
- Verify the app is running in production mode (TAURI=1 environment variable)
- Check directory permissions
- Ensure app identifier matches tauri.conf.json

### Wrong Directory Used
- Verify app identifier and name are consistent
- Check environment variables
- Ensure framework version includes appPaths utility

### Migration Issues
- Provide clear instructions for users to locate old data
- Implement import/export functionality
- Consider automatic migration on first launch