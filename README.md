# EpiSensor App Framework

A comprehensive, production-ready framework for building enterprise internal tools and applications with TypeScript, React, and real-time capabilities.

## 📋 Documentation

### Core Guides
- **[Api](./docs/Api.md)** - Complete API documentation with best practices
- **[Development](./docs/Development.md)** - How to build applications with the framework
- **[Architecture](./docs/Architecture.md)** - System design and structure
- **[Standards](./docs/Standards.md)** - Coding standards and best practices
- **[Structure](./docs/Structure.md)** - Application directory structure standard

### Features
- **[Websocket](./docs/Websocket.md)** - Real-time communication implementation
- **[Desktop](./docs/Desktop.md)** - Desktop application support with Tauri
- **[Bundling](./docs/Bundling.md)** - Desktop bundling guide
- **[Ai](./docs/Ai.md)** - AI service integration
- **[Patterns](./docs/Patterns.md)** - Proven architectural patterns

### Configuration & Testing
- **[Testing](./docs/Testing.md)** - Testing guidelines and patterns
- **[Logging](./docs/Logging.md)** - Logging system documentation
- **[Theme](./docs/Theme.md)** - Theme system and customization
- **[Ports](./docs/Ports.md)** - Port configuration standards
- **[Cors](./docs/Cors.md)** - Dynamic CORS middleware

#### Test Suite Overview
The framework includes extensive test coverage:
- **Unit Tests**: 362+ tests covering all core modules
- **Integration Tests**: API and service integration testing
- **TestServer**: Built-in test server for application testing
- **Mock Services**: Comprehensive mocking utilities

#### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific suites
npm run test:unit
npm run test:integration

# Type checking
npm run typecheck
```

#### Test Infrastructure
- Jest with TypeScript support
- Built-in TestServer class for app testing
- Mock implementations for all services
- Async operation handling
- Port management utilities

## 🚀 Quick Start

```bash
# Install framework
npm install @episensor/app-framework

# Create your app
mkdir my-app && cd my-app
npm init -y
npm install @episensor/app-framework
```

### Minimal Application

```typescript
import { StandardServer } from '@episensor/app-framework';

const server = new StandardServer({
  appName: 'My App',
  appVersion: '1.0.0',
  port: 8080,
  enableWebSocket: true,
  onInitialize: async (app) => {
    app.get('/health', (req, res) => res.json({ status: 'ok' }));
  }
});

await server.initialize();
await server.start();
```

## ✨ Core Features

### 🖥️ Server Management
- **StandardServer** - Simplified server setup with Express
- **Port Management** - Automatic port conflict resolution
- **Graceful Shutdown** - Clean resource cleanup
- **Health Checks** - Real system metrics (CPU, memory, disk) - informational only
- **Startup Banner** - Professional application startup display

### 📝 Logging System
- **Dual Logger System** - Simple console + production file logging
- **Enhanced Logger** - File rotation, compression, archiving
- **Category-based Logging** - Organize logs by service/module
- **Log Management** - Statistics, cleanup, migration utilities
- **Flat Structure** - All logs in `/data/logs` for easy backup/restore

### 🔌 Real-Time Communication
- **WebSocketManager** - Unified Socket.IO management with namespace support
- **Redis Adapter** - Optional Redis adapter for scaling
- **Room Management** - Built-in room join/leave handlers
- **Client Tracking** - Track connected clients across namespaces
- **Broadcast Options** - Selective broadcasting with compression/volatile options
- **React Hooks** - `useWebSocket`, `useWebSocketSubscription`
- **Connection Status** - Monitor connection health

### 🔒 Security & Authentication
- **Session Management** - Express sessions with Redis support
- **Authentication Middleware** - Role-based access control
- **Input Validation** - Zod/Joi schema validation
- **File Security** - Safe file operations with validation
- **CORS Configuration** - Cross-origin resource sharing

### ⚙️ Configuration & Settings
- **ConfigManager** Advanced configuration with Zod validation
- **Environment Merging** Automatic env variable merging
- **File Watching** Auto-reload on config file changes
- **Change Events** EventEmitter for config change tracking
- **Common Schemas** Pre-built Zod schemas for common configs
- **Settings Service** - Dynamic settings with UI generation

### 📊 Health Monitoring
- **HealthCheckService** Real system metrics collection
- **CPU Metrics** Real CPU usage with history tracking
- **Memory Metrics** Memory usage percentage and details
- **Disk Metrics** Disk space monitoring (platform-aware)
- **Process Metrics** Node.js process statistics
- **Custom Health Checks** Extensible health check framework
- **Dependency Checks** Monitor external service health
- **Informational Only** Never interrupts service operation

### 🔧 Services & Utilities
- **Queue Service** - Background job processing with persistence
- **AI Service** - Multi-provider AI integration (OpenAI, Claude)
- **Port Utilities** - Port availability checking and management
- **File Handler** - Secure file operations with MIME validation
- **Network Service** - Network interface discovery
- **System Monitor** - System resource monitoring

### 🎨 UI Components Library

#### Base Components (20+)
- **Forms** - Input, Select, Checkbox, Radio, Switch, Textarea
- **Layout** - Card, Dialog, Tabs, Accordion, Separator
- **Data Display** - Table, Badge, Alert, Progress, Avatar
- **Navigation** - Button, Dropdown, Context Menu, Navigation Menu
- **Feedback** - Toast, Tooltip, Popover, Alert Dialog

#### Advanced Components
- **SettingsFramework** - Complete settings UI with validation
- **LogViewer** - Real-time log display with filtering
- **ConnectionStatus** - WebSocket connection monitoring
- **AppLayout** - Standard application layout with navigation
- **RealtimeDataTable** - Live updating data tables
- **DashboardStats** - Metric display cards
- **UpdateNotification** - Application update notifications

### 🧪 Testing Utilities
- **TestServer** - Standardized test server for integration tests
- **Test Utilities** - Request helpers, WebSocket testing
- **Mock Services** - Pre-configured mocks for services

### 📊 Middleware
- **Validation** - Request/response validation
- **Error Handling** - Centralized error management
- **File Upload** - Secure file upload handling
- **OpenAPI** - Automatic API documentation
- **Health Checks** - Liveness/readiness probes
- **Rate Limiting** - API rate limiting

## 📦 Installation

### Full Framework (Backend + Frontend)
```bash
npm install @episensor/app-framework
```

### Import Examples
```javascript
// Backend
import { StandardServer, createLogger } from '@episensor/app-framework';

// Frontend UI components
import { Button, Card, useWebSocket } from '@episensor/app-framework/ui';
```
```

## 💡 Usage Examples

### REST API with Database

```typescript
import { StandardServer, validate, createLogger } from '@episensor/app-framework';
import { z } from 'zod';

const logger = createLogger('API');

const server = new StandardServer({
  appName: 'REST API',
  appVersion: '1.0.0',
  onInitialize: async (app) => {
    // Validation middleware
    const userSchema = z.object({
      name: z.string(),
      email: z.string().email()
    });
    
    app.post('/api/users', validate(userSchema), async (req, res) => {
      // Validated request body
      const user = await createUser(req.body);
      res.json({ success: true, data: user });
    });
  }
});
```

### Real-Time Dashboard

```typescript
import { StandardServer, getWebSocketServer } from '@episensor/app-framework';

const server = new StandardServer({
  appName: 'Dashboard',
  appVersion: '1.0.0',
  enableWebSocket: true,
  onStart: async () => {
    const ws = getWebSocketServer();
    
    // Stream metrics every second
    setInterval(() => {
      const metrics = collectMetrics();
      ws.broadcast('metrics:update', metrics);
    }, 1000);
  }
});
```

### React WebSocket Integration

```tsx
import { useWebSocket } from '@episensor/app-framework/ui';

function Dashboard() {
  const { connected, on, off } = useWebSocket('http://localhost:8080');
  const [metrics, setMetrics] = useState([]);
  
  useEffect(() => {
    if (connected) {
      const handler = (data) => setMetrics(data);
      on('metrics:update', handler);
      return () => off('metrics:update', handler);
    }
  }, [connected]);
  
  return <MetricsDisplay data={metrics} />;
}
```

### Background Job Processing

```typescript
import { QueueService } from '@episensor/app-framework';

const queue = new QueueService({
  concurrent: 5,
  persistent: true
});

queue.registerHandler('send-email', async (job) => {
  await sendEmail(job.data);
});

await queue.addJob('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!'
});
```

### Settings Management

```typescript
import { SettingsService } from '@episensor/app-framework';

const settings = new SettingsService();

settings.registerCategory({
  id: 'general',
  label: 'General Settings',
  settings: [{
    key: 'app.theme',
    label: 'Theme',
    type: 'select',
    options: ['light', 'dark', 'auto'],
    defaultValue: 'auto'
  }]
});

// React component
<SettingsFramework 
  categories={settings.getUISchema()}
  onSave={async (values) => settings.update(values)}
/>
```

### Health Monitoring

```typescript
import { createHealthCheckRouter, getHealthCheckService } from '@episensor/app-framework';

// Add health check endpoints
const healthRouter = createHealthCheckRouter({
  version: '1.0.0',
  customChecks: [{
    name: 'database',
    check: async () => ({
      name: 'database',
      status: await db.ping() ? 'healthy' : 'unhealthy'
    })
  }]
});

app.use('/api', healthRouter);

// Get real-time metrics
const healthService = getHealthCheckService();
const metrics = await healthService.getMetrics();
console.log(`CPU: ${metrics.cpu.usage}%, Memory: ${metrics.memory.percentage}%`);
```

### Configuration Management

```typescript
import { getConfigManager, CommonSchemas } from '@episensor/app-framework';
import { z } from 'zod';

// Define config schema
const configSchema = z.object({
  server: CommonSchemas.serverConfig,
  logging: CommonSchemas.loggingConfig,
  custom: z.object({
    feature: z.boolean().default(true)
  })
});

// Initialize with schema validation
const config = getConfigManager({
  schema: configSchema,
  watchFile: true, // Auto-reload on changes
  mergeEnv: true   // Merge environment variables
});

await config.initialize();

// Type-safe access
const port = config.get<number>('server.port');

// Listen for changes
config.on('configChanged', (event) => {
  console.log(`Config ${event.key} changed from ${event.oldValue} to ${event.newValue}`);
});
```

### WebSocket Manager

```typescript
import { getWebSocketManager } from '@episensor/app-framework';

// Initialize WebSocket manager
const wsManager = getWebSocketManager({
  cors: { origin: 'http://localhost:3000' },
  adapter: 'redis', // Optional Redis scaling
  redisUrl: process.env.REDIS_URL
});

await wsManager.initialize(httpServer);

// Register namespace with handlers
wsManager.registerNamespace('/dashboard', {
  'subscribe': (socket, topic) => {
    socket.join(`topic:${topic}`);
    socket.emit('subscribed', { topic });
  },
  'unsubscribe': (socket, topic) => {
    socket.leave(`topic:${topic}`);
  }
});

// Broadcast to specific rooms
wsManager.broadcast('update', data, {
  namespace: '/dashboard',
  room: 'topic:metrics',
  compress: true
});

// Get connection stats
const stats = wsManager.getStats();
console.log(`Connected clients: ${stats.totalClients}`);
```

## 🏗️ Architecture

```
Framework Structure:
├── Core Layer
│   ├── StandardServer      # Server management
│   ├── Logger System       # Logging infrastructure
│   ├── Port Utilities      # Port management
│   └── File Handler        # Secure file operations
├── Service Layer
│   ├── WebSocket Server    # Real-time communication
│   ├── Configuration       # Config management
│   ├── Queue Service       # Job processing
│   ├── AI Service          # AI integration
│   └── Settings Service    # Settings management
├── Middleware Layer
│   ├── Authentication      # Auth & sessions
│   ├── Validation         # Input validation
│   ├── Error Handling     # Error management
│   └── Health Checks      # Health monitoring
└── UI Layer
    ├── Base Components    # Core UI elements
    ├── Advanced Components # Complex UI patterns
    ├── Hooks              # React hooks
    └── Utilities          # UI helpers
```

## 🔧 Configuration

### Environment Variables

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

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Services (optional)
OPENAI_API_KEY=sk-...
CLAUDE_API_KEY=sk-ant-...

# WebSocket
WS_PING_INTERVAL=25000
WS_PING_TIMEOUT=60000
```

### Configuration Files

```json
// data/config/app.json
{
  "server": {
    "port": 8080,
    "cors": {
      "origins": ["http://localhost:3000"]
    }
  },
  "features": {
    "enableWebSocket": true,
    "enableMetrics": true
  }
}
```

## 📚 TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  StandardServerConfig,
  Logger,
  WebSocketClient,
  JobStatus,
  SettingType,
  ApiResponse,
  ValidationSchema
} from '@episensor/app-framework';

import type {
  ButtonProps,
  TableColumn,
  SettingCategory,
  WebSocketHook
} from '@episensor/app-framework/ui';
```

## 🧪 Testing

```typescript
import { TestServer, setupTestServer } from '@episensor/app-framework';

describe('API Tests', () => {
  let server: TestServer;
  
  beforeAll(async () => {
    server = await setupTestServer({
      setupApp: (app) => {
        app.get('/test', (req, res) => res.json({ ok: true }));
      }
    });
  });
  
  test('endpoint works', async () => {
    const res = await server.request('/test');
    expect(res.body.ok).toBe(true);
  });
});
```

## 🚀 Production Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
ENV NODE_ENV=production
HEALTHCHECK CMD curl -f http://localhost:8080/health || exit 1
CMD ["node", "dist/index.js"]
```

### PM2

```javascript
module.exports = {
  apps: [{
    name: 'my-app',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

## 🛠️ Development Tools

- **Hot Reload** - Automatic restart on changes
- **TypeScript** - Full type safety
- **ESLint** - Code quality enforcement
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **Nodemon** - Development server

## 📖 For AI Assistants

This framework is designed to be AI-friendly. When building applications:

1. **Always use StandardServer** - Never use deprecated StartupOrchestrator
2. **Validate all inputs** - Use zod schemas for validation
3. **Handle errors properly** - Use try-catch and error middleware
4. **Use TypeScript** - Define interfaces for all data structures
5. **Follow the patterns** - See [Development Guide](./docs/Development.md)

## 🔒 Security

- Input validation on all endpoints
- Secure session management
- File upload restrictions
- Rate limiting support
- CORS configuration
- Environment variable secrets

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details

## 🤝 Support

- **Documentation**: See `/docs` folder for all guides
- **Issues**: Internal issue tracker
- **Examples**: Check example applications using this framework

---

Built with ❤️ by EpiSensor