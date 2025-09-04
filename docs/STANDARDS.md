# EpiSensor Application Development Standards

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Configuration Management](#configuration-management)
4. [UI Standards](#ui-standards)
5. [Code Standards](#code-standards)
6. [API Development](#api-development)
7. [Frontend Development](#frontend-development)
8. [Testing Standards](#testing-standards)
9. [Security Practices](#security-practices)
10. [Performance Guidelines](#performance-guidelines)
11. [Deployment and Operations](#deployment-and-operations)

## Overview

This document defines the standardized approach for developing applications using the @episensor/app-framework. All internal applications should follow these standards to ensure consistency, maintainability, and quality.

### Core Principles

- **Consistency**: All apps follow the same patterns and structures
- **Modularity**: Reusable components and services via the framework
- **Observability**: File-based configuration over environment variables
- **Quality**: Comprehensive testing and documentation
- **Security**: Built-in security practices and validations

## Project Structure

### Directory Organisation

All applications must follow this standardized structure:

```
app-root/
├── src/
│   ├── api/              # API endpoints and routes
│   ├── config/           # Configuration management
│   ├── core/             # Core business logic
│   ├── features/         # Feature-specific modules
│   ├── infrastructure/  # External service integrations
│   ├── middleware/       # Express/HTTP middleware
│   ├── services/         # Shared services
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── server.ts         # Main server file
│   └── index.ts          # Entry point
├── web/                  # Frontend application (if applicable)
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   ├── e2e/              # End-to-end tests
│   └── fixtures/         # Test data
├── data/
│   ├── config/
│   │   └── app.json      # Main configuration file
│   ├── cache/            # Temporary cached data
│   ├── storage/          # Persistent application data
│   └── exports/          # Generated files
├── docs/                 # Documentation
├── logs/                 # Application logs
├── dist/                 # Build output
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md
```

### Naming Conventions

- **Package names**: `@episensor/[app-name]` in kebab-case
- **Files**: camelCase for `.ts`/`.js` files (e.g., `userService.ts`)
- **Directories**: lowercase, no special characters
- **Classes**: PascalCase (e.g., `UserService`)
- **Interfaces**: PascalCase with 'I' prefix optional (e.g., `IUserService` or `UserService`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)

### Import Organisation

```typescript
// 1. Node built-ins
import path from 'path';
import { fileURLToPath } from 'url';

// 2. External dependencies
import express from 'express';
import cors from 'cors';

// 3. Framework imports
import { 
  ConfigManager,
  createLogger,
  createWebSocketServer 
} from '@episensor/app-framework';

// 4. Local imports
import { UserService } from './services/userService.js';
import type { ApiResponse } from './types/index.js';
```

## Server Implementation

### Required: Use StandardServer

All applications MUST use the `StandardServer` class from the framework:

```typescript
// src/index.ts
import { StandardServer } from '@episensor/app-framework';
import { setupRoutes } from './routes.js';

const server = new StandardServer({
  appName: 'My Application',
  appVersion: '1.0.0',
  description: 'Application Description',
  port: 8080,
  webPort: 5173, // Optional separate web UI port
  enableWebSocket: true,
  
  onInitialize: async (app) => {
    // Setup middleware and routes
    setupRoutes(app);
  }
});

// Start the server
await server.initialize();
await server.start();
```

This ensures:
- ✅ Consistent startup sequence
- ✅ Proper port conflict handling
- ✅ Standardized console output
- ✅ Correct banner timing
- ✅ Proper exit codes on failure

### DO NOT:
- ❌ Create custom server classes
- ❌ Implement your own port handling
- ❌ Use custom banner display logic
- ❌ Handle server errors differently

## Configuration Management

### Configuration File Structure

All applications must use `data/config/app.json` for configuration:

```json
{
  "app": {
    "name": "@episensor/app-name",
    "version": "1.0.0",
    "title": "Application Title"
  },
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "webSocketPort": 3001,
  "features": {
    "feature1": true,
    "feature2": {
      "enabled": true,
      "config": {}
    }
  },
  "ui": {
    "theme": "light"
  },
  "defaults": {
    "timeout": 5000,
    "retryAttempts": 3
  }
}
```

### Port Allocation

Standardized port ranges for different application types:

- **Framework utilities**: 3000-3099
- **Manufacturing tools**: 4000-4999
- **Simulators**: 5000-5999
- **Testing tools**: 6000-6099

### Environment Variables

Use environment variables sparingly, only for deployment-specific overrides:

- `NODE_ENV`: development | production | test
- `PORT`: Override default port (for containerization)
- Session secrets and API keys should be in secure storage, not env vars

### Configuration Loading

```typescript
import { ConfigManager } from '@episensor/app-framework';

const config = new ConfigManager({
  configPath: './data/config/app.json',
  watchForChanges: process.env.NODE_ENV === 'development'
});

await config.initialize();
const appConfig = config.getConfig();
```

## UI Standards

### Icons
All applications MUST use icons from the framework's centralised icon library:

```typescript
// ✅ DO: Import from framework
import { Settings, Play, Pause } from '@episensor/app-framework/ui';

// ❌ DON'T: Import directly from lucide-react
import { Settings } from 'lucide-react'; // Wrong!
```

### Theme
Use the centralised theme system for all colours and styles:

```typescript
// ✅ DO: Use theme values
import { theme } from '@episensor/app-framework/ui';
const primaryColor = theme.colors.primary.DEFAULT;

// ❌ DON'T: Hard-code colours
const primaryColor = '#E21350'; // Wrong!
```

### Consistent Styles
Use the provided style constants for common patterns:

```typescript
// ✅ DO: Use style constants
import { cardStyles, emptyStateStyles } from '@episensor/app-framework/ui';
<div className={cardStyles.interactive}>...</div>

// ❌ DON'T: Duplicate styles
<div className="hover:shadow-md hover:border-gray-300 cursor-pointer">...</div>
```

## Code Standards

### Code Formatting and Linting

All applications must use consistent formatting and linting tools:

#### ESLint Configuration

```javascript
// eslint.config.js
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2022,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': typescript
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
];
```

#### Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

```
# .prettierignore
node_modules
dist
coverage
*.snap
.git
.husky
```

#### EditorConfig

```ini
# .editorconfig
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[*.{yml,yaml}]
indent_size = 2
```

### TypeScript Configuration

All applications must use TypeScript with strict settings:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Asynchronous Operations

Always use async/await pattern:

```typescript
// ✅ Good
async function fetchData(): Promise<Data> {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    logger.error('Failed to fetch data', error);
    throw new AppError('Data fetch failed', 500);
  }
}

// ❌ Avoid
function fetchData(callback) {
  apiCall().then(callback).catch(console.error);
}
```

### Error Handling

Implement comprehensive error handling:

```typescript
import { AppError } from '@episensor/app-framework';

class ServiceError extends AppError {
  constructor(message: string, statusCode: number, details?: any) {
    super(message, statusCode, details);
    this.name = 'ServiceError';
  }
}

// In route handlers
app.get('/api/resource', async (req, res, next) => {
  try {
    const data = await service.getData();
    res.json({ success: true, data });
  } catch (error) {
    next(error); // Let error middleware handle it
  }
});
```

### Logging

Use framework's logging service:

```typescript
import { createLogger } from '@episensor/app-framework';

const logger = createLogger('ModuleName');

logger.info('Server started', { port: 3000 });
logger.warn('Deprecation warning');
logger.error('Operation failed', error);
logger.debug('Debug information');
```

Never use `console.log` in production code.

### Input Validation

Validate all external inputs using Zod:

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(3).max(100),
  email: z.string().email(),
  age: z.number().min(0).max(120).optional()
});

// Use framework's validation middleware
import { validate } from '@episensor/app-framework';

// Apply validation to routes
app.post('/api/users', validate(schema), (req, res) => {
  // req.body is now validated and typed
});

// For query parameters, use coerce for automatic type conversion
const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10)
});
```

## API Development

### REST API Standards

All APIs must follow RESTful conventions:

```typescript
// Resource endpoints
GET    /api/resources       // List resources
GET    /api/resources/:id   // Get single resource
POST   /api/resources       // Create resource
PUT    /api/resources/:id   // Update resource
DELETE /api/resources/:id   // Delete resource

// Action endpoints
POST   /api/resources/:id/action
```

### Response Format

Standardized API response format:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    version: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
  };
}
```

### Status Codes

Use appropriate HTTP status codes:

- `200 OK`: Successful GET/PUT
- `201 Created`: Successful POST
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server errors

### API Versioning

**Note**: API versioning is not required for internal desktop applications. These apps are deployed as a unit with their frontends, eliminating version mismatch issues. Focus on backward compatibility within the same major version instead.

### Rate Limiting

**Note**: Rate limiting is not required for internal desktop applications. Only implement if the application will be exposed to external networks or public access.

```typescript
// Example for public-facing APIs only
import { rateLimiter } from '@episensor/app-framework';

app.use('/api', rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100
}));
```

## Frontend Development

### UI Framework Usage

All applications with frontend must use @episensor/app-framework/ui:

```json
{
  "dependencies": {
    "@episensor/app-framework": "^1.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@radix-ui/react-*": "^1.0.0"
  }
}
```

### Component Structure

```tsx
import React from 'react';
import { Button, Card, Input } from '@episensor/app-framework/ui';

interface ComponentProps {
  title: string;
  onSubmit: (data: FormData) => void;
}

export const MyComponent: React.FC<ComponentProps> = ({ title, onSubmit }) => {
  // Component logic
  return (
    <Card>
      <h2>{title}</h2>
      {/* Component content */}
    </Card>
  );
};
```

### State Management

Use React Query for server state:

```tsx
import { useQuery, useMutation } from '@tanstack/react-query';

const useResources = () => {
  return useQuery({
    queryKey: ['resources'],
    queryFn: fetchResources,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
};
```

### Performance Optimization

Implement code splitting and lazy loading:

```tsx
const Dashboard = React.lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Suspense>
  );
}
```

## Dependency Management

### Framework Dependencies
The `@episensor/app-framework` provides all core dependencies. Applications should NOT add these directly:

**Core Infrastructure** (provided by framework):
- `express` - Web server
- `socket.io` - WebSocket communication  
- `winston` & `winston-daily-rotate-file` - Logging
- `zod` - Schema validation
- `multer` - File uploads
- `express-session` - Session management
- `fs-extra` - Enhanced file operations
- `dotenv` - Environment variables

**Data Processing** (provided by framework):
- `sharp` - Image processing
- `papaparse` - CSV parsing
- `pdf-parse-new` - PDF parsing
- `xlsx` - Excel file handling
- `archiver` & `unzipper` - Archive handling

**API Documentation** (provided by framework):
- `swagger-jsdoc` & `swagger-ui-express` - OpenAPI documentation

**UI Standardisation** (provided by framework):
- Centralised theme system
- 100+ Lucide React icons
- Consistent style constants
- Full shadcn/ui component library

### Application-Specific Dependencies
Applications MAY add these dependencies if needed for app-specific features:
- **date-fns** - Date manipulation (if complex date operations required)
- **axios** - HTTP client (for external API calls)
- **sharp** - Image processing (for image manipulation)
- **modbus-serial** - For Modbus protocol support
- **serialport** - For hardware communication

### Optional Framework Dependencies
These can be installed to enable additional framework features:
- **connect-redis** + **redis** - Enable Redis session store for production (falls back to memory store if not installed)

### Development Dependencies
All applications should use consistent development tools:

| Package | Version | Purpose |
|---------|---------|---------|
| eslint | ^8.x | Linting (v9 has breaking changes) |
| prettier | ^3.5.1 | Code formatting |
| jest | ^29.x or ^30.x | Unit testing |
| typescript | ^5.x | Type checking |
| @playwright/test | ^1.54.x | E2E testing |

### Dependencies to Avoid
- **moment.js** - Use date-fns instead (smaller, modular)
- **joi** - Use zod instead (TypeScript-first, better type inference)
- **ws** - Use socket.io instead (higher-level API)
- **express v5** - Still in beta, use v4

### Directory Structure
All applications should follow this standardised structure:

```
app-root/
├── data/                 # All user/runtime data
│   ├── config/          # Configuration files
│   │   └── app.json     # Main app config
│   ├── logs/            # Application logs
│   ├── uploads/         # User uploads
│   └── temp/            # Temporary files
├── src/                 # Source code
├── web/                 # Frontend code
├── tests/               # Test files
├── scripts/             # Utility scripts
│   ├── dev-web.js       # Vite dev server
│   └── generate-certs.sh # HTTPS certificates
└── docs/                # Documentation
```

## Testing Standards

### Test Structure

```
tests/
├── unit/          # Fast, isolated tests
├── integration/   # API and service integration tests
├── e2e/           # Full end-to-end tests
└── fixtures/      # Test data and mocks
```

### Unit Testing

```typescript
import { describe, it, expect, jest } from '@jest/globals';

describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      const userData = { name: 'John', email: 'john@example.com' };
      const user = await userService.createUser(userData);
      
      expect(user).toMatchObject(userData);
      expect(user.id).toBeDefined();
    });

    it('should throw error for invalid data', async () => {
      const invalidData = { name: '' };
      
      await expect(userService.createUser(invalidData))
        .rejects.toThrow('Validation error');
    });
  });
});
```

### Integration Testing

```typescript
import request from 'supertest';
import { app } from '../src/server';

describe('API Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toMatchObject({
        status: 'healthy',
        version: expect.any(String)
      });
    });
  });
});
```

### Coverage Requirements

Minimum coverage thresholds:

```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

## Security Practices

### Security Headers

Use helmet for security headers:

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));
```

### Session Management

The framework provides flexible session management with memory and Redis options:

#### Memory Store (Default)
Suitable for desktop applications and development:

```typescript
import { configureSession } from '@episensor/app-framework';

// Uses in-memory sessions (default)
configureSession(app, {
  secret: 'your-session-secret',
  store: 'memory'
});
```

#### Redis Store (Optional for Production)
For applications requiring persistent sessions:

```typescript
import { configureSession, createRedisStore } from '@episensor/app-framework';

// 1. Install optional Redis dependencies first:
// npm install connect-redis redis

// 2. Create Redis store
const redisStore = await createRedisStore(); // Uses REDIS_URL env var or redis://localhost:6379
// Or with custom URL:
// const redisStore = await createRedisStore('redis://your-redis-server:6379');

// 3. Configure session with Redis
configureSession(app, {
  secret: process.env.SESSION_SECRET,
  store: redisStore
});
```

**Note**: Redis is completely optional. The framework gracefully falls back to memory store if Redis packages aren't installed.

### Authentication

Use framework's authentication middleware:

```typescript
import { createAuthMiddleware } from '@episensor/app-framework';

const auth = createAuthMiddleware({
  sessionSecret: config.sessionSecret,
  sessionTimeout: 30 * 60 * 1000 // 30 minutes
});

app.use(auth);
```

### Input Sanitization

Sanitize all user inputs:

```typescript
import DOMPurify from 'isomorphic-dompurify';

function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}
```

### Secrets Management

Never commit secrets to version control:

```typescript
// app.json - use placeholders
{
  "auth": {
    "sessionSecret": "CHANGE_IN_PRODUCTION"
  }
}

// Production: Use secure secret management service
```

## Performance Guidelines

### Caching Strategy

**Note**: Caching is optional for internal desktop applications with low user counts. Consider implementing only if:
- The app performs expensive computations repeatedly
- External API calls have rate limits
- Data rarely changes but is frequently accessed

```typescript
// Example when caching is beneficial
import { CacheService } from '@episensor/app-framework';

const cache = new CacheService({
  ttl: 300, // 5 minutes
  maxSize: 1000
});

// Cache expensive operations only when necessary
const getData = async (id: string) => {
  return cache.getOrSet(`data:${id}`, async () => {
    return await expensiveOperation(id);
  });
};
```

### Database Queries

Optimize database operations:

```typescript
// Use connection pooling
const pool = createPool({
  connectionLimit: 10,
  queueLimit: 0
});

// Use prepared statements
const query = 'SELECT * FROM users WHERE id = ?';
const [rows] = await pool.execute(query, [userId]);
```

### Resource Management

**Note**: For internal desktop applications, basic cleanup is sufficient. Complex process management, clustering, and supervision are not required.

```typescript
// Simple cleanup for internal apps
class ResourceManager {
  async cleanup() {
    // Close database connections
    // Clear intervals/timeouts
    // Close file handles
  }
}

// Basic shutdown handling
process.on('SIGTERM', () => {
  logger.info('Shutting down');
  process.exit(0);
});
```

## Deployment and Operations

### Health Checks

Implement comprehensive health endpoints:

```typescript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
    components: {
      database: await checkDatabase(),
      cache: await checkCache(),
      external: await checkExternalServices()
    }
  };
  
  const isHealthy = Object.values(health.components)
    .every(c => c.status === 'healthy');
  
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### Monitoring

Expose metrics for monitoring:

```typescript
import { collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics();

app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Logging Standards

Structured logging for operations:

```typescript
logger.info('Request received', {
  method: req.method,
  path: req.path,
  userId: req.user?.id,
  ip: req.ip
});

logger.error('Operation failed', {
  error: error.message,
  stack: error.stack,
  context: { userId, operation }
});
```

### Pre-commit Hooks

Use Husky for Git hooks management to ensure code quality before commits:

```bash
# Install Husky
npm install --save-dev husky
npx husky init

# Add pre-commit hook
echo '#!/usr/bin/env sh

# Run linting
echo "🔍 Running linter..."
npm run lint || {
  echo "❌ Linting failed. Please fix errors before committing."
  exit 1
}

# Run type checking
echo "📝 Running type check..."
npm run typecheck || {
  echo "❌ Type checking failed. Please fix errors before committing."
  exit 1
}

# Run tests
echo "🧪 Running tests..."
npm run test:unit || {
  echo "❌ Tests failed. Please fix failing tests before committing."
  exit 1
}

echo "✅ All checks passed!"' > .husky/pre-commit

chmod +x .husky/pre-commit
```

#### Alternative: lint-staged for Performance

For better performance on large codebases, use lint-staged to only check changed files:

```json
// package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml}": [
      "prettier --write"
    ]
  },
  "devDependencies": {
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  }
}
```

```bash
# .husky/pre-commit
#!/usr/bin/env sh
npx lint-staged
```

### Commit Message Standards

Enforce conventional commits for better automation:

```bash
# Install commitlint
npm install --save-dev @commitlint/config-conventional @commitlint/cli

# Configure commitlint
echo "module.exports = { extends: ['@commitlint/config-conventional'] };" > commitlint.config.js

# Add commit-msg hook
echo '#!/usr/bin/env sh
npx --no -- commitlint --edit ${1}' > .husky/commit-msg
chmod +x .husky/commit-msg
```

Commit message format:
```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc)
- `refactor`: Code refactoring
- `test`: Test additions or corrections
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### CI/CD Pipeline

Standard GitHub Actions workflow:

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run test:coverage
      - run: npm run build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm audit
      - run: npm run security:scan
```

## Migration Guide

For existing applications, follow these steps:

1. **Update package.json**
   - Rename package to @episensor scope
   - Add framework dependency
   - Update scripts

2. **Restructure directories**
   - Move to standard structure
   - Consolidate configuration

3. **Update imports**
   - Use framework services
   - Remove duplicate code

4. **Add tests**
   - Achieve 80% coverage
   - Add integration tests

5. **Update documentation**
   - Follow README template
   - Add API documentation

## Appendix

### Recommended VSCode Extensions

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "orta.vscode-jest",
    "christian-kohler.path-intellisense"
  ]
}
```

### Package.json Template

```json
{
  "name": "@episensor/app-name",
  "version": "1.0.0",
  "description": "Application description",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@episensor/app-framework": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "typescript": "^5.0.0",
    "tsx": "^3.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "eslint": "^8.0.0"
  }
}
```