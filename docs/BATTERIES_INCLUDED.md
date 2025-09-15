# Batteries-Included App Development

The EpiSensor App Framework provides a complete, opinionated solution for building internal applications with minimal boilerplate. This guide explains how to leverage the framework's built-in features to create production-ready apps quickly.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Settings Management](#settings-management)
3. [Logging System](#logging-system)
4. [Application Structure](#application-structure)
5. [Best Practices](#best-practices)

## Quick Start

Create a new app with all features pre-configured:

```bash
# Clone the template
git clone https://github.com/episensor/epi-app-template my-app
cd my-app

# Install dependencies
npm install

# Start development
npm run dev
```

Your app now includes:
- ✅ Full settings UI with persistence
- ✅ Advanced log viewer with filtering and export
- ✅ Authentication system
- ✅ WebSocket support
- ✅ Health checks
- ✅ Desktop app packaging
- ✅ Development server with hot reload

## Settings Management

### Define Your Settings Schema

Create a settings schema in `src/config/settings.ts`:

```typescript
import { createSettingsSchema, Validators } from '@episensor/app-framework';

export const appSettings = createSettingsSchema({
  version: '1.0.0',
  categories: [
    {
      id: 'general',
      label: 'General',
      icon: 'Settings',
      order: 1,
      settings: [
        {
          key: 'app.name',
          label: 'Application Name',
          type: 'string',
          defaultValue: 'My App',
          required: true,
          category: 'general',
          validation: {
            custom: Validators.required('Application name is required')
          }
        },
        {
          key: 'app.port',
          label: 'Server Port',
          type: 'number',
          defaultValue: 3000,
          category: 'general',
          validation: {
            min: 1024,
            max: 65535
          },
          requiresRestart: true,
          suffix: '(1024-65535)'
        }
      ]
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: 'Bell',
      order: 2,
      settings: [
        {
          key: 'notifications.email.enabled',
          label: 'Email Notifications',
          type: 'boolean',
          defaultValue: false,
          category: 'notifications'
        },
        {
          key: 'notifications.email.smtp.host',
          label: 'SMTP Host',
          type: 'string',
          category: 'notifications',
          showIf: (settings) => settings['notifications.email.enabled'],
          placeholder: 'smtp.gmail.com'
        },
        {
          key: 'notifications.email.smtp.port',
          label: 'SMTP Port',
          type: 'number',
          defaultValue: 587,
          category: 'notifications',
          showIf: (settings) => settings['notifications.email.enabled']
        },
        {
          key: 'notifications.email.from',
          label: 'From Address',
          type: 'email',
          category: 'notifications',
          showIf: (settings) => settings['notifications.email.enabled'],
          validation: {
            custom: Validators.email()
          }
        }
      ]
    }
  ],
  onSettingChange: async (key, value, oldValue) => {
    console.log(`Setting ${key} changed from ${oldValue} to ${value}`);
    // Handle setting changes (e.g., restart services)
  },
  onValidate: (settings) => {
    // Custom validation logic
    if (settings['notifications.email.enabled'] && !settings['notifications.email.smtp.host']) {
      return {
        'notifications.email.smtp.host': 'SMTP host is required when email is enabled'
      };
    }
    return null;
  }
});
```

### Add Settings Page to Your App

```tsx
import { Settings } from '@episensor/app-framework/ui';
import { appSettings } from '@/config/settings';

export function SettingsPage() {
  return (
    <Settings
      schema={appSettings}
      onError={(error) => console.error('Settings error:', error)}
    />
  );
}
```

### Available Setting Types

- `string` - Text input
- `password` - Password input with show/hide toggle
- `number` - Numeric input with min/max validation
- `boolean` - Toggle switch
- `select` - Dropdown selection
- `multiselect` - Multiple selection
- `json` - JSON editor
- `color` - Color picker
- `email` - Email input with validation
- `url` - URL input with validation
- `ipaddress` - IP address input
- `network-interface` - Network interface selector

### Setting Features

- **Validation**: Built-in and custom validators
- **Conditional Display**: Show/hide based on other settings
- **Restart Requirements**: Mark settings that need app restart
- **Transformations**: Transform values before storage/display
- **Subcategories**: Group related settings
- **Help Text**: Tooltips and descriptions
- **Read-only**: Display-only settings
- **Sensitive**: Password-style masking

## Logging System

### Define Log Categories

Create log configuration in `src/config/logging.ts`:

```typescript
import { LogViewerConfig } from '@episensor/app-framework';

export const logConfig: LogViewerConfig = {
  categories: [
    {
      id: 'api',
      label: 'API',
      description: 'HTTP requests and responses',
      enabled: true
    },
    {
      id: 'database',
      label: 'Database',
      description: 'Database queries and connections',
      enabled: true
    },
    {
      id: 'auth',
      label: 'Authentication',
      description: 'Login attempts and session management',
      enabled: true
    },
    {
      id: 'service',
      label: 'Services',
      description: 'Background service operations',
      enabled: true
    }
  ],
  defaultLevel: 'info',
  maxLogEntries: 2000,
  enableRealtime: true,
  enableExport: true,
  enableArchives: true,
  archiveRetentionDays: 7,
  horizontalScroll: true,
  timestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
  showCategories: true,
  showMetadata: true
};
```

### Add Log Viewer to Your App

```tsx
import { LogViewer } from '@episensor/app-framework/ui';
import { logConfig } from '@/config/logging';

export function LogsPage() {
  return (
    <LogViewer
      config={logConfig}
      onError={(error) => console.error('Log viewer error:', error)}
    />
  );
}
```

### Use Structured Logging

```typescript
import { createLogger } from '@episensor/app-framework';

// Create a logger with a category
const logger = createLogger('api');

// Log with different levels
logger.info('User logged in', { userId: 123, ip: '192.168.1.1' });
logger.warn('Rate limit approaching', { requests: 95, limit: 100 });
logger.error('Database connection failed', { error: err.message });
logger.debug('Cache miss', { key: 'user:123' });

// All logs automatically include:
// - Timestamp
// - Level
// - Category
// - Structured metadata
// - Stack traces for errors
```

### Log Features

- **Real-time Updates**: WebSocket streaming of new logs
- **Filtering**: By level, category, date range, search text
- **Export**: Download logs as text files
- **Archives**: Browse and download historical logs
- **Horizontal Scrolling**: View long log entries
- **Copy to Clipboard**: Select and copy logs
- **Performance**: Smart throttling for high-volume logs

## Application Structure

### Recommended Project Structure

```
my-app/
├── src/
│   ├── index.ts           # Main entry point
│   ├── config/
│   │   ├── settings.ts    # Settings schema
│   │   ├── logging.ts     # Log categories
│   │   └── app.json       # Default configuration
│   ├── api/
│   │   ├── routes.ts      # API routes
│   │   └── middleware.ts  # Custom middleware
│   ├── services/
│   │   └── myService.ts   # Business logic
│   └── utils/
│       └── helpers.ts     # Utility functions
├── web/
│   ├── src/
│   │   ├── App.tsx        # React app root
│   │   ├── pages/         # Page components
│   │   └── components/    # Reusable components
│   └── index.html
├── data/                  # Runtime data (gitignored)
│   ├── config/           # User settings
│   ├── logs/             # Log files
│   └── uploads/          # User uploads
└── package.json
```

### Main Entry Point

```typescript
// src/index.ts
import { 
  StandardServer, 
  createLogger,
  getLogger 
} from '@episensor/app-framework';
import { appSettings } from './config/settings';
import { logConfig } from './config/logging';

const logger = createLogger('Main');

async function main() {
  // Initialize enhanced logging
  await getLogger().initialize({
    logLevel: 'debug',
    consoleOutput: false,
    fileOutput: true,
    logsDir: './data/logs'
  });

  // Create server with batteries included
  const server = new StandardServer({
    name: 'My App',
    version: '1.0.0',
    port: 3000,
    cors: {
      origins: ['http://localhost:3001']
    },
    staticPaths: [
      { path: '/app', directory: './web/dist' }
    ],
    onStart: async () => {
      logger.info('Application started successfully');
      // Initialize your services here
    }
  });

  // Add your API routes
  server.app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from My App!' });
  });

  // Start the server
  await server.start();
}

main().catch(error => {
  console.error('Failed to start:', error);
  process.exit(1);
});
```

## Best Practices

### 1. Use the Framework's Patterns

```typescript
// ✅ Good - Use framework utilities
import { sendSuccess, sendError, asyncHandler } from '@episensor/app-framework';

app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await getUsers();
  sendSuccess(res, users);
}));

// ❌ Bad - Custom implementations
app.get('/api/users', async (req, res) => {
  try {
    const users = await getUsers();
    res.json({ data: users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Leverage Built-in Middleware

```typescript
import { 
  validateRequest, 
  authenticate, 
  rateLimit 
} from '@episensor/app-framework';

// Authentication
app.use('/api/protected', authenticate());

// Validation
app.post('/api/users', 
  validateRequest({
    body: z.object({
      email: z.string().email(),
      name: z.string().min(1)
    })
  }),
  createUser
);

// Rate limiting
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
```

### 3. Structure Your Services

```typescript
// services/userService.ts
import { createLogger } from '@episensor/app-framework';

export class UserService {
  private logger = createLogger('UserService');
  
  async createUser(data: CreateUserDto) {
    this.logger.info('Creating user', { email: data.email });
    
    try {
      const user = await db.user.create(data);
      this.logger.info('User created successfully', { userId: user.id });
      return user;
    } catch (error) {
      this.logger.error('Failed to create user', { error });
      throw error;
    }
  }
}
```

### 4. Handle Configuration Properly

```typescript
import { ConfigManager } from '@episensor/app-framework';

// Get configuration
const config = ConfigManager.getInstance();
const smtpHost = config.get('notifications.email.smtp.host');

// Watch for changes
config.on('change', ({ key, value, oldValue }) => {
  if (key === 'notifications.email.enabled') {
    if (value) {
      startEmailService();
    } else {
      stopEmailService();
    }
  }
});
```

### 5. Use TypeScript for Everything

```typescript
// Define your types
interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

// Use throughout your app
async function getUser(id: number): Promise<User> {
  const user = await db.user.findById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}
```

## Summary

The EpiSensor App Framework provides everything you need out of the box:

1. **Settings Management**: Define a schema, get a full UI
2. **Logging System**: Define categories, get viewer with all features
3. **Authentication**: Built-in session management
4. **API Utilities**: Standardized responses and error handling
5. **WebSocket Support**: Real-time communication
6. **Health Checks**: Monitor your app and dependencies
7. **Desktop Packaging**: Build Tauri apps easily
8. **Development Tools**: Hot reload, TypeScript, testing

Focus on your business logic - the framework handles the rest!
