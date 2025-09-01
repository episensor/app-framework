# Architectural Patterns

This document provides proven patterns for building complex features with the EpiSensor App Framework. These patterns prevent common pitfalls and ensure consistent, maintainable architectures.

## Table of Contents

- [Stateful Services Pattern](#stateful-services-pattern)
- [Data Persistence Pattern](#data-persistence-pattern)
- [Background Jobs Pattern](#background-jobs-pattern)
- [Real-time Updates Pattern](#real-time-updates-pattern)
- [Frontend State Management Pattern](#frontend-state-management-pattern)

## Stateful Services Pattern

Use this pattern for creating intelligent, stateful services that need to maintain state and provide regular updates (like simulators, monitors, or processors).

### When to Use
- Building simulators or emulators
- Creating monitoring services
- Implementing stateful business logic
- Managing periodic background tasks

### Implementation

```typescript
// src/services/intelligentModule.ts
import { EventEmitter } from 'events';
import { createLogger } from '@episensor/app-framework/core';

export interface ModuleState {
  isRunning: boolean;
  lastUpdate: Date;
  // Add your state properties
}

export abstract class IntelligentModule extends EventEmitter {
  protected state: ModuleState;
  protected logger = createLogger(this.constructor.name);
  private tickInterval?: NodeJS.Timeout;
  
  constructor(
    protected name: string,
    protected tickRateMs: number = 1000
  ) {
    super();
    this.state = {
      isRunning: false,
      lastUpdate: new Date()
    };
  }
  
  // Abstract methods to implement
  abstract tick(): Promise<void>;
  abstract getOutputData(): Record<string, any>;
  
  start(): void {
    if (this.state.isRunning) return;
    
    this.state.isRunning = true;
    this.tickInterval = setInterval(() => {
      this.tick().catch(error => {
        this.logger.error(`Tick error in ${this.name}:`, error);
        this.emit('error', error);
      });
    }, this.tickRateMs);
    
    this.logger.info(`${this.name} started`);
    this.emit('started');
  }
  
  stop(): void {
    if (!this.state.isRunning) return;
    
    this.state.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    
    this.logger.info(`${this.name} stopped`);
    this.emit('stopped');
  }
  
  getState(): ModuleState {
    return { ...this.state };
  }
}
```

### Example Usage

```typescript
// src/services/batterySimulator.ts
import { IntelligentModule } from './intelligentModule';

interface BatteryState extends ModuleState {
  chargeLevel: number;
  temperature: number;
  isCharging: boolean;
}

export class BatterySimulator extends IntelligentModule {
  protected state: BatteryState;
  
  constructor() {
    super('BatterySimulator', 5000); // 5 second tick
    this.state = {
      ...this.state,
      chargeLevel: 100,
      temperature: 25,
      isCharging: false
    };
  }
  
  async tick(): Promise<void> {
    // Update battery state
    if (this.state.isCharging) {
      this.state.chargeLevel = Math.min(100, this.state.chargeLevel + 1);
    } else {
      this.state.chargeLevel = Math.max(0, this.state.chargeLevel - 0.5);
    }
    
    this.state.lastUpdate = new Date();
    this.emit('stateChanged', this.getOutputData());
  }
  
  getOutputData(): Record<string, any> {
    return {
      charge: this.state.chargeLevel,
      temp: this.state.temperature,
      charging: this.state.isCharging,
      timestamp: this.state.lastUpdate.toISOString()
    };
  }
  
  setCharging(charging: boolean): void {
    this.state.isCharging = charging;
  }
}
```

## Data Persistence Pattern

Use this pattern for services that need to persist data with proper error handling and atomic updates.

### When to Use
- Saving user preferences or settings
- Persisting application state
- Creating data that survives restarts
- Implementing configuration management

### Implementation

```typescript
// src/services/persistentDataService.ts
import { getSecureFileHandler } from '@episensor/app-framework/core';
import { createLogger } from '@episensor/app-framework/core';

export class PersistentDataService<T> {
  private data: T;
  private fileHandler = getSecureFileHandler();
  private logger = createLogger('PersistentDataService');
  private saveTimeout?: NodeJS.Timeout;
  
  constructor(
    private filename: string,
    private defaultData: T,
    private debounceMs: number = 1000
  ) {
    this.data = { ...defaultData };
  }
  
  async initialize(): Promise<void> {
    try {
      const saved = await this.fileHandler.readFile(this.filename, 'data');
      this.data = { ...this.defaultData, ...saved };
      this.logger.info(`Loaded data from ${this.filename}`);
    } catch (error) {
      this.logger.info(`No existing data found, using defaults`);
      await this.save(); // Create initial file
    }
  }
  
  getData(): T {
    return { ...this.data };
  }
  
  updateData(partial: Partial<T>): void {
    this.data = { ...this.data, ...partial };
    this.debouncedSave();
  }
  
  setData(newData: T): void {
    this.data = { ...newData };
    this.debouncedSave();
  }
  
  private debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.save().catch(error => {
        this.logger.error('Failed to save data:', error);
      });
    }, this.debounceMs);
  }
  
  async save(): Promise<void> {
    await this.fileHandler.saveFile(this.filename, this.data, 'data');
    this.logger.debug(`Data saved to ${this.filename}`);
  }
  
  async reset(): Promise<void> {
    this.data = { ...this.defaultData };
    await this.save();
  }
}
```

### Example Usage

```typescript
// src/services/appConfigService.ts
interface AppConfig {
  theme: 'light' | 'dark';
  autoSave: boolean;
  refreshRate: number;
}

const configService = new PersistentDataService<AppConfig>(
  'app-config.json',
  {
    theme: 'light',
    autoSave: true,
    refreshRate: 5000
  }
);

// In your app initialization
await configService.initialize();

// Usage
configService.updateData({ theme: 'dark' });
const config = configService.getData();
```

## Background Jobs Pattern

Use the QueueService for reliable background processing with proper error handling and retry logic.

### When to Use
- Processing file uploads
- Sending notifications
- Running reports
- Data synchronization tasks

### Implementation

```typescript
// src/services/notificationService.ts
import { QueueService } from '@episensor/app-framework/services';
import { createLogger } from '@episensor/app-framework/core';

export interface NotificationJob {
  type: 'email' | 'push' | 'sms';
  recipient: string;
  message: string;
  priority?: 'high' | 'normal' | 'low';
}

export class NotificationService {
  private queue = new QueueService();
  private logger = createLogger('NotificationService');
  
  constructor() {
    // Start the queue processor
    this.queue.start();
    
    // Register job handlers
    this.queue.addProcessor('notification', this.processNotification.bind(this));
  }
  
  async sendNotification(notification: NotificationJob): Promise<void> {
    const priority = notification.priority === 'high' ? 1 : 
                    notification.priority === 'low' ? 10 : 5;
    
    await this.queue.addJob('notification', notification, {
      priority,
      retryAttempts: 3,
      retryDelay: 5000
    });
    
    this.logger.info(`Queued ${notification.type} notification to ${notification.recipient}`);
  }
  
  private async processNotification(job: any): Promise<void> {
    const { type, recipient, message } = job.data as NotificationJob;
    
    try {
      switch (type) {
        case 'email':
          await this.sendEmail(recipient, message);
          break;
        case 'push':
          await this.sendPush(recipient, message);
          break;
        case 'sms':
          await this.sendSms(recipient, message);
          break;
      }
      
      this.logger.info(`Sent ${type} notification to ${recipient}`);
    } catch (error) {
      this.logger.error(`Failed to send ${type} notification:`, error);
      throw error; // Will trigger retry
    }
  }
  
  private async sendEmail(recipient: string, message: string): Promise<void> {
    // Implement email sending logic
  }
  
  private async sendPush(recipient: string, message: string): Promise<void> {
    // Implement push notification logic
  }
  
  private async sendSms(recipient: string, message: string): Promise<void> {
    // Implement SMS logic
  }
}
```

## Real-time Updates Pattern

Combine WebSocket events with frontend state management for live updates.

### Backend Implementation

```typescript
// In your StandardServer setup
import { createWebSocketServer } from '@episensor/app-framework/services';

// After server initialization
const wsServer = createWebSocketServer(httpServer);

// Broadcast updates to specific rooms
wsServer.broadcast({
  event: 'batteryUpdate',
  data: batteryData,
  simulatorId: 'battery-sim-1' // Optional: room-specific
});
```

### Frontend Implementation

```typescript
// src/stores/batteryStore.ts
import { create } from 'zustand';
import { useSocketIO } from '@episensor/app-framework/ui';

interface BatteryState {
  charge: number;
  temperature: number;
  isCharging: boolean;
  lastUpdate?: Date;
}

interface BatteryStore {
  batteries: Record<string, BatteryState>;
  setBatteryData: (id: string, data: BatteryState) => void;
}

export const useBatteryStore = create<BatteryStore>((set) => ({
  batteries: {},
  setBatteryData: (id, data) =>
    set((state) => ({
      batteries: {
        ...state.batteries,
        [id]: { ...data, lastUpdate: new Date() }
      }
    }))
}));

// In your component
export function BatteryDashboard() {
  const { batteries, setBatteryData } = useBatteryStore();
  const { socket } = useSocketIO();
  
  useEffect(() => {
    if (!socket) return;
    
    const handleBatteryUpdate = (data: any) => {
      setBatteryData(data.simulatorId, data.data);
    };
    
    socket.on('batteryUpdate', handleBatteryUpdate);
    
    return () => {
      socket.off('batteryUpdate', handleBatteryUpdate);
    };
  }, [socket, setBatteryData]);
  
  // Render logic
}
```

## Frontend State Management Pattern

Use Zustand with the framework's apiRequest utility for consistent API communication.

### Implementation

```typescript
// src/stores/deviceStore.ts
import { create } from 'zustand';
import { apiRequest } from '@episensor/app-framework/ui';

interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
}

interface DeviceStore {
  devices: Device[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchDevices: () => Promise<void>;
  updateDevice: (id: string, updates: Partial<Device>) => Promise<void>;
  createDevice: (device: Omit<Device, 'id'>) => Promise<void>;
}

export const useDeviceStore = create<DeviceStore>((set, get) => ({
  devices: [],
  loading: false,
  error: null,
  
  fetchDevices: async () => {
    set({ loading: true, error: null });
    
    try {
      const response = await apiRequest('/api/devices');
      set({ devices: response.data, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch devices',
        loading: false 
      });
    }
  },
  
  updateDevice: async (id, updates) => {
    try {
      const response = await apiRequest(`/api/devices/${id}`, {
        method: 'PATCH',
        body: updates
      });
      
      set(state => ({
        devices: state.devices.map(device =>
          device.id === id ? { ...device, ...response.data } : device
        )
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update device' });
      throw error;
    }
  },
  
  createDevice: async (deviceData) => {
    try {
      const response = await apiRequest('/api/devices', {
        method: 'POST',
        body: deviceData
      });
      
      set(state => ({
        devices: [...state.devices, response.data]
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create device' });
      throw error;
    }
  }
}));
```

## Best Practices Summary

1. **Always use framework utilities** - Don't re-implement `apiRequest`, validation, or file handling
2. **Follow the single responsibility principle** - Each service should have one clear purpose
3. **Use proper error handling** - Catch errors, log them, and provide user feedback
4. **Implement graceful degradation** - Services should handle failures elegantly
5. **Use TypeScript interfaces** - Define clear contracts between components
6. **Emit events for state changes** - Allow other components to react to changes
7. **Implement proper cleanup** - Clear intervals, close connections, remove listeners

These patterns will help you build robust, maintainable applications that leverage the full power of the EpiSensor App Framework.