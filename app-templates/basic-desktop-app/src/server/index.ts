import { StandardServer } from '@episensor/app-framework';

async function main() {
  // Create server with automatic desktop integration
  const server = new StandardServer({
    appName: 'myapp',  // Change this to your app name
    appVersion: '1.0.0',
    description: 'My Desktop App',
    port: 3005,
    webPort: 5173, // Vite dev server port
    // Desktop integration is auto-enabled when TAURI=1
    appId: 'com.episensor.myapp', // Change this to your app ID
    onInitialize: async (app) => {
      // Add your API routes here
      app.get('/api/hello', (req, res) => {
        res.json({ message: 'Hello from desktop app!' });
      });
    }
  });

  // Initialize and start the server
  await server.initialize();
  await server.start();

  // Log where data is stored
  console.log('📁 Data directory:', server.getDataPath());
  console.log('🖥️  Desktop mode:', server.isDesktopApp());
}

// Start the application
main().catch(console.error);