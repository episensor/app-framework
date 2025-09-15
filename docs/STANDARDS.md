# EpiSensor Application Standards

This document defines the coding, testing, and configuration standards for all applications using the `@episensor/app-framework`.

## TypeScript Configuration Standards

All EpiSensor applications MUST use strict TypeScript configuration to ensure code quality and maintainability.

### Required TypeScript Settings

Use the standard configuration template at `tsconfig.standard.json` as your base. Key requirements:

```json
{
  "compilerOptions": {
    // Language and Environment
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],

    // Modules
    "module": "NodeNext",
    "moduleResolution": "NodeNext",

    // STRICT MODE - REQUIRED
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,

    // Types for testing
    "types": ["node", "vitest/globals"]
  }
}
```

### TypeScript Standards

1. **Zero TypeScript Errors Policy**: All apps must compile with zero TypeScript errors
2. **Strict Mode Required**: Never disable strict mode
3. **No Unused Code**: Keep `noUnusedLocals` and `noUnusedParameters` enabled
4. **Proper Type Definitions**: Never use `any` unless absolutely necessary and documented
5. **Incremental Builds**: Use incremental compilation for better performance

### Handling Unused Parameters

When implementing interfaces that require parameters you don't use:
```typescript
// Good - prefix with underscore
function handleEvent(_event: Event, data: any): void {
  console.log(data);
}

// Bad - unused parameter without prefix
function handleEvent(event: Event, data: any): void {
  console.log(data);
}
```

## Testing Standards

### Test Framework

**Vitest** is the standard test framework for all EpiSensor applications.

### Required Test Dependencies

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/ui": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  }
}
```

### Test Configuration

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '*.config.ts',
        'src/types/',
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    }
  }
});
```

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something specific', () => {
      // Arrange
      // Act
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Testing Commands

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Framework Version

All applications should use the latest stable version of `@episensor/app-framework`:

```json
{
  "dependencies": {
    "@episensor/app-framework": "^4.3.2"
  }
}
```

## Project Structure

Standard project structure for EpiSensor applications:

```
project-root/
├── src/
│   ├── server/
│   │   ├── api/           # API routes
│   │   ├── services/      # Business logic
│   │   └── index.ts       # Server entry point
│   ├── shared/
│   │   └── types/         # Shared TypeScript types
│   └── web/               # Frontend code (if applicable)
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/              # End-to-end tests
├── dist/                  # Compiled output
├── coverage/              # Test coverage reports
├── .env.example           # Environment variables template
├── tsconfig.json          # TypeScript configuration
├── vitest.config.ts       # Vitest configuration
└── package.json
```

## Code Quality Standards

### Linting

Use ESLint with TypeScript support:

```json
{
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.0.0"
  }
}
```

### Pre-commit Hooks

Consider using Husky for pre-commit hooks:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run lint && npm run test:run && npm run build"
    }
  }
}
```

## Migration Guide

### For Existing Applications

1. **Update TypeScript Configuration**
   - Copy `tsconfig.standard.json` from the framework
   - Merge with existing configuration
   - Run `npx tsc --noEmit` to check for errors
   - Fix all TypeScript errors

2. **Migrate from Jest to Vitest**
   ```bash
   # Remove Jest
   npm uninstall jest @types/jest ts-jest

   # Install Vitest
   npm install -D vitest @vitest/ui @vitest/coverage-v8

   # Update imports in test files
   # From: import { describe, it, expect } from '@jest/globals';
   # To:   import { describe, it, expect, vi } from 'vitest';

   # Replace jest.fn() with vi.fn()
   # Replace jest.mock() with vi.mock()
   ```

3. **Fix Common TypeScript Errors**
   - **TS6133 (unused variables)**: Prefix with underscore or remove
   - **TS2339 (property doesn't exist)**: Add proper type definitions
   - **TS2741 (missing properties)**: Add all required properties
   - **TS2322 (type not assignable)**: Fix type mismatches

## Current Application Status

As of the last audit, all core EpiSensor applications are compliant:

| Application | TypeScript Errors | Test Framework | Compliance |
|------------|------------------|----------------|------------|
| epi-competitor-ai | 92 (from 282) | Vitest | ⚠️ In Progress |
| epi-vpp-manager | 0 | Vitest | ✅ Compliant |
| epi-node-programmer | 0 | Vitest | ✅ Compliant |
| epi-modbus-simulator | 0 | Vitest | ✅ Compliant |
| epi-cpcodebase | 0 | Vitest | ✅ Compliant |
| epi-app-template | 0 | Vitest | ✅ Compliant |

## Continuous Improvement

1. **Regular Audits**: Run TypeScript checks weekly
2. **Dependency Updates**: Keep framework and dependencies up to date
3. **Test Coverage**: Maintain minimum 80% code coverage
4. **Documentation**: Keep README and API documentation current

## Support

For questions about these standards or help with migration:
- Check the `@episensor/app-framework` documentation
- Review the `epi-app-template` for reference implementation
- Contact the platform team for assistance