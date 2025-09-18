# Framework Architecture

## Overview

The EpiSensor Application Framework is a comprehensive full-stack TypeScript framework designed for building industrial IoT applications. It provides a robust foundation with built-in support for real-time communication, desktop deployment via Tauri, and extensive device simulation capabilities.

## Architecture Principles

### 1. Clear Separation of Concerns
- **Backend (`src/`)**: Server-side logic, APIs, and business services
- **Frontend (`ui/`)**: React-based user interface components
- **Desktop (`desktop/`)**: Tauri configuration for desktop deployment

### 2. Modular Service Architecture
- Core server functionality managed by `StandardServer`
- Pluggable services and middleware
- Event-driven communication via WebSockets

### 3. Configuration-Driven
- Centralized configuration management
- Environment-aware settings
- Runtime configuration updates

## Current Directory Structure

```
epi-app-framework/
├── src/                        # Backend Source Code
│   ├── core/                   # Core Framework Components
│   │   ├── StandardServer.ts   # Main server orchestration
│   │   └── logger.ts          # Logging service with rotation
│   │
│   ├── services/              # Business Services
│   │   ├── aiService.ts       # AI integration service
│   │   ├── settingsService.ts # Settings management
│   │   ├── conversationStorage.ts  # Conversation persistence
│   │   ├── crossPlatformBuffer.ts  # Cross-platform data handling
│   │   ├── fileHandler.ts     # File operations service
│   │   ├── modbusService.ts   # Modbus device simulation
│   │   ├── networkService.ts  # Network interface management
│   │   ├── queueService.ts    # Message queue service
│   │   ├── settingsService.ts # Application settings management
│   │   ├── websocketEvents.ts # WebSocket event patterns
│   │   └── websocketServer.ts # WebSocket server implementation
│   │
│   ├── middleware/            # Express Middleware
│   │   ├── auth.ts           # Authentication middleware
│   │   ├── errorHandler.ts   # Error handling
│   │   ├── aiErrorHandler.ts # AI-specific error handling
│   │   ├── fileUpload.ts     # File upload handling
│   │   ├── health.ts         # Health check endpoints
│   │   ├── rateLimit.ts      # Rate limiting
│   │   ├── session.ts        # Session management
│   │   ├── validation.ts     # Request validation (Zod-based)
│   │   └── index.ts          # Middleware exports
│   │
│   ├── routes/               # API Routes
│   │   ├── modbus.ts        # Modbus API endpoints
│   │   ├── network.ts       # Network API endpoints
│   │   └── index.ts         # Route exports
│   │
│   ├── utils/               # Backend Utilities
│   │   ├── apiResponse.ts   # Standardized API responses
│   │   ├── port.ts          # Port availability checking
│   │   └── startupBanner.ts # Application startup display
│   │
│   └── types/               # TypeScript Type Definitions
│       └── express.d.ts     # Express type extensions
│
├── ui/                      # Frontend Source Code
│   ├── src/
│   │   ├── components/      # React Components
│   │   │   ├── common/     # Reusable components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Container.tsx
│   │   │   │   ├── Dialog.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Loading.tsx
│   │   │   │   ├── ScrollArea.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   └── Textarea.tsx
│   │   │   ├── layout/     # Layout components
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── MainLayout.tsx
│   │   │   │   └── Navigation.tsx
│   │   │   ├── features/   # Feature-specific components
│   │   │   │   ├── ConfigurationView.tsx
│   │   │   │   ├── ConnectionStatus.tsx
│   │   │   │   ├── ModbusView.tsx
│   │   │   │   └── NetworkStatus.tsx
│   │   │   └── pages/      # Page components
│   │   │       ├── HomePage.tsx
│   │   │       ├── LoginPage.tsx
│   │   │       └── SettingsPage.tsx
│   │   │
│   │   ├── hooks/          # Custom React Hooks
│   │   │   ├── useAPI.ts
│   │   │   ├── useAuth.ts
│   │   │   ├── useConfig.ts
│   │   │   └── useSocketIO.ts
│   │   │
│   │   ├── styles/         # CSS Styles
│   │   │   ├── globals.css
│   │   │   └── themes/
│   │   │       ├── dark.css
│   │   │       └── light.css
│   │   │
│   │   ├── lib/           # Frontend Libraries
│   │   │   └── utils.ts   # Utility functions
│   │   │
│   │   ├── App.tsx        # Main React application
│   │   ├── main.tsx       # Application entry point
│   │   └── vite-env.d.ts  # Vite type definitions
│   │
│   ├── utils/             # UI Utilities
│   │   ├── auth.ts        # Authentication utilities
│   │   ├── authHandler.ts # Auth event handling
│   │   └── cn.ts          # Class name utilities
│   │
│   ├── index.html         # HTML entry point
│   ├── package.json       # Frontend dependencies
│   ├── tsconfig.json      # TypeScript config
│   └── vite.config.ts     # Vite bundler config
│
├── desktop/               # Desktop Application (Tauri)
│   ├── src-tauri/        # Tauri backend (Rust)
│   │   ├── src/
│   │   │   └── main.rs   # Tauri main process
│   │   ├── Cargo.toml    # Rust dependencies
│   │   └── tauri.conf.json # Tauri configuration
│   │
│   └── icons/            # Application icons
│       └── icon.png
│
├── tests/                # Test Suites
│   ├── unit/            # Unit tests
│   │   ├── core/        # Core component tests
│   │   ├── middleware/  # Middleware tests
│   │   ├── services/    # Service tests
│   │   └── utils/       # Utility tests
│   │
│   └── integration/     # Integration tests
│       └── api/         # API endpoint tests
│
├── docs/                # Documentation
│   ├── ARCHITECTURE.md  # This file
│   ├── DEVELOPMENT.md   # Development guide
│   ├── STANDARDS.md     # Coding standards
│   └── api/            # Generated API docs
│
├── scripts/            # Build and utility scripts
├── .github/            # GitHub Actions workflows
├── coverage/           # Test coverage reports
├── dist/              # Compiled output
├── jest.config.ts     # Jest test configuration
├── tsconfig.json      # Root TypeScript config
└── package.json       # Root dependencies
```

## Key Components

### Backend Architecture

#### StandardServer (`src/core/StandardServer.ts`)
The central orchestration component that:
- Initializes Express application
- Sets up middleware pipeline
- Manages HTTP/HTTPS servers
- Integrates WebSocket server
- Handles graceful shutdown
- Provides lifecycle hooks (`onInitialize`, `onStart`, `onShutdown`)

#### Service Layer
Services are singleton instances providing specific functionality:
- **ConfigManager**: Hierarchical configuration with hot-reload
- **WebSocketServer**: Real-time bidirectional communication
- **ModbusService**: Industrial protocol simulation
- **AIService**: AI model integration (OpenAI, Claude)
- **FileHandler**: User file uploads via HTTP (simpler API)
- **SecureFileHandler**: Internal data persistence with path sanitization
- **NetworkService**: Network interface detection
- **SettingsService**: Runtime settings management

##### File Handling Strategy
The framework provides two file handlers for different use cases:
- **FileHandler** (`services/fileHandler.ts`): Used for HTTP file uploads, simpler API
- **SecureFileHandler** (`core/secureFileHandler.ts`): Used for internal data persistence with path sanitization and validation

#### Middleware Pipeline
Middleware components process requests in order:
1. Session management
2. CORS handling
3. Authentication
4. Rate limiting
5. Request validation
6. Business logic
7. Error handling

### Frontend Architecture

#### React Application
- **Component Library**: Built on shadcn/ui components
- **Routing**: React Router for navigation
- **State Management**: React hooks and context
- **Styling**: Tailwind CSS with theme support
- **Build Tool**: Vite for fast development

#### WebSocket Integration
Real-time updates via Socket.IO:
- Connection status monitoring
- Live data streaming
- Event-based communication
- Automatic reconnection

### Desktop Deployment

#### Tauri Integration
- Rust-based backend for native performance
- Secure IPC communication
- Small bundle size
- Cross-platform support (Windows, macOS, Linux)

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Tauri     │────▶│   React UI  │────▶│   Backend   │
│   Desktop   │     │   (Vite)    │     │   (Node.js) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       │                   ▼                    │
       │            ┌─────────────┐            │
       └───────────▶│  WebSocket  │◀───────────┘
                    │   Events     │
                    └─────────────┘
```

## Configuration Management

### Configuration Hierarchy
1. Default configuration (built-in)
2. Environment-specific config files
3. Environment variables
4. Runtime updates via API

### Key Configuration Areas
- Server settings (port, host, SSL)
- Database connections
- API keys and secrets
- Feature flags
- Logging levels

## Security Architecture

### Authentication & Authorization
- Session-based authentication
- JWT token support
- Role-based access control (RBAC)
- API key authentication for services

### Security Middleware
- CORS configuration
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection

## Development Workflow

### Local Development
```bash
# Backend development
npm run dev

# Frontend development
cd ui && npm run dev

# Desktop development
cd desktop && npm run tauri dev
```

### Testing Strategy
- Unit tests for individual components
- Integration tests for API endpoints
- E2E tests for critical user flows
- Performance benchmarks for services

### Build & Deployment
```bash
# Production build
npm run build

# Desktop application
cd desktop && npm run tauri build

# Docker deployment
docker build -t epi-framework .
```

## Extension Points

### Adding New Services
1. Create service in `src/services/`
2. Implement singleton pattern
3. Register in `StandardServer`
4. Add corresponding routes
5. Create tests

### Adding New Middleware
1. Create middleware in `src/middleware/`
2. Export from `middleware/index.ts`
3. Configure in server initialization
4. Add tests

### Adding UI Components
1. Create component in `ui/src/components/`
2. Add to feature or page
3. Include styling
4. Add Storybook story (if applicable)

## Performance Considerations

### Backend Optimization
- Connection pooling for databases
- Redis caching for sessions
- Message queue for async operations
- Horizontal scaling support

### Frontend Optimization
- Code splitting
- Lazy loading
- Virtual scrolling for large lists
- WebSocket connection pooling

## Monitoring & Observability

### Logging
- Structured logging with levels
- Log rotation and archival
- Centralized log aggregation support

### Metrics
- Health check endpoints
- Performance metrics
- Resource utilization
- Error tracking

## Future Enhancements

### Planned Features
- GraphQL API support
- Microservices architecture
- Kubernetes deployment
- Advanced AI integrations
- Plugin marketplace

### Technology Upgrades
- Migration to ESM modules
- Deno runtime support
- WebAssembly integration
- Edge computing capabilities