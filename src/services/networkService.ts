/**
 * Network Service
 * Detects and manages network interfaces
 */

import os from 'os';
import fs from 'fs';
import net from 'net';

interface NetworkAddress {
  address: string;
  family: string;
  internal: boolean;
}

interface NetworkInterface {
  name: string;
  addresses: NetworkAddress[];
}

interface BindingOption {
  label: string;
  value: string;
  description: string;
  interface: string;
}

interface NetworkInfo {
  hostname: string;
  primaryIp: string | null;
  interfaces: NetworkInterface[];
  bindingOptions: BindingOption[];
}

class NetworkService {
  /**
   * Get all available network interfaces with their addresses
   */
  getNetworkInterfaces(): NetworkInterface[] {
    const interfaces = os.networkInterfaces();
    const result: NetworkInterface[] = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;
      
      const validAddresses = addresses
        .filter(addr => addr.family === 'IPv4' && !addr.internal)
        .map(addr => ({
          address: addr.address,
          family: addr.family,
          internal: addr.internal
        }));

      if (validAddresses.length > 0) {
        result.push({
          name,
          addresses: validAddresses
        });
      }
    }

    // Always include localhost option
    result.unshift({
      name: 'localhost',
      addresses: [{
        address: '127.0.0.1',
        family: 'IPv4',
        internal: true
      }]
    });

    // Always include all interfaces option
    result.unshift({
      name: 'all',
      addresses: [{
        address: '0.0.0.0',
        family: 'IPv4',
        internal: false
      }]
    });

    return result;
  }

  /**
   * Get a formatted list of binding options for UI
   */
  getBindingOptions(): BindingOption[] {
    const interfaces = this.getNetworkInterfaces();
    const options: BindingOption[] = [];

    // Always add default binding options first
    options.push({
      value: '0.0.0.0',
      label: 'All interfaces',
      description: 'Listen on all available network interfaces',
      interface: 'all'
    });

    options.push({
      value: '127.0.0.1',
      label: 'Localhost only',
      description: 'Only accessible from this machine',
      interface: 'localhost'
    });

    // Add specific interface options (excluding duplicates of the default options)
    for (const iface of interfaces) {
      for (const addr of iface.addresses) {
        // Skip if this address is already in our default options
        if (addr.address === '0.0.0.0' || addr.address === '127.0.0.1') {
          continue;
        }
        
        options.push({
          label: `${iface.name} (${addr.address})`,
          value: addr.address,
          description: `Accept connections on ${iface.name} network interface`,
          interface: iface.name
        });
      }
    }

    return options;
  }

  /**
   * Get the current machine's primary IP address
   */
  getPrimaryIpAddress(): string | null {
    const interfaces = this.getNetworkInterfaces();
    
    // Look for the first non-localhost, non-all interface
    for (const iface of interfaces) {
      if (iface.name === 'localhost' || iface.name === 'all') continue;
      
      for (const addr of iface.addresses) {
        if (!addr.internal && addr.family === 'IPv4') {
          return addr.address;
        }
      }
    }

    return null;
  }

  /**
   * Validate if an IP address is valid for binding
   */
  isValidBindingAddress(address: string): boolean {
    // Check for special addresses
    if (address === '0.0.0.0' || address === '127.0.0.1') {
      return true;
    }

    // Check if it's one of the machine's interfaces
    const interfaces = this.getNetworkInterfaces();
    for (const iface of interfaces) {
      for (const addr of iface.addresses) {
        if (addr.address === address) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Format network information for display
   */
  getNetworkInfo(): NetworkInfo {
    const hostname = os.hostname();
    const primaryIp = this.getPrimaryIpAddress();
    const interfaces = this.getNetworkInterfaces();

    return {
      hostname,
      primaryIp,
      interfaces: interfaces.filter(i => i.name !== 'all' && i.name !== 'localhost'),
      bindingOptions: this.getBindingOptions()
    };
  }

  /**
   * Check if running in Docker container
   */
  isDocker(): boolean {
    try {
      // Check for .dockerenv file
      // fs already imported at top
      if (fs.existsSync('/.dockerenv')) {
        return true;
      }
      
      // Check cgroup for docker
      const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf8');
      return cgroup.includes('docker');
    } catch {
      return false;
    }
  }

  /**
   * Get recommended binding address based on environment
   */
  getRecommendedBindingAddress(): string {
    if (this.isDocker()) {
      // In Docker, bind to all interfaces
      return '0.0.0.0';
    }
    
    if (process.env.NODE_ENV === 'production') {
      // In production, bind to primary IP
      return this.getPrimaryIpAddress() || '0.0.0.0';
    }
    
    // In development, bind to localhost
    return '127.0.0.1';
  }

  /**
   * Parse connection string (host:port)
   */
  parseConnectionString(connectionString: string): { host: string; port: number } | null {
    const parts = connectionString.split(':');
    if (parts.length !== 2) return null;
    
    const host = parts[0];
    const port = parseInt(parts[1], 10);
    
    if (isNaN(port) || port < 1 || port > 65535) return null;
    
    return { host, port };
  }

  /**
   * Format connection URL
   */
  formatConnectionUrl(protocol: string, host: string, port: number, path: string = ''): string {
    // Handle IPv6 addresses
    const formattedHost = host.includes(':') ? `[${host}]` : host;
    return `${protocol}://${formattedHost}:${port}${path}`;
  }

  /**
   * Get network latency to a host
   */
  async getLatency(host: string, timeout: number = 5000): Promise<number | null> {
    const start = Date.now();
    
    return new Promise((resolve) => {
      // net already imported at top
      const socket = new net.Socket();
      
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(null);
      }, timeout);
      
      socket.connect(80, host, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(Date.now() - start);
      });
      
      socket.on('error', () => {
        clearTimeout(timer);
        resolve(null);
      });
    });
  }

  /**
   * Check if a host is reachable
   */
  async isHostReachable(host: string, port: number, timeout: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      // net already imported at top
      const socket = new net.Socket();
      
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);
      
      socket.connect(port, host, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Get network statistics
   */
  getNetworkStats(): Record<string, any> {
    const interfaces = os.networkInterfaces();
    const stats: Record<string, any> = {};
    
    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;
      
      stats[name] = {
        ipv4: addresses.filter(a => a.family === 'IPv4').length,
        ipv6: addresses.filter(a => a.family === 'IPv6').length,
        internal: addresses.some(a => a.internal)
      };
    }
    
    return stats;
  }
}

// Singleton instance
let networkService: NetworkService | null = null;

export function getNetworkService(): NetworkService {
  if (!networkService) {
    networkService = new NetworkService();
  }
  return networkService;
}

export default NetworkService;
