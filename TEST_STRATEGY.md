# Comprehensive Test Strategy for EpiSensor Apps

This document outlines a testing strategy to catch runtime errors before reporting success, preventing issues like the ones encountered with epi-app-template.

## Problems Identified

1. **SocketProvider Duplicate Connections** - App was using its own SocketProvider instead of framework hooks
2. **SettingsFramework Undefined Error** - Categories prop was undefined/empty
3. **Logs API 404 Error** - Wrong API endpoint being called
4. **Missing Proper Integration Tests** - No tests to verify the app actually runs without console errors

## Test Strategy

### 1. Pre-Deployment Smoke Tests

Create a smoke test suite that verifies basic functionality:

```typescript
// tests/smoke/app-startup.test.ts
import { test, expect } from '@playwright/test';

test.describe('App Startup Smoke Tests', () => {
  test('should start without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Navigate to app
    await page.goto('http://localhost:7501');
    
    // Wait for app to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give React time to render
    
    // Check for console errors
    const allowedErrors = [
      'Download the React DevTools', // Dev warning, not an error
      'ExperimentalWarning' // Node.js warnings
    ];
    
    const realErrors = consoleErrors.filter(error => 
      !allowedErrors.some(allowed => error.includes(allowed))
    );
    
    expect(realErrors).toHaveLength(0);
  });
  
  test('should connect to WebSocket without errors', async ({ page }) => {
    await page.goto('http://localhost:7501');
    
    // Check for WebSocket connection
    const wsConnected = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Wait up to 5 seconds for connection
        const checkConnection = () => {
          const connectionIndicator = document.querySelector('[data-testid="connection-status"]');
          if (connectionIndicator?.textContent?.includes('Connected')) {
            resolve(true);
          }
        };
        
        const interval = setInterval(checkConnection, 100);
        setTimeout(() => {
          clearInterval(interval);
          resolve(false);
        }, 5000);
      });
    });
    
    expect(wsConnected).toBe(true);
  });
  
  test('should navigate to all main pages without errors', async ({ page }) => {
    const pages = [
      { path: '/', title: 'Home' },
      { path: '/settings', title: 'Settings' },
      { path: '/logs', title: 'Logs' }
    ];
    
    for (const pageInfo of pages) {
      await page.goto(`http://localhost:7501${pageInfo.path}`);
      await page.waitForLoadState('networkidle');
      
      // Verify page loaded
      const pageTitle = await page.textContent('h1');
      expect(pageTitle).toBeTruthy();
      
      // Check for error boundaries
      const errorBoundary = await page.locator('text=/error/i').count();
      expect(errorBoundary).toBe(0);
    }
  });
});
```

### 2. API Integration Tests

Verify all API endpoints are properly configured:

```typescript
// tests/integration/api.test.ts
import { test, expect } from 'vitest';
import { apiRequest } from '../src/utils/apiRequest';

test.describe('API Integration', () => {
  test('should fetch settings definitions', async () => {
    const response = await apiRequest('/api/settings/definitions');
    expect(response).toBeDefined();
    expect(Array.isArray(response)).toBe(true);
  });
  
  test('should fetch logs entries', async () => {
    const response = await apiRequest('/api/logs/entries');
    expect(response).toBeDefined();
    expect(response).toHaveProperty('logs');
  });
  
  test('should handle WebSocket connection', async () => {
    const socket = await connectSocket();
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });
});
```

### 3. Component Integration Tests

Test that framework components are properly integrated:

```typescript
// tests/integration/framework-components.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { SettingsPage } from '../src/pages/SettingsPage';
import { LogsPage } from '../src/pages/LogsPage';

test('SettingsPage should render with categories', async () => {
  render(<SettingsPage />);
  
  await waitFor(() => {
    expect(screen.queryByText('Loading settings...')).not.toBeInTheDocument();
  });
  
  // Should have at least one category
  const categories = screen.getAllByRole('button', { name: /general|network|logging/i });
  expect(categories.length).toBeGreaterThan(0);
});

test('LogsPage should use framework component', async () => {
  render(<LogsPage />);
  
  // Should render the framework's logs page structure
  await waitFor(() => {
    expect(screen.getByText(/current log/i)).toBeInTheDocument();
    expect(screen.getByText(/archives/i)).toBeInTheDocument();
  });
});
```

### 4. Pre-commit Hooks

Add pre-commit hooks to catch issues early:

```json
// package.json
{
  "scripts": {
    "pre-commit": "npm run lint && npm run type-check && npm run test:smoke"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run pre-commit"
    }
  }
}
```

### 5. GitHub Actions Workflow

Create a workflow that runs these tests:

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      
    - name: Start app
      run: |
        npm run dev &
        npx wait-on http://localhost:7501
        
    - name: Run smoke tests
      run: npm run test:smoke
      
    - name: Run integration tests
      run: npm run test:integration
```

### 6. Development Workflow

1. **Before Starting Development:**
   ```bash
   npm run test:smoke -- --watch
   ```

2. **Before Committing:**
   ```bash
   npm run test:all
   ```

3. **In CI/CD:**
   - Run full test suite
   - Deploy only if all tests pass

### 7. Test Script Updates

Update package.json with proper test scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:smoke": "playwright test tests/smoke",
    "test:integration": "vitest tests/integration",
    "test:all": "npm run test && npm run test:smoke && npm run test:integration",
    "test:watch": "vitest --watch",
    "dev:test": "concurrently \"npm run dev\" \"wait-on http://localhost:7501 && npm run test:smoke -- --watch\""
  }
}
```

## Implementation Checklist

- [ ] Create smoke test suite with Playwright
- [ ] Add API integration tests
- [ ] Add component integration tests
- [ ] Setup pre-commit hooks
- [ ] Configure GitHub Actions
- [ ] Update development documentation
- [ ] Train team on new workflow

## Benefits

1. **Catch Runtime Errors Early** - No more "works on my machine" issues
2. **Prevent Breaking Changes** - Tests catch when framework updates break apps
3. **Faster Development** - Immediate feedback on changes
4. **Higher Quality** - Consistent testing across all apps
5. **Better Developer Experience** - Clear feedback on what's broken

## Next Steps

1. Implement this strategy in epi-app-template first
2. Roll out to other apps (epi-cpcodebase, etc.)
3. Add to framework documentation
4. Create templates for common test scenarios
