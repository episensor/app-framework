/**
 * Enhanced System Monitor Service
 * Provides comprehensive system health and performance metrics
 */

import os from 'os';
import fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { createLogger } from '../core/index.js';

const execAsync = promisify(exec);
const logger = createLogger('SystemMonitor');

export interface CPUInfo {
  usage: number;
  temperature?: number;
  cores: number;
  model: string;
  speed: number;
  loadAverage: number[];
}

export interface MemoryInfo {
  total: number;
  used: number;
  free: number;
  percentage: number;
  available?: number;
  active?: number;
  inactive?: number;
  buffers?: number;
  cached?: number;
  swap?: {
    total: number;
    used: number;
    free: number;
    percentage?: number;
  };
  process?: {
    rss: number;        // Resident Set Size
    heapTotal: number;  // V8 heap total
    heapUsed: number;   // V8 heap used
    external: number;   // C++ objects bound to JS
    arrayBuffers: number;
  };
  breakdown?: {
    apps: number;       // Memory used by applications
    pageCache: number;  // Page cache
    buffers: number;    // Buffers
    slab: number;       // Kernel slab
    kernelStack: number;
    pageTables: number;
    vmallocUsed: number;
  };
}

export interface DiskInfo {
  total: number;
  used: number;
  free: number;
  percentage: number;
  io?: {
    readBytes: number;
    writeBytes: number;
    readOps: number;
    writeOps: number;
  };
}

export interface NetworkInterfaceInfo {
  name: string;
  addresses: string[];
  mac: string;
  speed?: number;
  stats?: {
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
    rxErrors: number;
    txErrors: number;
  };
}

export interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
  kernel: string;
  hostname: string;
  uptime: number;
  bootTime: Date;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  uptime: number;
}

export interface SystemHealth {
  cpu: CPUInfo;
  memory: MemoryInfo;
  disk: DiskInfo;
  system: SystemInfo;
  network: {
    interfaces: NetworkInterfaceInfo[];
    connections: number;
  };
  processes?: ProcessInfo[];
  timestamp: Date;
}

class SystemMonitor {
  private cpuUsageHistory: number[] = [];
  private lastCPUInfo: any = null;
  private diskIOCache: Map<string, any> = new Map();

  /**
   * Get comprehensive system health metrics
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const [cpu, memory, disk, system, network] = await Promise.all([
      this.getCPUInfo(),
      this.getMemoryInfo(),
      this.getDiskInfo(),
      this.getSystemInfo(),
      this.getNetworkInfo()
    ]);

    return {
      cpu,
      memory,
      disk,
      system,
      network,
      timestamp: new Date()
    };
  }

  /**
   * Get CPU information including temperature
   */
  async getCPUInfo(): Promise<CPUInfo> {
    const cpus = os.cpus();
    const model = cpus[0]?.model || 'Unknown';
    const cores = cpus.length;
    const speed = cpus[0]?.speed || 0;
    const loadAverage = os.loadavg();
    
    // Calculate CPU usage
    const usage = await this.calculateCPUUsage();
    
    // Try to get CPU temperature
    const temperature = await this.getCPUTemperature();

    return {
      usage,
      temperature,
      cores,
      model,
      speed,
      loadAverage
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  private async calculateCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    if (this.lastCPUInfo) {
      const idleDiff = totalIdle - this.lastCPUInfo.idle;
      const totalDiff = totalTick - this.lastCPUInfo.total;
      const usage = Math.round(100 - (100 * idleDiff / totalDiff));
      
      this.cpuUsageHistory.push(usage);
      if (this.cpuUsageHistory.length > 60) {
        this.cpuUsageHistory.shift();
      }
      
      this.lastCPUInfo = { idle: totalIdle, total: totalTick };
      return usage;
    }

    this.lastCPUInfo = { idle: totalIdle, total: totalTick };
    return 0;
  }

  /**
   * Get CPU temperature (platform-specific)
   */
  private async getCPUTemperature(): Promise<number | undefined> {
    const platform = process.platform;

    try {
      if (platform === 'darwin') {
        // macOS - try using osx-temperature-sensor
        const { stdout } = await execAsync('sysctl -n machdep.xcpm.cpu_thermal_level 2>/dev/null || echo ""');
        if (stdout.trim()) {
          return parseFloat(stdout.trim());
        }
      } else if (platform === 'linux') {
        // Linux - read from thermal zone
        const thermalZone = '/sys/class/thermal/thermal_zone0/temp';
        if (fs.existsSync(thermalZone)) {
          const temp = fs.readFileSync(thermalZone, 'utf8');
          return parseInt(temp) / 1000; // Convert from millidegrees
        }
      } else if (platform === 'win32') {
        // Windows - use wmic
        const { stdout } = await execAsync('wmic /namespace:\\\\root\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature /value');
        const match = stdout.match(/CurrentTemperature=(\d+)/);
        if (match) {
          // Convert from tenths of Kelvin to Celsius
          return (parseInt(match[1]) - 2732) / 10;
        }
      }
    } catch (_error) {
      logger.debug('Could not get CPU temperature:', _error);
    }

    return undefined;
  }

  /**
   * Get memory information including swap and detailed breakdown
   */
  async getMemoryInfo(): Promise<MemoryInfo> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const percentage = Math.round((usedMem / totalMem) * 100);

    const memInfo: MemoryInfo = {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percentage
    };

    // Add process memory usage
    const memUsage = process.memoryUsage();
    memInfo.process = {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0
    };

    // Try to get detailed memory information
    const detailed = await this.getDetailedMemoryInfo();
    if (detailed) {
      Object.assign(memInfo, detailed);
    }

    // Try to get swap information
    const swap = await this.getSwapInfo();
    if (swap) {
      memInfo.swap = {
        ...swap,
        percentage: swap.total > 0 ? Math.round((swap.used / swap.total) * 100) : 0
      };
    }

    return memInfo;
  }
  
  /**
   * Get detailed memory breakdown (Linux only)
   */
  private async getDetailedMemoryInfo(): Promise<Partial<MemoryInfo> | undefined> {
    const platform = process.platform;
    
    if (platform !== 'linux') {
      return undefined;
    }
    
    try {
      const { stdout } = await execAsync('cat /proc/meminfo');
      const lines = stdout.split('\n');
      const meminfo: Record<string, number> = {};
      
      for (const line of lines) {
        const match = line.match(/^(\w+):\s+(\d+)\s+kB/);
        if (match) {
          meminfo[match[1]] = parseInt(match[2]) * 1024; // Convert to bytes
        }
      }
      
      const result: Partial<MemoryInfo> = {};
      
      // Available memory
      if (meminfo.MemAvailable) {
        result.available = meminfo.MemAvailable;
      }
      
      // Active/Inactive
      if (meminfo.Active) result.active = meminfo.Active;
      if (meminfo.Inactive) result.inactive = meminfo.Inactive;
      
      // Buffers/Cached
      if (meminfo.Buffers) result.buffers = meminfo.Buffers;
      if (meminfo.Cached) result.cached = meminfo.Cached;
      
      // Detailed breakdown
      if (meminfo.Slab || meminfo.KernelStack || meminfo.PageTables) {
        result.breakdown = {
          apps: (meminfo.MemTotal - meminfo.MemFree - meminfo.Buffers - meminfo.Cached) || 0,
          pageCache: meminfo.Cached || 0,
          buffers: meminfo.Buffers || 0,
          slab: meminfo.Slab || 0,
          kernelStack: meminfo.KernelStack || 0,
          pageTables: meminfo.PageTables || 0,
          vmallocUsed: meminfo.VmallocUsed || 0
        };
      }
      
      return result;
    } catch (_error) {
      logger.debug('Could not get detailed memory info:', _error);
      return undefined;
    }
  }

  /**
   * Get swap memory information
   */
  private async getSwapInfo(): Promise<{ total: number; used: number; free: number } | undefined> {
    const platform = process.platform;

    try {
      if (platform === 'linux') {
        const { stdout } = await execAsync('free -b | grep Swap');
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 3) {
          return {
            total: parseInt(parts[1]),
            used: parseInt(parts[2]),
            free: parseInt(parts[3])
          };
        }
      } else if (platform === 'darwin') {
        const { stdout } = await execAsync('sysctl vm.swapusage');
        const match = stdout.match(/total = ([\d.]+)M.*used = ([\d.]+)M.*free = ([\d.]+)M/);
        if (match) {
          return {
            total: parseFloat(match[1]) * 1024 * 1024,
            used: parseFloat(match[2]) * 1024 * 1024,
            free: parseFloat(match[3]) * 1024 * 1024
          };
        }
      }
    } catch (_error) {
      logger.debug('Could not get swap information:', _error);
    }

    return undefined;
  }

  /**
   * Get disk information including I/O stats
   */
  async getDiskInfo(): Promise<DiskInfo> {
    const platform = process.platform;
    let diskInfo: DiskInfo = {
      total: 0,
      used: 0,
      free: 0,
      percentage: 0
    };

    try {
      if (platform === 'darwin' || platform === 'linux') {
        const { stdout } = await execAsync("df -k / | tail -1");
        const parts = stdout.trim().split(/\s+/);
        
        if (parts.length >= 4) {
          const total = parseInt(parts[1]) * 1024;
          const used = parseInt(parts[2]) * 1024;
          const free = parseInt(parts[3]) * 1024;
          const percentage = Math.round((used / total) * 100);

          diskInfo = { total, used, free, percentage };
        }
      } else if (platform === 'win32') {
        const { stdout } = await execAsync('wmic logicaldisk get size,freespace /value');
        const lines = stdout.trim().split('\n');
        let total = 0, free = 0;
        
        lines.forEach(line => {
          if (line.startsWith('FreeSpace=')) {
            const value = line.split('=')[1];
            if (value) free += parseInt(value);
          } else if (line.startsWith('Size=')) {
            const value = line.split('=')[1];
            if (value) total += parseInt(value);
          }
        });

        const used = total - free;
        const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
        
        diskInfo = { total, used, free, percentage };
      }

      // Get I/O stats
      const io = await this.getDiskIOStats();
      if (io) {
        diskInfo.io = io;
      }
    } catch (_error) {
      logger.debug('Could not get disk information:', _error);
    }

    return diskInfo;
  }

  /**
   * Get disk I/O statistics
   */
  private async getDiskIOStats(): Promise<any> {
    const platform = process.platform;

    try {
      if (platform === 'linux') {
        const { stdout } = await execAsync('cat /proc/diskstats | grep -E "sda |nvme0n1 " | head -1');
        const parts = stdout.trim().split(/\s+/);
        
        if (parts.length >= 10) {
          const current = {
            readOps: parseInt(parts[3]),
            readBytes: parseInt(parts[5]) * 512,
            writeOps: parseInt(parts[7]),
            writeBytes: parseInt(parts[9]) * 512
          };

          // Calculate rate if we have previous data
          const cacheKey = 'diskio';
          const previous = this.diskIOCache.get(cacheKey);
          
          if (previous) {
            const timeDiff = Date.now() - previous.timestamp;
            const rateFactor = 1000 / timeDiff; // Convert to per second
            
            const io = {
              readBytes: Math.round((current.readBytes - previous.readBytes) * rateFactor),
              writeBytes: Math.round((current.writeBytes - previous.writeBytes) * rateFactor),
              readOps: Math.round((current.readOps - previous.readOps) * rateFactor),
              writeOps: Math.round((current.writeOps - previous.writeOps) * rateFactor)
            };

            this.diskIOCache.set(cacheKey, { ...current, timestamp: Date.now() });
            return io;
          }

          this.diskIOCache.set(cacheKey, { ...current, timestamp: Date.now() });
        }
      } else if (platform === 'darwin') {
        const { stdout } = await execAsync('iostat -d -w 1 -c 2 | tail -1');
        const parts = stdout.trim().split(/\s+/);
        
        if (parts.length >= 3) {
          return {
            readBytes: parseFloat(parts[0]) * 1024,
            writeBytes: parseFloat(parts[1]) * 1024,
            readOps: 0,
            writeOps: 0
          };
        }
      }
    } catch (_error) {
      logger.debug('Could not get disk I/O statistics:', _error);
    }

    return undefined;
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const platform = process.platform;
    const arch = process.arch;
    const version = os.release();
    const hostname = os.hostname();
    const uptime = os.uptime();
    const bootTime = new Date(Date.now() - uptime * 1000);
    
    let kernel = version;
    
    // Try to get more detailed kernel info
    try {
      if (platform === 'linux' || platform === 'darwin') {
        const { stdout } = await execAsync('uname -r');
        kernel = stdout.trim();
      }
    } catch {
      // Use default
    }

    return {
      platform,
      arch,
      version,
      kernel,
      hostname,
      uptime,
      bootTime
    };
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{ interfaces: NetworkInterfaceInfo[]; connections: number }> {
    const interfaces = await this.getNetworkInterfaces();
    const connections = await this.getNetworkConnections();

    return {
      interfaces,
      connections
    };
  }

  /**
   * Get detailed network interface information
   */
  private async getNetworkInterfaces(): Promise<NetworkInterfaceInfo[]> {
    const interfaces = os.networkInterfaces();
    const result: NetworkInterfaceInfo[] = [];

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;

      const ipv4Addresses = addresses
        .filter(addr => addr.family === 'IPv4')
        .map(addr => addr.address);

      if (ipv4Addresses.length > 0) {
        const interfaceInfo: NetworkInterfaceInfo = {
          name,
          addresses: ipv4Addresses,
          mac: addresses[0]?.mac || '00:00:00:00:00:00'
        };

        // Try to get interface statistics
        const stats = await this.getInterfaceStats(name);
        if (stats) {
          interfaceInfo.stats = stats;
        }

        result.push(interfaceInfo);
      }
    }

    return result;
  }

  /**
   * Get network interface statistics
   */
  private async getInterfaceStats(interfaceName: string): Promise<any> {
    const platform = process.platform;

    try {
      if (platform === 'linux') {
        const statsFile = `/sys/class/net/${interfaceName}/statistics`;
        if (fs.existsSync(statsFile)) {
          const readFile = (file: string) => {
            try {
              return parseInt(fs.readFileSync(`${statsFile}/${file}`, 'utf8').trim());
            } catch {
              return 0;
            }
          };

          return {
            rxBytes: readFile('rx_bytes'),
            txBytes: readFile('tx_bytes'),
            rxPackets: readFile('rx_packets'),
            txPackets: readFile('tx_packets'),
            rxErrors: readFile('rx_errors'),
            txErrors: readFile('tx_errors')
          };
        }
      } else if (platform === 'darwin') {
        const { stdout } = await execAsync(`netstat -ibn | grep -A 1 "^${interfaceName}"`);
        const lines = stdout.trim().split('\n');
        
        if (lines.length >= 2) {
          const parts = lines[1].trim().split(/\s+/);
          if (parts.length >= 10) {
            return {
              rxPackets: parseInt(parts[4]),
              rxErrors: parseInt(parts[5]),
              rxBytes: parseInt(parts[6]),
              txPackets: parseInt(parts[7]),
              txErrors: parseInt(parts[8]),
              txBytes: parseInt(parts[9])
            };
          }
        }
      }
    } catch (_error) {
      logger.debug(`Could not get stats for interface ${interfaceName}:`, _error);
    }

    return undefined;
  }

  /**
   * Get detailed network statistics with bandwidth usage
   */
  async getNetworkStatistics(): Promise<{
    interfaces: NetworkInterfaceInfo[];
    totalBytesReceived: number;
    totalBytesSent: number;
    totalPacketsReceived: number;
    totalPacketsSent: number;
    connections: number;
    bandwidth?: {
      download: number; // bytes/sec
      upload: number;   // bytes/sec
    };
  }> {
    const interfaces = await this.getNetworkInterfaces();
    let totalBytesReceived = 0;
    let totalBytesSent = 0;
    let totalPacketsReceived = 0;
    let totalPacketsSent = 0;
    
    // Sum up statistics from all interfaces
    for (const iface of interfaces) {
      if (iface.stats) {
        totalBytesReceived += iface.stats.rxBytes || 0;
        totalBytesSent += iface.stats.txBytes || 0;
        totalPacketsReceived += iface.stats.rxPackets || 0;
        totalPacketsSent += iface.stats.txPackets || 0;
      }
    }
    
    const connections = await this.getNetworkConnections();
    
    // Calculate bandwidth if we have previous measurements
    const bandwidth = await this.calculateBandwidth(totalBytesReceived, totalBytesSent);
    
    return {
      interfaces,
      totalBytesReceived,
      totalBytesSent,
      totalPacketsReceived,
      totalPacketsSent,
      connections,
      bandwidth
    };
  }
  
  /**
   * Calculate bandwidth based on byte counters
   */
  private lastNetworkMeasurement?: {
    timestamp: number;
    bytesReceived: number;
    bytesSent: number;
  };
  
  private async calculateBandwidth(
    currentBytesReceived: number,
    currentBytesSent: number
  ): Promise<{ download: number; upload: number } | undefined> {
    const now = Date.now();
    
    if (this.lastNetworkMeasurement) {
      const timeDiff = (now - this.lastNetworkMeasurement.timestamp) / 1000; // seconds
      
      if (timeDiff > 0) {
        const download = (currentBytesReceived - this.lastNetworkMeasurement.bytesReceived) / timeDiff;
        const upload = (currentBytesSent - this.lastNetworkMeasurement.bytesSent) / timeDiff;
        
        this.lastNetworkMeasurement = {
          timestamp: now,
          bytesReceived: currentBytesReceived,
          bytesSent: currentBytesSent
        };
        
        return {
          download: Math.max(0, download),
          upload: Math.max(0, upload)
        };
      }
    } else {
      // First measurement
      this.lastNetworkMeasurement = {
        timestamp: now,
        bytesReceived: currentBytesReceived,
        bytesSent: currentBytesSent
      };
    }
    
    return undefined;
  }
  
  /**
   * Get active network connections by state
   */
  async getNetworkConnectionsByState(): Promise<{
    established: number;
    listening: number;
    timeWait: number;
    closeWait: number;
    total: number;
  }> {
    const platform = process.platform;
    
    try {
      let established = 0;
      let listening = 0;
      let timeWait = 0;
      let closeWait = 0;
      
      if (platform === 'linux') {
        const { stdout } = await execAsync('ss -tan');
        const lines = stdout.split('\n').slice(1); // Skip header
        
        for (const line of lines) {
          if (line.includes('ESTAB')) established++;
          else if (line.includes('LISTEN')) listening++;
          else if (line.includes('TIME-WAIT')) timeWait++;
          else if (line.includes('CLOSE-WAIT')) closeWait++;
        }
      } else if (platform === 'darwin' || platform === 'win32') {
        const { stdout } = await execAsync('netstat -an');
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          if (line.includes('ESTABLISHED')) established++;
          else if (line.includes('LISTEN')) listening++;
          else if (line.includes('TIME_WAIT')) timeWait++;
          else if (line.includes('CLOSE_WAIT')) closeWait++;
        }
      }
      
      return {
        established,
        listening,
        timeWait,
        closeWait,
        total: established + listening + timeWait + closeWait
      };
    } catch (_error) {
      logger.debug('Could not get network connections by state:', _error);
      return {
        established: 0,
        listening: 0,
        timeWait: 0,
        closeWait: 0,
        total: 0
      };
    }
  }

  /**
   * Get number of network connections
   */
  private async getNetworkConnections(): Promise<number> {
    try {
      const platform = process.platform;
      let command = '';

      if (platform === 'linux') {
        command = 'ss -tun | tail -n +2 | wc -l';
      } else if (platform === 'darwin') {
        command = 'netstat -an | grep ESTABLISHED | wc -l';
      } else if (platform === 'win32') {
        command = 'netstat -an | find /c "ESTABLISHED"';
      }

      if (command) {
        const { stdout } = await execAsync(command);
        return parseInt(stdout.trim()) || 0;
      }
    } catch (_error) {
      logger.debug('Could not get network connections:', _error);
    }

    return 0;
  }

  /**
   * Get top processes by CPU or memory usage
   */
  async getTopProcesses(sortBy: 'cpu' | 'memory' = 'cpu', limit: number = 10): Promise<ProcessInfo[]> {
    const platform = process.platform;
    const processes: ProcessInfo[] = [];

    try {
      if (platform === 'linux' || platform === 'darwin') {
        const sortFlag = sortBy === 'cpu' ? '-pcpu' : '-pmem';
        const { stdout } = await execAsync(`ps aux --sort=${sortFlag} | head -${limit + 1} | tail -${limit}`);
        const lines = stdout.trim().split('\n');

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 11) {
            processes.push({
              pid: parseInt(parts[1]),
              cpu: parseFloat(parts[2]),
              memory: parseFloat(parts[3]),
              name: parts[10],
              uptime: 0 // Would need additional parsing
            });
          }
        }
      } else if (platform === 'win32') {
        await execAsync('wmic process get ProcessId,Name,PageFileUsage,UserModeTime /format:csv');
        // Parse Windows output
        // Implementation would be more complex
      }
    } catch (_error) {
      logger.debug('Could not get process list:', _error);
    }

    return processes;
  }

  /**
   * Get CPU usage history
   */
  getCPUHistory(): number[] {
    return [...this.cpuUsageHistory];
  }

  /**
   * Monitor system health continuously
   */
  async startMonitoring(interval: number = 5000, callback?: (health: SystemHealth) => void): Promise<NodeJS.Timeout> {
    // Initial reading
    await this.getSystemHealth();

    return setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        if (callback) {
          callback(health);
        }
      } catch (_error) {
        logger.error('Error monitoring system health:', _error);
      }
    }, interval);
  }
}

// Singleton instance
let systemMonitor: SystemMonitor | null = null;

export function getSystemMonitor(): SystemMonitor {
  if (!systemMonitor) {
    systemMonitor = new SystemMonitor();
  }
  return systemMonitor;
}

export default SystemMonitor;