# Dynamic CORS Middleware

The framework provides intelligent CORS middleware that automatically configures allowed origins based on your environment and configuration.

## Quick Start

```typescript
import { StandardServer, createDynamicCors } from '@episensor/app-framework';

const server = new StandardServer({
  appName: 'My App',
  onInitialize: async (app) => {
    // Use dynamic CORS - automatically handles development and production
    app.use(createDynamicCors());
  }
});
```

## Available Functions

### `createDynamicCors(options?)`

Creates intelligent CORS middleware that:
- In **development**: Automatically allows all localhost origins and common dev ports
- In **production**: Only allows explicitly configured origins

```typescript
app.use(createDynamicCors({
  allowedOrigins: ['https://app.example.com'],
  devPortRanges: [
    { start: 3000, end: 3010 },
    { start: 5170, end: 5180 }
  ],
  commonDevPorts: [3000, 5173, 8080],
  credentials: true,
  customValidator: (origin) => origin.endsWith('.trusted.com')
}));
```

#### Options

- `allowedOrigins`: Explicitly allowed origins (used in all environments)
- `devPortRanges`: Port ranges to auto-allow in development
- `commonDevPorts`: Common ports to always allow in development (default: 3000, 3001, 5173, 5174, 5175, 8080, 8081)
- `credentials`: Whether to allow credentials (default: true)
- `customValidator`: Custom function to validate origins

### `createProductionCors(allowedDomains)`

Simple production CORS with specific allowed domains:

```typescript
app.use(createProductionCors([
  'https://app.example.com',
  'https://api.example.com'
]));
```

### `createDevCors()`

Permissive CORS for development - allows all localhost origins:

```typescript
if (process.env.NODE_ENV === 'development') {
  app.use(createDevCors());
}
```

## Environment-Based Behavior

### Development Mode
- Allows all localhost and 127.0.0.1 origins
- Allows configured port ranges
- Logs warnings for unrecognized origins but allows them
- Helpful for local development with multiple services

### Production Mode
- Only allows explicitly configured origins
- Checks custom validators
- Rejects unknown origins with clear error messages
- Secure by default

## Integration with Config

Use with the framework's ConfigManager for dynamic configuration:

```typescript
import { initializeConfig, getAllConfig } from './config';
import { createDynamicCors } from '@episensor/app-framework';

await initializeConfig();
const config = getAllConfig();

app.use(createDynamicCors({
  allowedOrigins: config.cors?.allowedOrigins || [],
  devPortRanges: [
    { start: config.web.port - 5, end: config.web.port + 5 },
    { start: config.api.port - 5, end: config.api.port + 5 }
  ]
}));
```

## Examples

### Basic Development Setup

```typescript
// Automatically allows localhost:3000-3010, 5170-5180, 8080-8090
app.use(createDynamicCors());
```

### Production with Multiple Domains

```typescript
app.use(createDynamicCors({
  allowedOrigins: [
    'https://app.mycompany.com',
    'https://dashboard.mycompany.com',
    'https://mobile.mycompany.com'
  ]
}));
```

### Custom Validation Logic

```typescript
app.use(createDynamicCors({
  customValidator: (origin) => {
    // Allow any subdomain of mycompany.com
    const regex = /^https:\/\/[\w-]+\.mycompany\.com$/;
    return regex.test(origin);
  }
}));
```

### With Specific Port Ranges

```typescript
app.use(createDynamicCors({
  devPortRanges: [
    { start: 3000, end: 3005 },  // API servers
    { start: 5000, end: 5010 },  // Frontend dev servers
    { start: 8080, end: 8085 }   // Additional services
  ]
}));
```

## Migration from Hard-Coded CORS

### Before (Hard-coded origins)
```typescript
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
```

### After (Dynamic CORS)
```typescript
app.use(createDynamicCors());
// Automatically handles all common development ports
// and production configuration
```

## Security Considerations

1. **Production Safety**: In production, only explicitly allowed origins are permitted
2. **No Wildcards**: Never use `origin: '*'` in production
3. **Credentials**: Be careful when allowing credentials with CORS
4. **Logging**: The middleware logs rejected origins in production for security monitoring

## Troubleshooting

### CORS Errors in Development
If you're getting CORS errors in development:
1. Check that your port is in the common ports or configured ranges
2. Ensure the middleware is added before your routes
3. Check the console for CORS debug messages

### CORS Errors in Production
1. Ensure your domain is in `allowedOrigins`
2. Check that `NODE_ENV=production` is set
3. Verify the origin includes the protocol (https://)
4. Check server logs for rejected origin messages

### Testing CORS
The middleware exposes the origin function for testing:

```typescript
const middleware = createDynamicCors();
const originFunction = (middleware as any)._originFunction;
// Use originFunction in tests
```