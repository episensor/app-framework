# EpiSensor App Framework Architecture

## Overview

The EpiSensor App Framework is an opinionated TypeScript framework for building structured desktop applications with web technologies. It provides a comprehensive foundation with built-in support for:

- Production-ready server infrastructure
- Real-time communication (WebSockets)
- Desktop packaging via Tauri
- Comprehensive UI component library
- Enterprise-grade logging and configuration

## Core Philosophy

**"Structured Vibe Coding"** - Build applications quickly without sacrificing quality or maintainability. The framework is opinionated about structure but flexible in implementation.

## Architecture Principles

### 1. Opinionated but Flexible
- Strong conventions for common patterns
- Escape hatches when needed
- Minimal boilerplate

### 2. Production-Ready by Default
- Enterprise logging with rotation and archival
- Health monitoring and metrics
- Graceful shutdown and error handling
- Security best practices built-in

### 3. Desktop-First Design
- Seamless Tauri integration
- Cross-platform file handling
- Native desktop features when available
- Web fallbacks for development

### 4. Real-Time Capable
- WebSocket support out of the box
- Event-driven architecture
- Scalable with Redis adapter support

## Framework Structure

```
@episensor/app-framework/
├── src/                     # Backend/Server Code
│   ├── core/               # Core Services
│   │   ├── StandardServer.ts      # Main server class
│   │   ├── enhancedLogger.ts      # Logging system
│   │   ├── portUtils.ts           # Port management
│   │   ├── secureFileHandler.ts   # File operations
│   │   └── webSocketManager.ts    # WebSocket management
│   │
│   ├── services/           # Application Services  
│   │   ├── configManager.ts       # Configuration with hot-reload
│   │   ├── settingsService.ts     # Dynamic settings management
│   │   ├── queueService.ts        # Background job processing
│   │   ├── aiService.ts           # AI provider integrations
│   │   └── updateService.ts       # Application updates
│   │
│   ├── middleware/         # Express Middleware
│   │   ├── auth.ts                # Authentication/Authorization
│   │   ├── validation.ts          # Request validation (Zod)
│   │   ├── fileUpload.ts          # Secure file uploads
│   │   ├── health.ts              # Health check endpoints
│   │   └── session.ts             # Session management
│   │
│   └── utils/              # Utilities
│       ├── startupBanner.ts       # Application startup display
│       └── standardConfig.ts      # Common Zod schemas
│
└── ui/                     # Frontend/UI Code
    ├── src/
    │   ├── components/     # React Components
    │   │   ├── base/              # Buttons, Inputs, Cards, etc.
    │   │   ├── layout/            # AppShell, Navigation
    │   │   └── advanced/          # LogViewer, SettingsFramework
    │   │
    │   ├── hooks/          # React Hooks
    │   │   ├── useWebSocket.ts    # WebSocket connection
    │   │   └── useDebounce.ts     # Debouncing hook
    │   │
    │   └── utils/          # UI Utilities
    │       └── format.ts          # Date/number formatting
    │
    └── styles/             # Global Styles
        └── globals.css            # Tailwind + custom CSS
```

## Key Components

### StandardServer

The heart of the framework - handles all server orchestration:

```typescript
const server = new StandardServer({
  appName: 'My App',
  port: 8080,
  enableWebSocket: true,
  onInitialize: async (app) => {
    // Add routes and middleware
  },
  onStart: async () => {
    // Startup logic
  }
});
```

Features:
- Automatic port conflict resolution
- Graceful shutdown handling
- Health monitoring integration
- WebSocket server setup
- Desktop mode detection

### Enhanced Logger

Production-grade logging with:
- Console + file output
- Daily rotation with compression
- Automatic archival
- Category-based logging
- Structured log format

### Configuration Management

Type-safe configuration with:
- Zod schema validation
- Hot-reload support
- Environment variable merging
- File watching
- Change events

### WebSocket Manager

Comprehensive real-time support:
- Namespace management
- Room support
- Redis adapter for scaling
- Authentication hooks
- Automatic reconnection

### UI Component Library

40+ React components including:
- Base components (shadcn/ui based)
- Layout components (AppShell)
- Advanced components (LogViewer, SettingsFramework)
- Full TypeScript support
- Dark mode support

## Integration Patterns

### Desktop Applications (Tauri)

The framework automatically detects Tauri environment and:
- Configures CORS for `tauri://localhost`
- Enables file system access
- Provides native dialogs
- Manages sidecar processes

### Web Applications

When running as a web app:
- Standard Express server
- Production middleware
- Static file serving
- API-only mode available

### Hybrid Development

During development:
- Backend on one port
- Frontend dev server on another
- Hot module replacement
- Automatic proxy configuration

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Server    │────▶│  Services   │
│  (UI/Tauri) │◀────│  (Express)  │◀────│ (Business)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │                    │
       └────────────────────┴────────────────────┘
                    WebSocket Connection
```

## Security Considerations

- Input validation on all endpoints
- Secure session management with Redis support
- File upload restrictions and virus scanning hooks
- CORS configuration per environment
- Authentication middleware with role support
- Rate limiting capabilities

## Performance Features

- Response compression
- Static file caching
- WebSocket message compression
- Connection pooling
- Background job queuing
- Efficient file streaming

## Deployment Patterns

### Desktop (Recommended)
- Build with Tauri
- Distribute as native installers
- Auto-update support
- Code signing ready

### Docker
- Multi-stage builds
- Health check endpoints
- Environment configuration
- Volume support for data

### Traditional Server
- PM2 configuration
- Systemd service files
- Nginx reverse proxy
- SSL/TLS ready
