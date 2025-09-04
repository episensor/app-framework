# Application Directory Structure Standard

## Standard Directory Layout

```
project-root/
├── src/                        # Backend source code
│   ├── api/                    # REST API endpoints
│   │   ├── health.ts           # Health check endpoint (required)
│   │   ├── settings.ts         # Settings management (required)
│   │   └── [feature].ts        # Feature-specific endpoints
│   ├── config/                 # Configuration management
│   │   ├── configSchema.ts     # Zod validation schemas
│   │   └── defaults.ts         # Default configuration values
│   ├── core/                   # Core business logic
│   │   └── [Domain]Service.ts  # Core service implementations
│   ├── features/               # Feature modules
│   │   └── [feature]/          # Feature-specific module
│   │       ├── service.ts      # Business logic
│   │       ├── types.ts        # TypeScript types
│   │       └── validation.ts   # Input validation
│   ├── infrastructure/         # Cross-cutting concerns
│   │   ├── database.ts         # Database connections
│   │   ├── cache.ts            # Caching layer
│   │   └── monitoring.ts       # Performance monitoring
│   ├── middleware/             # Express middleware
│   │   ├── auth.ts             # Authentication
│   │   ├── errorHandler.ts     # Error handling
│   │   └── validation.ts       # Request validation
│   ├── services/               # External service integrations
│   │   ├── WebSocketAdapter.ts # WebSocket management
│   │   └── [Service]Client.ts  # External API clients
│   ├── types/                  # TypeScript type definitions
│   │   ├── index.ts            # Main type exports
│   │   └── [domain].ts         # Domain-specific types
│   ├── utils/                  # Utility functions
│   │   ├── validation.ts       # Validation helpers
│   │   └── formatting.ts       # Data formatting
│   ├── index.ts                # Application entry point
│   └── setupApp.ts             # Application setup and configuration
│
├── web/                        # Frontend application
│   ├── src/
│   │   ├── components/         # Reusable React components
│   │   │   ├── common/         # Generic components
│   │   │   └── [feature]/      # Feature-specific components
│   │   ├── pages/              # Page components (routes)
│   │   │   ├── HomePage.tsx    # Landing page
│   │   │   ├── SettingsPage.tsx # Settings page (required)
│   │   │   └── [Feature]Page.tsx
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useWebSocket.ts # WebSocket connection hook
│   │   │   └── use[Feature].ts # Feature-specific hooks
│   │   ├── lib/                # Frontend utilities
│   │   │   ├── api.ts          # API client
│   │   │   ├── store.ts        # State management
│   │   │   └── constants.ts    # Application constants
│   │   ├── config/             # Frontend configuration
│   │   │   └── routes.ts       # Route definitions
│   │   ├── types/              # TypeScript types
│   │   │   └── index.ts        # Type exports
│   │   ├── App.tsx             # Main React component
│   │   ├── main.tsx            # React entry point
│   │   └── index.css           # Global styles
│   ├── public/                 # Static assets
│   │   └── favicon.ico
│   ├── index.html              # HTML template
│   ├── package.json            # Frontend dependencies
│   ├── tsconfig.json           # TypeScript config
│   ├── vite.config.ts          # Vite configuration
│   └── tailwind.config.js      # Tailwind CSS config
│
├── tests/                      # Test suites
│   ├── unit/                   # Unit tests
│   │   └── [module].test.ts
│   ├── integration/            # Integration tests
│   │   └── api.test.ts
│   ├── e2e/                    # End-to-end tests
│   │   ├── playwright.config.ts
│   │   └── [feature].spec.ts
│   ├── smoke/                  # Smoke tests
│   │   └── startup.test.ts
│   ├── helpers/                # Test utilities
│   │   ├── setup.ts
│   │   └── mocks.ts
│   └── fixtures/               # Test data
│       └── [data].json
│
├── data/                       # Application data (gitignored)
│   ├── config/                 # Runtime configuration
│   │   └── app.json
│   ├── logs/                   # Application logs
│   ├── temp/                   # Temporary files
│   └── uploads/                # User uploads
│
├── docs/                       # Documentation
│   ├── API.md                  # API documentation
│   ├── SETUP.md                # Setup instructions
│   └── ARCHITECTURE.md         # Architecture overview
│
├── scripts/                    # Build and utility scripts
│   ├── build.js                # Build script
│   └── dev.js                  # Development script
│
├── .github/                    # GitHub configuration
│   └── workflows/              # CI/CD workflows
│       ├── test.yml
│       └── deploy.yml
│
├── src-tauri/                  # Tauri desktop app (optional)
│   ├── src/
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── .env.example                # Environment variables template
├── .eslintrc.json              # ESLint configuration
├── .gitignore                  # Git ignore rules
├── .prettierrc                 # Prettier configuration
├── CHANGELOG.md                # Version history
├── LICENSE                     # License file
├── README.md                   # Project documentation
├── jest.config.js              # Jest configuration
├── nodemon.json                # Nodemon configuration
├── package.json                # Root dependencies
└── tsconfig.json               # TypeScript configuration
```

## Naming Conventions

### Files and Directories
- **Directories**: lowercase with hyphens (e.g., `feature-name/`)
- **TypeScript files**: camelCase or PascalCase based on export
  - Services/Classes: PascalCase (e.g., `WorkflowService.ts`)
  - Utilities/Functions: camelCase (e.g., `validation.ts`)
  - React Components: PascalCase (e.g., `HomePage.tsx`)
- **Configuration files**: lowercase with dots (e.g., `jest.config.js`)
- **Documentation**: UPPERCASE for important docs (e.g., `README.md`)

### Code Conventions
- **Interfaces**: PascalCase with 'I' prefix optional (e.g., `IUserData` or `UserData`)
- **Types**: PascalCase (e.g., `ApiResponse`)
- **Classes**: PascalCase (e.g., `DatabaseService`)
- **Functions**: camelCase (e.g., `getUserById`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- **React Hooks**: camelCase with 'use' prefix (e.g., `useWebSocket`)

## Required Files

### Backend (Minimum)
```
src/
├── api/
│   ├── health.ts              # Health check endpoint
│   └── settings.ts            # Settings management
├── index.ts                   # Entry point
└── setupApp.ts                # App configuration
```

### Frontend (Minimum)
```
web/src/
├── pages/
│   └── SettingsPage.tsx       # Settings UI
├── lib/
│   └── api.ts                 # API client
├── App.tsx                    # Main component
└── main.tsx                   # Entry point
```

### Configuration (Required)
```
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript config
├── .gitignore                 # Git ignore rules
└── README.md                  # Documentation
```

## Standard Scripts in package.json

```json
{
  "scripts": {
    "dev": "Run development server",
    "build": "Build for production",
    "start": "Start production server",
    "test": "Run all tests",
    "test:unit": "Run unit tests",
    "test:integration": "Run integration tests",
    "test:e2e": "Run end-to-end tests",
    "test:coverage": "Generate test coverage",
    "lint": "Run ESLint",
    "typecheck": "Run TypeScript compiler check",
    "format": "Format code with Prettier"
  }
}
```

## Environment Variables

### Standard Variables
```bash
# Server Configuration
NODE_ENV=development|production|test
PORT=3000                      # API port
WEB_PORT=3001                  # Web UI port

# Logging
LOG_LEVEL=debug|info|warn|error
LOG_DIR=./data/logs

# Security
SESSION_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3001

# Database (if applicable)
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Feature Flags
ENABLE_FEATURE_X=true
```

## Data Directory Structure

```
data/
├── config/                    # Runtime configuration
│   └── app.json              # Application settings
├── logs/                      # Log files
│   ├── app.log               # Current log
│   └── app-2024-01-01.log    # Rotated logs
├── temp/                      # Temporary files
│   └── .gitkeep
└── uploads/                   # User uploaded files
    └── .gitkeep
```

## Gitignore Rules

```gitignore
# Dependencies
node_modules/
*.lock
package-lock.json

# Build outputs
dist/
build/
*.tsbuildinfo

# Runtime data
data/
!data/.gitkeep
logs/
*.log

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Testing
coverage/
*.coverage
test-results/
playwright-report/

# Temporary
temp/
tmp/
*.tmp
```

## Migration Checklist

When migrating an existing application:

- [ ] Reorganize source files to match structure
- [ ] Standardize file naming conventions
- [ ] Add required endpoints (health, settings)
- [ ] Update package.json scripts
- [ ] Create setupApp.ts for initialization
- [ ] Add proper TypeScript configuration
- [ ] Set up standard test structure
- [ ] Configure environment variables
- [ ] Add comprehensive .gitignore
- [ ] Update documentation to standard format
- [ ] Remove development artifacts
- [ ] Verify all imports still work
- [ ] Run tests to ensure functionality