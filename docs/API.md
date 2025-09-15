# Complete API Reference

## Table of Contents

1. [Best Practices](#best-practices)
2. [Core Components](#core-components)
3. [Services](#services)
4. [Middleware](#middleware)
5. [Utilities](#utilities)
6. [UI Components](#ui-components)
7. [Testing Utilities](#testing-utilities)

---

## Best Practices

### Essential Framework Usage Guidelines

**🚨 IMPORTANT: Always use framework utilities - don't re-implement them!**

#### Frontend API Communications
**✅ DO**: Use `apiRequest` for ALL frontend API calls
```typescript
import { apiRequest } from '@episensor/app-framework/ui';

// Correct - includes error handling, loading states, and API readiness checks
const response = await apiRequest('/api/devices', {
  method: 'POST',
  body: { name: 'Device 1' }
});
```

**❌ DON'T**: Use native fetch or axios
```typescript
// Wrong - bypasses framework error handling and readiness checks
const response = await fetch('/api/devices', {
  method: 'POST',
  body: JSON.stringify({ name: 'Device 1' }),
  headers: { 'Content-Type': 'application/json' }
});
```

#### WebSocket Communication
**✅ DO**: Use the `useSocketIO` hook for WebSocket connections
```typescript
import { useSocketIO } from '@episensor/app-framework/ui';

const { socket, connected } = useSocketIO();

useEffect(() => {
  if (!socket) return;
  
  socket.on('dataUpdate', handleUpdate);
  return () => socket.off('dataUpdate', handleUpdate);
}, [socket]);
```

Or use the generic `useWebSocket` hook for custom Socket.IO contexts:
```typescript
import { useWebSocket } from '@episensor/app-framework/ui';

const { socket, connected, on, off, emit } = useWebSocket(SocketContext);

// Simplified event handling
useEffect(() => {
  on('message', handleMessage);
  return () => off('message', handleMessage);
}, [on, off]);
```

#### File Operations
**✅ DO**: Use `SecureFileHandler` for all file operations
```typescript
import { getSecureFileHandler } from '@episensor/app-framework/core';

const fileHandler = getSecureFileHandler();
await fileHandler.saveFile('config.json', data, 'data');
```

#### Validation
**✅ DO**: Use the framework's validation middleware with Zod
```typescript
import { validate } from '@episensor/app-framework/middleware';
import { z } from 'zod';

const deviceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['sensor', 'actuator'])
});

router.post('/devices', validate(deviceSchema), handler);
```

#### State Management Pattern
**✅ DO**: Combine Zustand with `apiRequest` for consistent state management
```typescript
import { create } from 'zustand';
import { apiRequest } from '@episensor/app-framework/ui';

const useDeviceStore = create((set) => ({
  devices: [],
  loading: false,
  
  fetchDevices: async () => {
    set({ loading: true });
    try {
      const response = await apiRequest('/api/devices');
      set({ devices: response.data, loading: false });
    } catch (error) {
      set({ loading: false });
      // Error is already handled by apiRequest
    }
  }
}));
```

---

## Core Components

### StandardServer

Simplified server implementation for all EpiSensor applications.

```typescript
import { StandardServer, createStandardServer } from '@episensor/app-framework';
```

#### Constructor

```typescript
new StandardServer(config: StandardServerConfig)
```

#### Configuration

```typescript
interface StandardServerConfig {
  appName: string;          // Application name
  appVersion: string;       // Application version
  description?: string;     // Optional description
  port?: number;           // API port (default: 8080)
  webPort?: number;        // Optional separate web UI port
  host?: string;           // Host (default: 'localhost')
  environment?: string;    // Environment (default: NODE_ENV || 'development')
  enableWebSocket?: boolean; // Enable WebSocket (default: true)
  onInitialize?: (app: Express) => Promise<void>; // Setup hook
  onStart?: () => Promise<void>;                  // Start hook
}
```

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `initialize()` | Initialize server and middleware | `Promise<void>` |
| `start()` | Start listening on configured port | `Promise<void>` |
| `stop()` | Gracefully stop the server | `Promise<void>` |
| `getApp()` | Get Express app instance | `Express` |
| `getServer()` | Get HTTP/HTTPS server instance | `Server` |

#### Example

```typescript
const server = new StandardServer({
  appName: 'My API',
  appVersion: '1.0.0',
  port: 8080,
  onInitialize: async (app) => {
    app.use(express.json());
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
  }
});

await server.initialize();
await server.start();
```

---

### Enhanced Logger

Production-grade logging with file rotation and compression.

```typescript
import { getLogger } from '@episensor/app-framework';
```

#### Initialization

```typescript
initializeLogger(config?: {
  logDir?: string;           // Log directory (default: './logs')
  maxFiles?: string;         // Max files to keep (default: '14d')
  maxSize?: string;          // Max file size (default: '20m')
  level?: string;            // Log level (default: 'info')
  enableConsole?: boolean;   // Console output (default: true)
  enableFile?: boolean;      // File output (default: true)
})
```

#### Creating Loggers

```typescript
const logger = getLogger().createLogger('MyService');
logger.info('Service started');
logger.error('Error occurred', { error: err });
logger.debug('Debug info', { data });
```

#### Log Management

```typescript
// Get log statistics
const stats = getLogger().getLogStats();

// Archive old logs
await getLogger().archiveLogs();

// Clean up archives older than 30 days
await getLogger().cleanupArchives(30);

// Read log file
const logs = await getLogger().readLogFile('api.log', {
  tail: 100,  // Last 100 lines
  date: '2024-01-15' // Specific date
});
```

---

### Basic Logger

Simple console logger with colours and levels.

```typescript
import { createLogger, Logger } from '@episensor/app-framework';
```

#### Creating Loggers

```typescript
const logger = createLogger('ServiceName', {
  level: 'debug',      // 'debug' | 'info' | 'warn' | 'error'
  timestamp: true,     // Include timestamps
  colours: true        // Use colours
});
```

#### Methods

```typescript
logger.debug('Debug message', data);
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', error);
logger.setLogLevel('warn');
const level = logger.getLogLevel();
```

#### Pre-configured Loggers

```typescript
import { loggers } from '@episensor/app-framework';

loggers.system.info('System message');
loggers.api.info('API request');
loggers.websocket.debug('WebSocket event');
loggers.startup.info('Starting up');
```

---

### Port Utilities

Port management and conflict resolution.

```typescript
import { 
  clearPort, 
  isPortAvailable, 
  getProcessOnPort,
  findAvailablePort,
  checkRequiredPorts,
  waitForPort
} from '@episensor/app-framework';
```

#### Functions

```typescript
// Check if port is available
const available = await isPortAvailable(3000);

// Get process using port
const process = await getProcessOnPort(3000);
// Returns: { pid: number, command: string } | null

// Clear a port (kill process)
const result = await clearPort(3000);
// Returns: { cleared: boolean, error?: string }

// Find available port in range
const port = await findAvailablePort(3000, 3100);

// Check multiple ports
const status = await checkRequiredPorts([3000, 8080, 5432]);
// Returns: Map<number, PortStatus>

// Wait for port to become available
const available = await waitForPort(3000, { timeout: 5000 });
```

---

### Secure File Handler

Safe file operations with validation and organization.

```typescript
import { getSecureFileHandler } from '@episensor/app-framework';

const fileHandler = getSecureFileHandler();
```

#### Methods

```typescript
// Initialize (automatic on first use)
await fileHandler.initialize();

// Save file
const result = await fileHandler.saveFile(
  'uploads/document.pdf',
  buffer,
  {
    overwrite: false,
    backup: true,
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf']
  }
);

// Read file
const content = await fileHandler.readFile('uploads/document.pdf', {
  encoding: 'utf8',
  maxSize: 5 * 1024 * 1024
});

// List files
const files = await fileHandler.listFiles('uploads', {
  pattern: '*.pdf',
  recursive: true
});

// Delete file
const deleted = await fileHandler.deleteFile('uploads/document.pdf');

// Get file info
const info = await fileHandler.getFileInfo('uploads/document.pdf');
// Returns: { size, mtime, isDirectory, exists }

// Sanitize filename
const safe = fileHandler.sanitizeFilename('../../../etc/passwd');
// Returns: 'etc_passwd'
```

---

## Services

### WebSocket Server

Real-time bidirectional communication. See [WebSocket Guide](./WEBSOCKET.md) for complete documentation.

```typescript
import { createWebSocketServer, getWebSocketServer } from '@episensor/app-framework';
```

#### Quick Reference

```typescript
// Get server instance
const ws = getWebSocketServer();

// Broadcast to all
ws.broadcast('event', data);

// Broadcast to simulator subscribers
ws.broadcastSimulatorUpdate('sim-123', data);

// Get statistics
const stats = ws.getStats();

// Get connected clients
const clients = ws.getClients();
```

---

### Configuration Manager

Advanced configuration with validation and hot-reloading.

```typescript
import { ConfigManager } from '@episensor/app-framework';
```

#### Setup

```typescript
const config = new ConfigManager({
  configPath: './config',
  envPrefix: 'APP_',
  watch: true,
  schema: configSchema // Zod schema
});

await config.load();
```

#### Methods

```typescript
// Get value
const port = config.get('server.port', 8080);

// Set value
config.set('server.port', 3000);

// Merge configuration
config.merge({ server: { host: 'localhost' } });

// Watch for changes
config.watch((newConfig) => {
  console.log('Config updated:', newConfig);
});

// Validate
const valid = config.validate();

// Get all config
const all = config.getAll();

// Environment mapping
config.mapEnvironment({
  'APP_PORT': 'server.port',
  'APP_DB_HOST': 'database.host'
});
```

---

### Settings Service

Application settings with UI generation.

```typescript
import { SettingsService } from '@episensor/app-framework';
```

#### Setup

```typescript
const settings = new SettingsService({
  storage: 'file', // or 'database'
  path: './data/settings.json'
});

// Register categories
settings.registerCategory({
  id: 'general',
  label: 'General Settings',
  icon: 'settings',
  order: 1,
  settings: [
    {
      key: 'app.name',
      label: 'Application Name',
      type: 'string',
      defaultValue: 'My App',
      validation: (v) => v.length > 0 || 'Required',
      requiresRestart: true
    },
    {
      key: 'app.theme',
      label: 'Theme',
      type: 'select',
      options: ['light', 'dark', 'auto'],
      defaultValue: 'auto'
    }
  ]
});
```

#### Methods

```typescript
// Get setting
const theme = settings.get('app.theme', 'auto');

// Set setting
await settings.set('app.theme', 'dark');

// Get by category
const general = settings.getByCategory('general');

// Get all settings
const all = settings.getAll();

// Get UI schema (for frontend)
const schema = settings.getUISchema();

// Validate all
const errors = settings.validateAll();
```

---

### Queue Service

Background job processing with persistence.

```typescript
import { QueueService } from '@episensor/app-framework';
```

#### Setup

```typescript
const queue = new QueueService({
  concurrent: 5,
  retries: 3,
  retryDelay: 1000,
  persistent: true,
  dbPath: './data/queue.db'
});

// Register job handlers
queue.registerHandler('email', async (job) => {
  await sendEmail(job.data);
});

queue.registerHandler('process-data', async (job) => {
  await processData(job.data);
});

await queue.start();
```

#### Adding Jobs

```typescript
// Add job
const jobId = await queue.addJob('email', {
  to: 'user@example.com',
  subject: 'Hello',
  body: 'Content'
}, {
  priority: 'high',
  delay: 5000, // Start after 5 seconds
  retries: 5
});

// Add bulk jobs
await queue.addBulk([
  { type: 'email', data: {...} },
  { type: 'process-data', data: {...} }
]);
```

#### Management

```typescript
// Get statistics
const stats = queue.getStats();
// { pending, active, completed, failed }

// Get job status
const job = await queue.getJob(jobId);

// Cancel job
await queue.cancelJob(jobId);

// Clear completed jobs
await queue.clearCompleted();

// Graceful shutdown
await queue.stop();
```

---

### AI Service

Multi-provider AI integration with caching.

```typescript
import { AIService } from '@episensor/app-framework';
```

#### Setup

```typescript
const ai = new AIService({
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4'
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      model: 'claude-3-opus'
    }
  },
  defaultProvider: 'openai',
  cache: true,
  cacheTTL: 3600
});
```

#### Methods

```typescript
// Analyze text
const analysis = await ai.analyze('Analyze this text...', {
  provider: 'claude',
  temperature: 0.7
});

// Chat conversation
const response = await ai.chat([
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
  { role: 'user', content: 'How are you?' }
]);

// Select best model for task
const model = ai.selectModel('translation');

// Get usage statistics
const usage = ai.getUsage();
// { tokens, cost, requests }
```

---

## Middleware

### Authentication

Session-based authentication with roles.

```typescript
import { 
  createAuthMiddleware, 
  createLoginHandler,
  createLogoutHandler,
  requireRole 
} from '@episensor/app-framework';
```

#### Setup

```typescript
// Create auth middleware
const auth = createAuthMiddleware({
  sessionSecret: process.env.SESSION_SECRET,
  loginPath: '/login',
  defaultRedirect: '/dashboard'
});

// Apply to app
app.use(auth);

// Login endpoint
app.post('/api/login', createLoginHandler({
  validateUser: async (username, password) => {
    // Validate and return user object
    return user;
  },
  onSuccess: (req, res, user) => {
    res.json({ success: true, user });
  }
}));

// Logout endpoint
app.post('/api/logout', createLogoutHandler());

// Protected routes
app.get('/admin', requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin only' });
});
```

---

### Validation

Request validation using Zod schemas with full TypeScript type inference.

```typescript
import { validate, validateParams, validateQuery, schemas } from '@episensor/app-framework';
import { z } from 'zod';
```

#### Body Validation

```typescript
app.post('/api/users', 
  validate(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().int().positive()
  })),
  (req, res) => {
    // req.body is validated
  }
);
```

#### Params Validation

```typescript
app.get('/api/users/:id',
  validateParams(z.object({
    id: z.string().uuid()
  })),
  (req, res) => {
    // req.params.id is a valid UUID
  }
);
```

#### Query Validation

```typescript
app.get('/api/search',
  validateQuery(z.object({
    q: z.string(),
    page: z.number().int().default(1),
    limit: z.number().int().max(100).default(10)
  })),
  (req, res) => {
    // req.query is validated with defaults
  }
);
```

#### Pre-defined Schemas

```typescript
// Common schemas
schemas.id           // UUID string
schemas.email        // Valid email
schemas.url          // Valid URL
schemas.pagination   // { page, limit, sort, order }
schemas.dateRange    // { from, to }
schemas.coordinates  // { lat, lng }
```

---

### Session

Express session configuration with Redis support.

```typescript
import { configureSession, createRedisStore, sessionUtils } from '@episensor/app-framework';
```

#### Setup

```typescript
// Basic session
app.use(configureSession({
  secret: process.env.SESSION_SECRET,
  name: 'app.sid',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  secure: process.env.NODE_ENV === 'production'
}));

// With Redis
app.use(configureSession({
  secret: process.env.SESSION_SECRET,
  store: await createRedisStore({
    host: 'localhost',
    port: 6379,
    ttl: 86400
  })
}));
```

#### Session Utilities

```typescript
// Check if user is authenticated
if (sessionUtils.isAuthenticated(req)) {
  // User is logged in
}

// Get user from session
const user = sessionUtils.getUser(req);

// Set user in session
sessionUtils.setUser(req, user);

// Destroy session
await sessionUtils.destroy(req);

// Regenerate session ID
await sessionUtils.regenerate(req);
```

---

### Health Check

Kubernetes-compatible health endpoints.

```typescript
import { createHealthCheck, healthCheck } from '@episensor/app-framework';
```

#### Setup

```typescript
// Simple health check
app.get('/health', healthCheck());

// Advanced health check
const health = createHealthCheck({
  checks: {
    database: async () => {
      await db.ping();
      return { status: 'healthy' };
    },
    redis: async () => {
      await redis.ping();
      return { status: 'healthy' };
    }
  },
  timeout: 5000
});

app.get('/health', health);
app.get('/health/live', health.liveness);
app.get('/health/ready', health.readiness);
```

---

### File Upload

Secure file upload handling.

```typescript
import { createFileUpload, parseFormData, sendFile } from '@episensor/app-framework';
```

#### Setup

```typescript
const upload = createFileUpload({
  dest: './uploads',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  sanitizeFilename: true
});

// Single file
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ file: req.file });
});

// Multiple files
app.post('/upload-multiple', upload.array('files', 10), (req, res) => {
  res.json({ files: req.files });
});

// Parse form data
app.post('/form', parseFormData(), (req, res) => {
  // req.body contains form fields
  // req.files contains uploaded files
});

// Serve files
app.get('/files/:id', (req, res) => {
  sendFile(res, `./uploads/${req.params.id}`, {
    maxAge: 86400,
    download: req.query.download === 'true'
  });
});
```

---

### OpenAPI Documentation

Automatic API documentation generation.

```typescript
import { setupOpenAPIDocumentation, ApiOperation } from '@episensor/app-framework';
```

#### Setup

```typescript
setupOpenAPIDocumentation(app, {
  title: 'My API',
  version: '1.0.0',
  description: 'API Documentation',
  servers: [
    { url: 'http://localhost:8080', description: 'Development' },
    { url: 'https://api.example.com', description: 'Production' }
  ]
});

// Swagger UI available at /api-docs
```

#### Documenting Endpoints

```typescript
@ApiOperation({
  summary: 'Create user',
  tags: ['Users'],
  requestBody: {
    content: {
      'application/json': {
        schema: userSchema
      }
    }
  },
  responses: {
    201: { description: 'User created' },
    400: { description: 'Invalid input' }
  }
})
app.post('/api/users', (req, res) => {
  // Implementation
});
```

---

## Utilities

### API Response Helpers

Standardized API responses.

```typescript
import { 
  successResponse, 
  errorResponse,
  paginatedResponse,
  ApiResponse 
} from '@episensor/app-framework';
```

#### Usage

```typescript
// Success response
res.json(successResponse(data, 'Operation successful'));

// Error response
res.status(400).json(errorResponse('Invalid input', 400, {
  field: 'email',
  message: 'Invalid email format'
}));

// Paginated response
res.json(paginatedResponse(items, {
  page: 1,
  limit: 10,
  total: 100
}));
```

---

### Startup Banner

Application startup display.

```typescript
import { displayStartupBanner } from '@episensor/app-framework';
```

#### Usage

```typescript
displayStartupBanner({
  appName: 'My Application',
  appVersion: '1.0.0',
  description: 'Enterprise Application',
  port: 8080,
  webPort: 3000,
  environment: 'production',
  startTime: Date.now(),
  additionalInfo: [
    { label: 'Database', value: 'Connected' },
    { label: 'Cache', value: 'Redis' }
  ]
});
```

---

## UI Components

### Log Components

#### LogViewer
A comprehensive log viewer component with real-time updates, filtering, and file management.

```typescript
import { LogViewer } from '@episensor/app-framework/ui';

<LogViewer
  apiUrl="/api/logs"
  enableFileList={true}
  enableSearch={true}
  enableFilter={true}
  enableExport={true}
  enableAutoScroll={true}
  enablePause={true}
  enableRawView={true}
  height={500}
/>
```

**Props:**
- `apiUrl` - API endpoint for fetching logs
- `logs` - Array of log entries (alternative to apiUrl)
- `enableFileList` - Show log files sidebar
- `enableSearch` - Enable search functionality
- `enableFilter` - Enable level filtering
- `enableExport` - Enable log export
- `enableAutoScroll` - Auto-scroll to latest logs
- `enablePause` - Enable pause/resume
- `enableRawView` - Toggle between formatted and raw JSON view
- `pollInterval` - Update interval in milliseconds (default: 2000)
- `maxEntries` - Maximum number of entries to display (default: 1000)

#### LogsPage
A complete logs page with header and configured LogViewer.

```typescript
import { LogsPage } from '@episensor/app-framework/ui';

<LogsPage
  apiUrl="/api/logs"
  title="System Logs"
  description="Monitor application events"
/>
```

### React Hooks

#### useDebounce

Debounces a value with a specified delay. Useful for search inputs, API calls, and other scenarios where you want to delay execution.

```typescript
import { useDebounce } from '@episensor/app-framework/ui';

const SearchComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  
  useEffect(() => {
    if (debouncedSearchTerm) {
      // Perform search with debounced value
      performSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm]);
  
  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  );
};
```

#### useWebSocket

```typescript
const {
  connected,
  socket,
  subscribe,
  unsubscribe,
  emit,
  on,
  off
} = useWebSocket('http://localhost:8080', {
  reconnection: true,
  reconnectionDelay: 1000
});
```

#### useWebSocketSubscription

```typescript
const { data, loading, error } = useWebSocketSubscription(
  'entity-type',
  'entity-id',
  {
    initialData: {},
    transform: (data) => transformData(data)
  }
);
```

---

### Theme System

Centralised theme configuration for EpiSensor applications:

```typescript
import { theme, getCSSVariables } from '@episensor/app-framework/ui';

// Access theme values
const primaryColor = theme.colors.primary.DEFAULT; // #E21350
const darkBg = theme.colors.dark.bg.primary; // #0a0a0a

// Get CSS variables for theme switching
const cssVars = getCSSVariables(isDark);
// Returns { '--color-bg-primary': '#0a0a0a', ... }
```

### Icons Library

Standardised icon library using Lucide React:

```typescript
import {
  LayoutDashboard,
  Settings,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  // ... 100+ icons available
  type LucideIcon
} from '@episensor/app-framework/ui';

// Use in components
<Settings className="h-4 w-4" />
```

### Style Constants

Reusable Tailwind class combinations for consistency:

```typescript
import {
  cardStyles,
  buttonStyles,
  emptyStateStyles,
  activityStyles,
  statusStyles
} from '@episensor/app-framework/ui';

// Apply consistent styles
<div className={cardStyles.interactive}>
  Interactive card with hover effects
</div>

<div className={emptyStateStyles.container}>
  <FolderOpen className={emptyStateStyles.icon} />
  <h3 className={emptyStateStyles.title}>No data</h3>
</div>
```

### Base Components

Complete set of UI components:

```typescript
import {
  Alert,
  Button,
  Card,
  Dialog,
  Input,
  Select,
  Table,
  Tabs,
  // ... and many more
} from '@episensor/app-framework/ui';
```

---

### Specialized Components

#### SettingsFramework

```tsx
<SettingsFramework
  categories={settingsCategories}
  values={currentValues}
  onChange={handleChange}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

#### LogViewer

```tsx
<LogViewer
  apiUrl="/api/logs"
  logFile="application.log"
  tail={100}
  autoRefresh={true}
  refreshInterval={5000}
/>
```

#### ConnectionStatus

```tsx
<ConnectionStatus
  url="http://localhost:8080"
  showDetails={true}
  onReconnect={handleReconnect}
/>
```

---

## Testing Utilities

### Test Server

Standardized test server for integration tests.

```typescript
import { 
  TestServer, 
  createTestServer,
  setupTestServer,
  teardownTestServer 
} from '@episensor/app-framework';
```

#### Setup

```typescript
// In test file
let testServer: TestServer;

beforeAll(async () => {
  testServer = await setupTestServer({
    port: 0, // Random port
    setupApp: (app) => {
      // Configure test routes
      app.get('/test', (req, res) => res.json({ ok: true }));
    }
  });
});

afterAll(async () => {
  await teardownTestServer(testServer);
});

test('API endpoint', async () => {
  const response = await testServer.request('/test');
  expect(response.body.ok).toBe(true);
});
```

#### Methods

```typescript
// Make requests
const res = await testServer.request('/api/users')
  .post()
  .send({ name: 'Test' })
  .expect(201);

// Get port
const port = testServer.getPort();

// Get app instance
const app = testServer.getApp();

// WebSocket testing
const socket = await testServer.connectWebSocket();
socket.emit('test', data);
```

---

## Error Handling

### Custom Error Classes

```typescript
import { 
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError 
} from '@episensor/app-framework';

// Throw errors
throw new ValidationError('Invalid input', {
  field: 'email',
  value: 'invalid'
});

// Handle errors
app.use((err, req, res, next) => {
  if (err instanceof ValidationError) {
    res.status(400).json({
      error: err.message,
      details: err.details
    });
  }
});
```

---

## Environment Variables

### Standard Variables

```bash
# Server
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# Logging
LOG_LEVEL=info
LOG_DIR=./logs

# Session
SESSION_SECRET=your-secret-key
SESSION_MAX_AGE=86400000

# Database
DATABASE_URL=postgresql://user:pass@localhost/db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Services
OPENAI_API_KEY=sk-...
CLAUDE_API_KEY=...

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# WebSocket
WS_PING_INTERVAL=25000
WS_PING_TIMEOUT=60000
```

---

## TypeScript Types

### Core Types

```typescript
import type {
  StandardServerConfig,
  LogLevel,
  Logger,
  WebSocketClient,
  WebSocketStats,
  JobStatus,
  JobPriority,
  SettingType,
  ValidationResult,
  ApiResponse,
  PaginatedResponse,
  SessionConfig,
  HealthStatus
} from '@episensor/app-framework';
```

### UI Types

```typescript
import type {
  ButtonVariant,
  InputType,
  TableColumn,
  SelectOption,
  TabItem,
  AlertType,
  SettingCategory,
  LogEntry
} from '@episensor/app-framework/ui';
```

---


## Performance Tips

1. **Use connection pooling** for databases
2. **Enable compression** for large responses
3. **Implement caching** with Redis
4. **Use pagination** for large datasets
5. **Batch WebSocket updates** for high-frequency data
6. **Enable production mode** in production
7. **Use PM2 or similar** for process management
8. **Monitor with APM tools** like DataDog or New Relic

---

## Security Best Practices

1. **Always validate input** using validation middleware
2. **Use HTTPS** in production
3. **Enable CORS** with specific origins
4. **Implement rate limiting** on APIs
5. **Sanitize file uploads** and limit sizes
6. **Use secure session settings** in production
7. **Keep dependencies updated** regularly
8. **Implement proper authentication** and authorization
9. **Log security events** for auditing
10. **Use environment variables** for secrets
