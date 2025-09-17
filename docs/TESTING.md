# Testing Standards

## Overview

All EpiSensor applications should follow these standardized testing practices using utilities provided by `@episensor/app-framework`.

## Test Categories

Every application should have the following test categories:

### 1. Unit Tests (`tests/unit/`)
- Test individual functions and modules in isolation
- Mock external dependencies
- Fast execution, no network or file I/O
- Coverage target: 80%

### 2. Integration Tests (`tests/integration/`)
- Test interaction between modules
- Test API endpoints with real server
- Test database/file operations
- May use test databases or fixtures

### 3. Smoke Tests (`tests/smoke/`)
- Basic sanity checks
- Verify application starts correctly
- Check critical dependencies
- Health endpoint availability
- Should run quickly (< 10 seconds total)

### 4. E2E Tests (`tests/e2e/`)
- Full user workflow testing
- UI interaction testing with Playwright
- Real browser automation
- Test complete features end-to-end

### 5. System Tests (`tests/system/`)
- Test system-level integration
- External service integration
- Performance testing
- Load testing

## Test Setup

### Using Framework TestServer

All applications should use the framework's `TestServer` utility for consistent test server management:

```javascript
// tests/setup.js
import { setupTestServer, teardownTestServer, getTestServer } from '@episensor/app-framework';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup test server for all tests
beforeAll(async () => {
  await setupTestServer({
    entryPoint: path.join(__dirname, '../src/index.ts'),
    port: YOUR_TEST_PORT,
    healthEndpoint: '/api/health',
    startupTimeout: 30000,
    silent: !process.env.DEBUG
  });
}, 30000);

// Cleanup after all tests
afterAll(async () => {
  await teardownTestServer();
}, 10000);
```

### Vitest Recommendation

Vitest is the preferred test runner for new and migrated codebases. When
bringing a project up to the latest standards, set up `vitest.config.ts`, wire
the scripts (`test`, `test:run`, `test:coverage`), and rely on the framework's
helpers under the `testing/` directory.

### Jest Configuration

Standard Jest configuration for all apps:

```javascript
// tests/jest.config.js
export default {
  testEnvironment: 'node',
  
  // ES modules support
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Test patterns
  testMatch: [
    '<rootDir>/**/*.test.js',
    '<rootDir>/**/*.test.ts'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/fixtures/',
    '/manual/'
  ],
  
  // Setup files
  setupFilesAfterEnv: ['./setup.js'],
  
  // Timeouts
  testTimeout: 15000,
  
  // Coverage
  collectCoverage: true,
  collectCoverageFrom: [
    '../src/**/*.{js,ts}',
    '!../src/**/*.test.{js,ts}',
    '!../src/index.ts'
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  
  // Options
  clearMocks: true,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true
};
```

## Test Scripts

Standard npm scripts for testing:

```json
{
  "scripts": {
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest --config=tests/jest.config.js",
    "test:unit": "npm test -- tests/unit",
    "test:integration": "npm test -- tests/integration",
    "test:smoke": "npm test -- tests/smoke",
    "test:e2e": "cd tests/e2e && npx playwright test",
    "test:coverage": "npm test -- --coverage",
    "test:watch": "npm test -- --watch"
  }
}
```

## Directory Structure

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── smoke/          # Smoke tests
├── e2e/           # End-to-end tests
├── system/        # System tests
├── fixtures/      # Test data and fixtures
├── setup.js       # Jest setup file
├── jest.config.js # Jest configuration
└── README.md      # Test documentation
```

## Best Practices

1. **Use Framework Utilities**: Always use `TestServer` from the framework for consistency
2. **Isolate Test Data**: Each test should create and clean up its own data
3. **Parallel Execution**: Tests should be able to run in parallel
4. **Deterministic**: Tests should produce same results every run
5. **Fast Feedback**: Unit and smoke tests should run in < 10 seconds
6. **Clear Names**: Test names should describe what is being tested and expected outcome
7. **Single Responsibility**: Each test should verify one behaviour
8. **No Hard-coded Ports**: Use configuration for ports and URLs

## Coverage Requirements

All applications should maintain minimum coverage:

- **Unit Tests**: 80% coverage
- **Integration Tests**: 60% coverage
- **Overall**: 70% coverage

## Framework vs Application Testing

### Framework Responsibilities
- Provide `TestServer` utility for server management
- Provide mock utilities for common services
- Provide test helpers for API testing
- Handle test environment setup

### Application Responsibilities
- Write tests for application-specific logic
- Configure test server with correct entry points
- Maintain test fixtures and data
- Ensure coverage requirements are met

## Migration Guide

To migrate existing tests to use framework utilities:

1. Install latest `@episensor/app-framework`
2. Replace custom server management with `TestServer`
3. Update `setup.js` to use `setupTestServer` and `teardownTestServer`
4. Remove redundant test utilities that framework provides
5. Ensure all test categories are present
6. Update coverage thresholds to meet standards
