# Migration Guide

## For Framework Maintainers

### When to Add Code to the Framework

Ask yourself these questions:

1. **Is it useful across multiple apps?** → Framework
2. **Is it EpiSensor-specific?** → Template or App
3. **Is it a common pattern?** → Framework
4. **Is it business logic?** → App

### Code That Belongs in Framework

✅ **Infrastructure**
- Server management (StandardServer)
- Logging systems
- Configuration management
- Port utilities
- File handling

✅ **Common Middleware**
- Authentication/Authorization
- Request validation
- Error handling
- Health checks
- CORS setup

✅ **Generic Services**
- WebSocket management
- Queue/Job processing
- Cache management
- Email sending
- File uploads

✅ **UI Components** (without branding)
- Base components (Button, Input, Card)
- Layout components (AppShell, Navigation)
- Complex components (DataTable, LogViewer)
- Utility hooks (useWebSocket, useDebounce)

### Code That Does NOT Belong in Framework

❌ **Company-Specific**
- EpiSensor branding/colors
- Company logos or assets
- Internal API endpoints
- Company-specific auth providers

❌ **Business Logic**
- Domain-specific services
- Business rules
- App-specific workflows
- Custom data models

❌ **Example/Demo Code**
- Sample implementations
- Tutorial code
- Specific use cases
- Test data generators

## For App Developers

### Starting a New EpiSensor App

1. Clone `epi-app-template`
2. Update `app.json` with your app details
3. Remove example code you don't need
4. Add your business logic

### When You Find Missing Framework Features

If you need something generic that's not in the framework:

1. **Check if it exists** - Search the framework docs/code
2. **Implement locally first** - Get it working in your app
3. **Consider contributing** - If it's truly generic, propose adding it
4. **Submit a PR** - Move the generic parts to framework

### Common Patterns

#### Adding a New API Endpoint

```typescript
// In your app (not framework)
app.get('/api/my-business-logic', async (req, res) => {
  // Use framework services
  const logger = createLogger('MyAPI');
  const config = getConfigManager();
  
  // Your business logic here
});
```

#### Adding a New Service

Generic service? → Framework
Business service? → Your app

```typescript
// Generic (Framework)
export class EmailService {
  send(to: string, subject: string, body: string) {
    // Generic email sending
  }
}

// Business (App)
export class InvoiceService {
  async sendInvoice(customerId: string) {
    // Business-specific logic
  }
}
```

#### Adding UI Components

Generic component? → Framework
Styled for EpiSensor? → Use framework component with theme

```typescript
// Use framework component with EpiSensor styling
import { Button } from '@episensor/app-framework/ui';

// The AppShell already accepts primaryColor
<AppShell primaryColor="#E21350">
  <Button>Click me</Button>
</AppShell>
```

## Migration Checklist

When reviewing code, check:

- [ ] Is this code EpiSensor-specific?
- [ ] Could other apps use this?
- [ ] Is there a more generic version?
- [ ] Does the framework already have something similar?
- [ ] Am I duplicating framework functionality?

## Examples of Good Separation

### ✅ Good: Generic Error Handler in Framework

```typescript
// Framework: Generic error handling
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  res.status(status).json({
    error: err.message,
    ...(isDev && { stack: err.stack })
  });
}
```

### ✅ Good: Business Logic in App

```typescript
// App: Specific business rules
app.post('/api/orders', async (req, res) => {
  // EpiSensor-specific order processing
  if (req.body.amount > 10000) {
    await notifyManager(req.body);
  }
  // ... business logic
});
```

### ❌ Bad: Company Colors in Framework

```typescript
// DON'T put this in framework
const EPISENSOR_PINK = '#E21350';
```

### ❌ Bad: Generic Utilities in App

```typescript
// This belongs in framework
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
```
