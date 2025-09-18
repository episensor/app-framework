# Framework vs Template Demarcation

This document clarifies the separation between the EpiSensor App Framework and application templates.

## Overview

The EpiSensor ecosystem consists of two main components:

1. **@episensor/app-framework** - A generic, MIT-licensed framework for building structured desktop applications
2. **epi-app-template** - An EpiSensor-specific template that adds company branding and standards

## Framework (@episensor/app-framework)

### Purpose
Provides core functionality for building production-ready desktop applications with TypeScript, React, and Tauri.

### Contains
- **Core Services**
  - Logging system (file rotation, compression, archiving)
  - Configuration management (Zod validation, hot reload)
  - Port utilities and management
  - Secure file operations
  
- **Middleware**
  - Authentication and session management
  - Request validation
  - Error handling
  - File upload handling
  - Health checks
  - CORS configuration
  
- **UI Components** (without branding)
  - Base components (Button, Card, Input, etc.)
  - Layout components (AppShell, Navigation)
  - Advanced components (SettingsFramework, LogViewer)
  - React hooks for common patterns
  
- **Services**
  - WebSocket management (generic, not simulator-specific)
  - Queue service for background jobs
  - AI service integration
  - Update service
  
- **Desktop Support**
  - Tauri integration helpers
  - Cross-platform utilities

### Does NOT Contain
- Company-specific branding (logos, colors)
- Company-specific configurations
- Port assignments for specific apps
- Example/demo code
- Company-specific middleware or services

### License
MIT - Can be used by anyone for any purpose

## Template (epi-app-template)

### Purpose
Provides a ready-to-use starting point for EpiSensor internal applications with company standards pre-configured.

### Contains
- **Branding**
  - EpiSensor logo assets
  - Company color scheme (#E21350 primary)
  - Styled components using company theme
  
- **Configuration**
  - Port assignments following company standards
  - Pre-configured app.json with sensible defaults
  - Company-specific environment variables
  
- **Example Code**
  - Sample API routes showing best practices
  - Example pages demonstrating UI patterns
  - WebSocket integration examples
  - File upload examples
  
- **Project Structure**
  - Standard directory layout
  - Pre-configured TypeScript settings
  - Testing setup with examples
  - CI/CD workflows for internal deployment

### Does NOT Contain
- Core framework functionality (uses @episensor/app-framework)
- Generic utilities or services
- Reusable components (beyond styling)

### License
MIT (but intended for internal use)

## Key Principles

1. **Framework is Generic**: No EpiSensor-specific references in code, only in documentation for context
2. **Template is Thin**: Minimal code, mostly configuration and branding
3. **No Duplication**: If something is useful across apps, it belongs in the framework
4. **Clear Dependencies**: Template depends on framework, never the reverse

## Migration Guide

When building a new app:

1. **Internal EpiSensor App**: Clone epi-app-template
2. **External App**: Use @episensor/app-framework directly

When contributing:

1. **Generic functionality**: Add to framework
2. **EpiSensor-specific**: Add to template
3. **Unsure?**: If it would be useful to non-EpiSensor users, it belongs in the framework

## Examples

### Belongs in Framework
- Generic WebSocket service
- File upload middleware
- Configuration management
- Logging utilities
- UI components (unstyled)
- Authentication patterns

### Belongs in Template
- EpiSensor logo and brand colors
- Port assignments (e.g., app X uses port 7000)
- Example API routes
- Company-specific configurations
- Styled versions of framework components
