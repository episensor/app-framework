# EpiSensor App Development Guide

## How to Build Applications with the Framework

This guide provides comprehensive instructions for both AI assistants and human developers on how to properly build applications using the EpiSensor App Framework.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Step-by-Step Development](#step-by-step-development)
4. [Common Patterns](#common-patterns)
5. [Best Practices](#best-practices)
6. [AI Development Instructions](#ai-development-instructions)
7. [Complete Application Examples](#complete-application-examples)

---

## Quick Start

### 1. Create New Application

```bash
# Create project directory
mkdir my-episensor-app
cd my-episensor-app

# Initialize package.json
npm init -y

# Install framework
npm install @episensor/app-framework@file:../epi-app-framework
npm install @episensor/ui-framework@file:../epi-app-framework/ui

# Install common dependencies
npm install express cors dotenv
npm install -D typescript @types/node @types/express nodemon
```

### 2. Basic Application Template

```typescript
// src/index.ts
import { StandardServer, createLogger } from '@episensor/app-framework';
import { setupRoutes } from './routes';
import { initializeServices } from './services';

const logger = createLogger('App');

async function main() {
  const server = new StandardServer({
    appName: 'My EpiSensor App',
    appVersion: '1.0.0',
    port: parseInt(process.env.PORT || '8080'),
    webPort: parseInt(process.env.WEB_PORT || '8081'), // See PORT_STANDARDIZATION.md
    enableWebSocket: true,
    
    onInitialize: async (app) => {
      // Initialize services
      await initializeServices();
      
      // Setup routes
      setupRoutes(app);
      
      logger.info('Application initialized');
    },
    
    onStart: async () => {
      logger.info('Application started successfully');
    }
  });
  
  await server.initialize();
  await server.start();
}

main().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});
```

### 3. Package.json Scripts

```json
{
  "scripts": {
    "dev": "nodemon --watch src --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  }
}
```

---

## Project Structure

### Recommended Directory Layout

```
my-episensor-app/
├── src/
│   ├── api/              # API endpoints
│   │   ├── health.ts
│   │   ├── users.ts
│   │   └── index.ts
│   ├── services/         # Business logic
│   │   ├── database.ts
│   │   ├── auth.ts
│   │   └── index.ts
│   ├── middleware/       # Custom middleware
│   │   ├── logging.ts
│   │   └── errorHandler.ts
│   ├── config/          # Configuration
│   │   └── index.ts
│   ├── types/           # TypeScript types
│   │   └── index.ts
│   ├── utils/           # Utilities
│   │   └── helpers.ts
│   ├── routes.ts        # Route setup
│   └── index.ts         # Entry point
├── ui/                  # Frontend (if applicable)
│   ├── src/
│   ├── public/
│   └── package.json
├── tests/               # Tests
│   ├── unit/
│   └── integration/
├── data/               # Application data
│   ├── config/
│   └── uploads/
├── logs/               # Log files
├── .env                # Environment variables
├── .gitignore
├── tsconfig.json
├── package.json
└── README.md
```

---

## Step-by-Step Development

### Step 1: Configuration Setup

```typescript
// src/config/index.ts
import { ConfigManager } from '@episensor/app-framework';
import { z } from 'zod';

// Define configuration schema
const configSchema = z.object({
  server: z.object({
    port: z.number().default(8080),
    host: z.string().default('localhost')
  }),
  database: z.object({
    url: z.string(),
    poolSize: z.number().default(10)
  }),
  features: z.object({
    enableWebSocket: z.boolean().default(true),
    enableMetrics: z.boolean().default(true)
  })
});

// Create configuration manager
export const config = new ConfigManager({
  configPath: './data/config',
  schema: configSchema,
  envPrefix: 'APP_'
});

// Load configuration
export async function loadConfig() {
  await config.load();
  
  // Map environment variables
  config.mapEnvironment({
    'APP_PORT': 'server.port',
    'DATABASE_URL': 'database.url'
  });
  
  return config.getAll();
}
```

### Step 2: Service Layer

```typescript
// src/services/database.ts
import { createLogger } from '@episensor/app-framework';
import { config } from '../config';

const logger = createLogger('Database');

class DatabaseService {
  private pool: any;
  
  async connect() {
    const dbUrl = config.get('database.url');
    logger.info('Connecting to database...');
    
    // Initialize database connection
    // this.pool = await createPool(dbUrl);
    
    logger.info('Database connected');
  }
  
  async query(sql: string, params?: any[]) {
    // Execute query
    return this.pool.query(sql, params);
  }
  
  async disconnect() {
    await this.pool.end();
    logger.info('Database disconnected');
  }
}

export const db = new DatabaseService();
```

### Step 3: API Routes

```typescript
// src/api/users.ts
import { Router } from 'express';
import { validate, schemas } from '@episensor/app-framework';
import { z } from 'zod';
import { db } from '../services/database';

const router = Router();

// Define validation schemas
const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user')
});

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    const users = await db.query('SELECT * FROM users');
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

// POST /api/users
router.post('/', 
  validate(createUserSchema),
  async (req, res, next) => {
    try {
      const user = await db.query(
        'INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING *',
        [req.body.name, req.body.email, req.body.role]
      );
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

### Step 4: WebSocket Integration

```typescript
// src/services/realtime.ts
import { getWebSocketServer } from '@episensor/app-framework';
import { EventEmitter } from 'events';

class RealtimeService extends EventEmitter {
  private ws = getWebSocketServer();
  
  // Broadcast update to all clients
  broadcastUpdate(type: string, data: any) {
    this.ws.broadcast(`data:${type}`, data);
  }
  
  // Send to specific subscribers
  sendToSubscribers(entityType: string, entityId: string, data: any) {
    this.ws.io.to(`${entityType}:${entityId}`).emit('update', data);
  }
  
  // Setup custom event handlers
  setupHandlers() {
    this.ws.io.on('connection', (socket) => {
      // Custom subscription logic
      socket.on('subscribe:custom', (params) => {
        socket.join(`custom:${params.id}`);
        socket.emit('subscribed', { id: params.id });
      });
    });
  }
}

export const realtime = new RealtimeService();
```

### Step 5: Frontend Integration

```tsx
// ui/src/App.tsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppLayout } from '@episensor/ui-framework';
import { Dashboard } from './pages/Dashboard';
import { Settings } from './pages/Settings';

const navigation = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Settings', href: '/settings', icon: '⚙️' }
];

export function App() {
  return (
    <BrowserRouter>
      <AppLayout
        appName="My EpiSensor App"
        appVersion="1.0.0"
        navigation={navigation}
        connectionStatusUrl="http://localhost:8080"
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
```

### Step 6: Error Handling

```typescript
// src/middleware/errorHandler.ts
import { createLogger } from '@episensor/app-framework';
import { Request, Response, NextFunction } from 'express';

const logger = createLogger('ErrorHandler');

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error('Request error:', {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack
  });
  
  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.details
    });
  }
  
  // Database errors
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable'
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
}
```

---

## Common Patterns

### Authentication Pattern

```typescript
// src/middleware/auth.ts
import { createAuthMiddleware, requireRole } from '@episensor/app-framework';
import { userService } from '../services/users';

export const auth = createAuthMiddleware({
  validateUser: async (username, password) => {
    return await userService.authenticate(username, password);
  }
});

// Usage in routes
router.get('/admin', requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});
```

### Background Jobs Pattern

```typescript
// src/services/jobs.ts
import { QueueService } from '@episensor/app-framework';

const queue = new QueueService({
  concurrent: 5,
  persistent: true
});

// Register handlers
queue.registerHandler('send-email', async (job) => {
  await emailService.send(job.data);
});

queue.registerHandler('process-data', async (job) => {
  await dataProcessor.process(job.data);
});

// Add jobs
export async function scheduleEmail(data: EmailData) {
  return queue.addJob('send-email', data, {
    priority: 'high',
    retries: 3
  });
}
```

### Settings Management Pattern

```typescript
// src/services/settings.ts
import { SettingsService } from '@episensor/app-framework';

export const settings = new SettingsService({
  storage: 'file',
  path: './data/settings.json'
});

// Register application settings
settings.registerCategory({
  id: 'general',
  label: 'General Settings',
  settings: [
    {
      key: 'app.maintenance',
      label: 'Maintenance Mode',
      type: 'boolean',
      defaultValue: false,
      onChange: (value) => {
        if (value) {
          logger.warn('Maintenance mode enabled');
        }
      }
    }
  ]
});

// Check settings in middleware
export function maintenanceCheck(req, res, next) {
  if (settings.get('app.maintenance') && !req.user?.isAdmin) {
    return res.status(503).json({
      error: 'System under maintenance'
    });
  }
  next();
}
```

### Real-time Data Streaming Pattern

```typescript
// src/services/metrics.ts
import { getWebSocketServer } from '@episensor/app-framework';

class MetricsService {
  private ws = getWebSocketServer();
  private interval: NodeJS.Timer;
  
  startStreaming() {
    this.interval = setInterval(() => {
      const metrics = this.collectMetrics();
      this.ws.broadcast('metrics:update', metrics);
    }, 1000);
  }
  
  private collectMetrics() {
    return {
      timestamp: new Date(),
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
  
  stopStreaming() {
    clearInterval(this.interval);
  }
}
```

---

## Best Practices

### 1. Always Use TypeScript

```typescript
// Define interfaces for all data structures
interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: Date;
}

// Use type-safe responses
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Type your route handlers
type RouteHandler = (
  req: Request,
  res: Response<ApiResponse<User>>,
  next: NextFunction
) => Promise<void>;
```

### 2. Implement Proper Logging

```typescript
import { createLogger } from '@episensor/app-framework';

const logger = createLogger('ServiceName');

// Log at appropriate levels
logger.debug('Detailed debug information', { data });
logger.info('Normal operation message');
logger.warn('Warning that should be investigated');
logger.error('Error that needs immediate attention', error);

// Use structured logging
logger.info('User action', {
  userId: user.id,
  action: 'login',
  ip: req.ip,
  timestamp: new Date()
});
```

### 3. Handle Errors Gracefully

```typescript
// Always use try-catch in async routes
router.get('/api/data', async (req, res, next) => {
  try {
    const data = await fetchData();
    res.json({ success: true, data });
  } catch (error) {
    // Pass to error handler
    next(error);
  }
});

// Create custom error classes
class BusinessLogicError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BusinessLogicError';
  }
}

// Use specific error handling
if (error instanceof BusinessLogicError) {
  // Handle business logic errors
} else if (error.code === 'ECONNREFUSED') {
  // Handle connection errors
}
```

### 4. Validate All Input

```typescript
import { validate } from '@episensor/app-framework';
import { z } from 'zod';

// Define strict schemas
const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(120),
  preferences: z.object({
    newsletter: z.boolean(),
    notifications: z.enum(['all', 'important', 'none'])
  })
});

// Apply validation middleware
router.post('/api/users', validate(schema), handler);

// Validate environment variables
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().regex(/^\d+$/).transform(Number),
  DATABASE_URL: z.string().url()
});

const env = envSchema.parse(process.env);
```

### 5. Use Dependency Injection

```typescript
// services/container.ts
class ServiceContainer {
  private services = new Map();
  
  register<T>(name: string, factory: () => T) {
    this.services.set(name, factory);
  }
  
  get<T>(name: string): T {
    const factory = this.services.get(name);
    if (!factory) {
      throw new Error(`Service ${name} not registered`);
    }
    return factory();
  }
}

export const container = new ServiceContainer();

// Register services
container.register('database', () => new DatabaseService());
container.register('cache', () => new CacheService());

// Use in routes
const db = container.get<DatabaseService>('database');
```

---

## AI Development Instructions

### For AI Assistants Building EpiSensor Apps

When asked to create an application using the EpiSensor App Framework, follow these steps:

#### 1. Understand Requirements
- Ask for clarification on application type (API, real-time, UI needed?)
- Determine required features (auth, database, WebSocket, etc.)
- Identify external integrations needed

#### 2. Start with StandardServer
```typescript
// ALWAYS use StandardServer for server initialization
import { StandardServer } from '@episensor/app-framework';
```

#### 3. Structure the Application
```
src/
├── index.ts         # Entry point with StandardServer
├── config.ts        # Configuration setup
├── routes.ts        # Route registration
├── api/            # API endpoints
├── services/       # Business logic
└── middleware/     # Custom middleware
```

#### 4. Implement Core Features
- **Logging**: Use createLogger for all services
- **Validation**: Always validate input with zod schemas
- **Error Handling**: Implement comprehensive error handling
- **WebSocket**: Use for real-time features
- **Configuration**: Use ConfigManager for settings

#### 5. Security Checklist
- [ ] Input validation on all endpoints
- [ ] Authentication middleware where needed
- [ ] Rate limiting on public endpoints
- [ ] CORS configuration
- [ ] Environment variables for secrets
- [ ] Secure session configuration
- [ ] File upload restrictions

#### 6. Testing Requirements
```typescript
// Always include test setup
import { TestServer } from '@episensor/app-framework';

describe('API Tests', () => {
  let server: TestServer;
  
  beforeAll(async () => {
    server = await setupTestServer();
  });
  
  // Include tests for all endpoints
});
```

#### 7. Documentation Template
```markdown
# Application Name

## Setup
1. Install dependencies: `npm install`
2. Configure environment: Copy `.env.example` to `.env`
3. Run development: `npm run dev`

## API Endpoints
- `GET /api/health` - Health check
- `POST /api/[resource]` - Create resource
- etc.

## WebSocket Events
- `connect` - Client connected
- `data:update` - Data update event
- etc.

## Configuration
See `data/config/app.json` for configuration options
```

#### 8. Common Mistakes to Avoid
- ❌ Don't create custom server implementations
- ❌ Don't forget error handling
- ❌ Don't skip input validation
- ❌ Don't hardcode configuration values
- ❌ Don't ignore TypeScript types
- ❌ Don't forget to initialize services
- ❌ Don't mix session and JWT auth

#### 9. Performance Considerations
- Implement caching where appropriate
- Use pagination for large datasets
- Batch WebSocket updates
- Use connection pooling for databases
- Implement graceful shutdown

#### 10. Production Readiness
```typescript
// Include production considerations
if (process.env.NODE_ENV === 'production') {
  // Enable compression
  app.use(compression());
  
  // Security headers
  app.use(helmet());
  
  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  }));
}
```

---

## Complete Application Examples

### Example 1: REST API with Database

```typescript
// src/index.ts
import { StandardServer, createLogger, ConfigManager } from '@episensor/app-framework';
import express from 'express';
import cors from 'cors';
import { routes } from './routes';
import { db } from './services/database';
import { errorHandler } from './middleware/errorHandler';

const logger = createLogger('API');

async function main() {
  // Load configuration
  const config = new ConfigManager();
  await config.load();
  
  // Create server
  const server = new StandardServer({
    appName: 'REST API',
    appVersion: '1.0.0',
    port: config.get('server.port', 8080),
    
    onInitialize: async (app) => {
      // Middleware
      app.use(cors());
      app.use(express.json());
      
      // Connect to database
      await db.connect();
      
      // Routes
      app.use('/api', routes);
      
      // Error handling
      app.use(errorHandler);
    },
    
    onStart: async () => {
      logger.info('API server ready');
    }
  });
  
  await server.initialize();
  await server.start();
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await db.disconnect();
    await server.stop();
    process.exit(0);
  });
}

main().catch(error => {
  logger.error('Failed to start:', error);
  process.exit(1);
});
```

### Example 2: Real-time Dashboard

```typescript
// src/index.ts
import { 
  StandardServer, 
  createLogger,
  getWebSocketServer 
} from '@episensor/app-framework';
import { collectMetrics } from './services/metrics';

const logger = createLogger('Dashboard');

const server = new StandardServer({
  appName: 'Real-time Dashboard',
  appVersion: '1.0.0',
  enableWebSocket: true,
  
  onInitialize: async (app) => {
    // Serve static files
    app.use(express.static('public'));
    
    // API endpoints
    app.get('/api/metrics', async (req, res) => {
      const metrics = await collectMetrics();
      res.json(metrics);
    });
  },
  
  onStart: async () => {
    const ws = getWebSocketServer();
    
    // Stream metrics every second
    setInterval(async () => {
      const metrics = await collectMetrics();
      ws.broadcast('metrics:update', metrics);
    }, 1000);
    
    logger.info('Dashboard streaming started');
  }
});

await server.initialize();
await server.start();
```

### Example 3: Microservice with Queue

```typescript
// src/index.ts
import { 
  StandardServer,
  QueueService,
  createLogger 
} from '@episensor/app-framework';

const logger = createLogger('Worker');
const queue = new QueueService({
  concurrent: 10,
  persistent: true
});

// Register job handlers
queue.registerHandler('process-image', async (job) => {
  logger.info('Processing image:', job.data.id);
  await processImage(job.data);
});

queue.registerHandler('send-notification', async (job) => {
  logger.info('Sending notification:', job.data);
  await sendNotification(job.data);
});

const server = new StandardServer({
  appName: 'Worker Service',
  appVersion: '1.0.0',
  
  onInitialize: async (app) => {
    // Health check
    app.get('/health', (req, res) => {
      const stats = queue.getStats();
      res.json({
        status: 'healthy',
        queue: stats
      });
    });
    
    // Add job endpoint
    app.post('/api/jobs', async (req, res) => {
      const jobId = await queue.addJob(
        req.body.type,
        req.body.data
      );
      res.json({ jobId });
    });
  },
  
  onStart: async () => {
    await queue.start();
    logger.info('Worker service ready');
  }
});

await server.initialize();
await server.start();
```

---

## Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY dist/ ./dist/
COPY data/ ./data/

# Environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Run
CMD ["node", "dist/index.js"]
```

### PM2

```json
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'my-app',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G'
  }]
};
```

---

## Troubleshooting

### Common Issues and Solutions

**Port already in use**
```typescript
// Use port utilities to clear
import { clearPort } from '@episensor/app-framework';
await clearPort(8080);
```

**WebSocket connection fails**
```typescript
// Check CORS configuration
const server = new StandardServer({
  // Ensure WebSocket is enabled
  enableWebSocket: true
});
```

**Memory leaks in production**
```typescript
// Implement cleanup
process.on('SIGTERM', async () => {
  // Clean up resources
  await cleanup();
  process.exit(0);
});
```

**Validation errors not showing**
```typescript
// Ensure error handler is last middleware
app.use(routes);
app.use(errorHandler); // Must be last
```

---

## Additional Resources

- [API Reference](./API_REFERENCE.md)
- [WebSocket Guide](./WEBSOCKET.md)
- [Testing Guidelines](./TESTING.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Development Standards](./STANDARDS.md)
- [Logging Documentation](./LOGGING.md)