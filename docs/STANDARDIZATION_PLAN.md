# Standardization & Manual Testing Plan

## Top 5 Areas for Standardization

### 1. 🔧 Environment Configuration
**Current State**: Inconsistent - only 1/5 apps have .env.example
**Target**: All apps should have .env.example with standard variables

**Standards to Implement**:
```bash
# .env.example template
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
LOG_FORMAT=json
API_PREFIX=/api
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=
REDIS_URL=
```

**Action Items**:
- Create .env.example for all apps
- Standardize port assignments (see Port Allocation below)
- Document all environment variables
- Add validation for required env vars

### 2. 📝 Logging & Monitoring
**Current State**: Using framework logger but inconsistent implementation
**Target**: Standardized logging with structured output

**Standards to Implement**:
- Consistent log levels (debug, info, warn, error)
- Structured JSON logging in production
- Request ID tracking
- Performance metrics logging
- Error tracking with stack traces

**Implementation**:
```typescript
// Standard logging setup
import { createLogger } from '@episensor/app-framework';

const logger = createLogger('ServiceName');

// Consistent patterns
logger.info('Server started', { port, environment });
logger.error('Operation failed', { error, context });
```

### 3. 🚪 Port Allocation & Service Discovery
**Current State**: No documented port strategy
**Target**: Consistent port allocation across all services

**Port Allocation Standard**:
```
3000 - epi-app-template (reference)
3001 - epi-vpp-manager
3002 - epi-node-programmer
3003 - epi-modbus-simulator
3004 - epi-cpcodebase
3005 - epi-competitor-ai
5173 - Frontend dev server (Vite default)
```

### 4. 🚀 Startup & Shutdown Procedures
**Current State**: Inconsistent entry points and shutdown handling
**Target**: Graceful startup/shutdown with health checks

**Standards to Implement**:
- Consistent entry point: `src/index.ts`
- Health check endpoint: `/health`
- Graceful shutdown handling
- Startup dependency checks
- Ready state reporting

**Template**:
```typescript
// src/index.ts
import { StandardServer } from '@episensor/app-framework';

const server = new StandardServer({
  appName: 'app-name',
  port: process.env.PORT || 3000,
  onShutdown: async () => {
    // Cleanup code
  }
});

await server.start();
```

### 5. 🧪 API Documentation & Testing
**Current State**: No standardized API documentation
**Target**: OpenAPI/Swagger for all APIs

**Standards to Implement**:
- OpenAPI 3.0 specification
- Swagger UI at `/api-docs`
- Postman collections for testing
- Example requests/responses
- API versioning strategy

---

## Manual Testing Plan

### Testing Infrastructure Setup

```typescript
// test-runner.ts
import { chromium } from 'playwright';
import axios from 'axios';
import { spawn } from 'child_process';

class AppTester {
  async startApp(appDir: string, port: number) {
    const process = spawn('npm', ['run', 'dev'], {
      cwd: appDir,
      env: { ...process.env, PORT: port.toString() }
    });

    // Wait for app to be ready
    await this.waitForHealth(`http://localhost:${port}/health`);
    return process;
  }

  async testEndpoints(baseUrl: string) {
    // Test health
    // Test API endpoints
    // Check for errors in logs
  }
}
```

### Test Scenarios for Each App

#### 1. epi-vpp-manager (Port 3001)
**Purpose**: Virtual Power Plant management

**Test Checklist**:
- [ ] Start server on port 3001
- [ ] Verify health endpoint responds
- [ ] Test WebSocket connection
- [ ] Create VPP configuration via API
- [ ] Retrieve VPP status
- [ ] Test real-time updates
- [ ] Check error handling for invalid data
- [ ] Verify graceful shutdown

**API Tests**:
```bash
# Health check
curl http://localhost:3001/health

# Get VPP status
curl http://localhost:3001/api/vpp/status

# Create configuration
curl -X POST http://localhost:3001/api/vpp/config \
  -H "Content-Type: application/json" \
  -d '{"name": "Test VPP", "capacity": 1000}'
```

**Browser Tests**:
```typescript
test('VPP Manager UI', async ({ page }) => {
  await page.goto('http://localhost:3001');
  await expect(page).toHaveTitle(/VPP Manager/);
  await page.click('button:has-text("Create VPP")');
  // Check for form validation
  // Submit valid data
  // Verify success message
});
```

#### 2. epi-node-programmer (Port 3002)
**Purpose**: IoT node configuration and programming

**Test Checklist**:
- [ ] Start server on port 3002
- [ ] Test device discovery endpoint
- [ ] Upload firmware via API
- [ ] Monitor programming progress
- [ ] Test batch programming
- [ ] Verify error recovery
- [ ] Check logging output
- [ ] Test connection limits

**API Tests**:
```bash
# Discover devices
curl http://localhost:3002/api/devices/discover

# Upload firmware
curl -X POST http://localhost:3002/api/firmware/upload \
  -F "file=@firmware.bin"

# Program device
curl -X POST http://localhost:3002/api/devices/program \
  -d '{"deviceId": "123", "firmwareId": "abc"}'
```

#### 3. epi-modbus-simulator (Port 3003)
**Purpose**: Modbus device simulation

**Test Checklist**:
- [ ] Start server on port 3003
- [ ] Create Modbus slave device
- [ ] Write/read registers
- [ ] Test coil operations
- [ ] Simulate device errors
- [ ] Test concurrent connections
- [ ] Monitor performance metrics
- [ ] Verify data persistence

**API Tests**:
```bash
# Create simulator
curl -X POST http://localhost:3003/api/simulators \
  -d '{"name": "Test PLC", "slaveId": 1}'

# Write register
curl -X POST http://localhost:3003/api/simulators/1/registers \
  -d '{"address": 40001, "value": 100}'

# Read registers
curl http://localhost:3003/api/simulators/1/registers?start=40001&count=10
```

#### 4. epi-cpcodebase (Port 3004)
**Purpose**: Codebase analysis and documentation

**Test Checklist**:
- [ ] Start server on port 3004
- [ ] Scan project directory
- [ ] Generate documentation
- [ ] Test search functionality
- [ ] Export analysis results
- [ ] Check memory usage with large repos
- [ ] Test concurrent analysis
- [ ] Verify caching behavior

**API Tests**:
```bash
# Analyze codebase
curl -X POST http://localhost:3004/api/analyze \
  -d '{"path": "/Users/brendan/Code/epi-app-framework"}'

# Search code
curl "http://localhost:3004/api/search?q=StandardServer"

# Get metrics
curl http://localhost:3004/api/metrics
```

#### 5. epi-competitor-ai (Port 3005)
**Purpose**: Competitor analysis with AI

**Test Checklist**:
- [ ] Start server on port 3005
- [ ] Add competitor via API
- [ ] Trigger website crawl
- [ ] Test AI analysis
- [ ] Monitor progress via WebSocket
- [ ] Export analysis report
- [ ] Test rate limiting
- [ ] Verify data storage

**API Tests**:
```bash
# Add competitor
curl -X POST http://localhost:3005/api/competitors \
  -d '{"name": "Test Corp", "website": "https://example.com"}'

# Start analysis
curl -X POST http://localhost:3005/api/analysis/start \
  -d '{"competitorId": "123"}'

# Get results
curl http://localhost:3005/api/analysis/results/123
```

### Automated Testing Script

```typescript
// run-all-tests.ts
import { TestRunner } from './test-runner';

const apps = [
  { name: 'epi-vpp-manager', port: 3001 },
  { name: 'epi-node-programmer', port: 3002 },
  { name: 'epi-modbus-simulator', port: 3003 },
  { name: 'epi-cpcodebase', port: 3004 },
  { name: 'epi-competitor-ai', port: 3005 }
];

async function runTests() {
  const runner = new TestRunner();
  const results = [];

  for (const app of apps) {
    console.log(`Testing ${app.name}...`);
    const result = await runner.testApp(app);
    results.push(result);
  }

  // Generate report
  generateReport(results);
}
```

### Log Analysis Checklist

For each app, monitor for:
- [ ] Startup errors or warnings
- [ ] Deprecation warnings
- [ ] Unhandled promise rejections
- [ ] Memory leak indicators
- [ ] Slow query warnings
- [ ] Failed dependency connections
- [ ] CORS or security errors
- [ ] Rate limiting triggers

### Performance Metrics to Track

- Startup time
- Memory usage at idle
- Memory usage under load
- Response time percentiles (p50, p95, p99)
- Concurrent connection limits
- Database connection pool usage
- WebSocket connection stability
- Error rate per endpoint

### Bug Hunting Strategies

1. **Boundary Testing**
   - Maximum payload sizes
   - Unicode and special characters
   - Negative numbers
   - Empty arrays/objects
   - Null values

2. **Concurrency Testing**
   - Simultaneous requests
   - Race conditions
   - Lock contentions
   - Connection pool exhaustion

3. **Error Recovery**
   - Database disconnection
   - Network timeouts
   - Invalid input data
   - Missing dependencies

4. **Security Testing**
   - SQL injection attempts
   - XSS payloads
   - Path traversal
   - JWT validation
   - Rate limiting bypass

### Reporting Template

```markdown
## Test Report - [App Name]
Date: [Date]
Version: [Version]

### Summary
- Health Check: ✅/❌
- API Tests Passed: X/Y
- UI Tests Passed: X/Y
- Performance: Good/Issues Found
- Stability: Stable/Issues Found

### Issues Found
1. [Issue description]
   - Severity: High/Medium/Low
   - Steps to reproduce
   - Expected vs Actual
   - Suggested fix

### Recommendations
- [Improvement suggestions]

### Logs
[Relevant log excerpts]
```

## Implementation Timeline

### Week 1: Environment & Logging
- Create .env.example files
- Implement structured logging
- Add log aggregation

### Week 2: Ports & Startup
- Standardize port allocation
- Implement health checks
- Add graceful shutdown

### Week 3: API Documentation
- Generate OpenAPI specs
- Setup Swagger UI
- Create Postman collections

### Week 4: Manual Testing
- Run all test scenarios
- Document findings
- Create bug tickets

### Week 5: Automation
- Implement automated tests
- Setup CI/CD integration
- Create monitoring dashboards