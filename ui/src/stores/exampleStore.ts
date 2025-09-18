/**
 * Example Zustand Store Pattern
 * Demonstrates best practices for state management with Zustand
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * Example: Device Management Store
 * Shows how to manage complex state with Zustand
 */

// Types
interface Device {
  id: string;
  name: string;
  type: 'modbus' | 'bacnet' | 'mqtt';
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
  data?: Record<string, any>;
}

interface DeviceFilter {
  type?: Device['type'];
  status?: Device['status'];
  search?: string;
}

interface DeviceState {
  // State
  devices: Device[];
  selectedDeviceId: string | null;
  filter: DeviceFilter;
  loading: boolean;
  error: string | null;
  
  // Computed values (getters)
  get selectedDevice(): Device | undefined;
  get filteredDevices(): Device[];
  get onlineCount(): number;
  
  // Actions
  setDevices: (devices: Device[]) => void;
  addDevice: (device: Device) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  removeDevice: (id: string) => void;
  selectDevice: (id: string | null) => void;
  setFilter: (filter: DeviceFilter) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Async actions
  fetchDevices: () => Promise<void>;
  connectDevice: (id: string) => Promise<void>;
  disconnectDevice: (id: string) => Promise<void>;
  
  // Utilities
  reset: () => void;
}

// Initial state
const initialState = {
  devices: [],
  selectedDeviceId: null,
  filter: {},
  loading: false,
  error: null,
};

// Create store with middleware
export const useDeviceStore = create<DeviceState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // State
        ...initialState,
        
        // Computed values
        get selectedDevice() {
          const state = get();
          return state.devices.find(d => d.id === state.selectedDeviceId);
        },
        
        get filteredDevices() {
          const state = get();
          let filtered = [...state.devices];
          
          if (state.filter.type) {
            filtered = filtered.filter(d => d.type === state.filter.type);
          }
          
          if (state.filter.status) {
            filtered = filtered.filter(d => d.status === state.filter.status);
          }
          
          if (state.filter.search) {
            const search = state.filter.search.toLowerCase();
            filtered = filtered.filter(d => 
              d.name.toLowerCase().includes(search) ||
              d.id.toLowerCase().includes(search)
            );
          }
          
          return filtered;
        },
        
        get onlineCount() {
          return get().devices.filter(d => d.status === 'online').length;
        },
        
        // Synchronous actions
        setDevices: (devices) => set((state) => {
          state.devices = devices;
        }),
        
        addDevice: (device) => set((state) => {
          state.devices.push(device);
        }),
        
        updateDevice: (id, updates) => set((state) => {
          const device = state.devices.find(d => d.id === id);
          if (device) {
            Object.assign(device, updates);
          }
        }),
        
        removeDevice: (id) => set((state) => {
          state.devices = state.devices.filter(d => d.id !== id);
          if (state.selectedDeviceId === id) {
            state.selectedDeviceId = null;
          }
        }),
        
        selectDevice: (id) => set((state) => {
          state.selectedDeviceId = id;
        }),
        
        setFilter: (filter) => set((state) => {
          state.filter = filter;
        }),
        
        setLoading: (loading) => set((state) => {
          state.loading = loading;
        }),
        
        setError: (error) => set((state) => {
          state.error = error;
        }),
        
        // Async actions
        fetchDevices: async () => {
          const { setLoading, setError, setDevices } = get();
          
          setLoading(true);
          setError(null);
          
          try {
            const response = await fetch('/api/devices');
            if (!response.ok) throw new Error('Failed to fetch devices');
            
            const data = await response.json();
            setDevices(data);
          } catch (error) {
            setError((error as Error).message);
          } finally {
            setLoading(false);
          }
        },
        
        connectDevice: async (id) => {
          const { updateDevice, setError } = get();
          
          try {
            const response = await fetch(`/api/devices/${id}/connect`, {
              method: 'POST'
            });
            
            if (!response.ok) throw new Error('Failed to connect device');
            
            updateDevice(id, { status: 'online', lastSeen: new Date() });
          } catch (error) {
            setError((error as Error).message);
            updateDevice(id, { status: 'error' });
          }
        },
        
        disconnectDevice: async (id) => {
          const { updateDevice, setError } = get();
          
          try {
            const response = await fetch(`/api/devices/${id}/disconnect`, {
              method: 'POST'
            });
            
            if (!response.ok) throw new Error('Failed to disconnect device');
            
            updateDevice(id, { status: 'offline' });
          } catch (error) {
            setError((error as Error).message);
          }
        },
        
        // Utilities
        reset: () => set(initialState),
      })),
      {
        name: 'device-store', // Storage key
        partialize: (state) => ({
          // Only persist certain fields
          devices: state.devices,
          filter: state.filter,
        }),
      }
    ),
    {
      name: 'DeviceStore', // DevTools name
    }
  )
);

/**
 * Example: Simple Counter Store
 * Shows minimal Zustand setup
 */
interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

export const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}));

/**
 * Example: Auth Store with Subscriptions
 * Shows how to use subscriptions for side effects
 */
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        isAuthenticated: false,
        
        login: async (email, password) => {
          try {
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            
            if (!response.ok) throw new Error('Login failed');
            
            const data = await response.json();
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
            });
          } catch (error) {
            set({ user: null, token: null, isAuthenticated: false });
            throw error;
          }
        },
        
        logout: () => {
          set({ user: null, token: null, isAuthenticated: false });
        },
        
        refreshToken: async () => {
          const { token } = get();
          if (!token) throw new Error('No token to refresh');
          
          try {
            const response = await fetch('/api/auth/refresh', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            
            if (!response.ok) throw new Error('Token refresh failed');
            
            const data = await response.json();
            set({ token: data.token });
          } catch (error) {
            get().logout();
            throw error;
          }
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          token: state.token,
          user: state.user,
        }),
      }
    ),
    { name: 'AuthStore' }
  )
);

// Subscribe to auth changes
useAuthStore.subscribe(
  (state) => state.isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      // Clear other stores when logged out
      useDeviceStore.getState().reset();
    }
  }
);

/**
 * Example: Selectors for Performance
 * Use selectors to prevent unnecessary re-renders
 */
export const useSelectedDevice = () => 
  useDeviceStore((state) => state.selectedDevice);

export const useOnlineDevices = () => 
  useDeviceStore((state) => 
    state.devices.filter(d => d.status === 'online')
  );

export const useDeviceById = (id: string) => 
  useDeviceStore((state) => 
    state.devices.find(d => d.id === id)
  );

// Export all stores
export default {
  useDeviceStore,
  useCounterStore,
  useAuthStore,
  // Selectors
  useSelectedDevice,
  useOnlineDevices,
  useDeviceById,
};