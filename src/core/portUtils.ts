/**
 * Port utilities for checking and managing port conflicts
 */

import { exec, execSync } from "child_process";
import { promisify } from "util";
import * as net from "net";

const execAsync = promisify(exec);

export interface ProcessInfo {
  pid: number;
  command: string;
  port: number;
}

export interface PortStatus {
  port: number;
  available: boolean;
  process: ProcessInfo | null;
}

export interface PortClearResult {
  cleared: boolean;
  port: number;
  error?: string;
}

export interface PortStatusResult {
  hasConflicts: boolean;
  message: string;
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port, "0.0.0.0");
  });
}

/**
 * Get process info for a port
 */
export async function getProcessOnPort(
  port: number,
): Promise<ProcessInfo | null> {
  try {
    // Try lsof first (macOS/Linux)
    const { stdout } = await execAsync(
      `lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true`,
    );
    const pids = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const pid of pids) {
      // Verify PID is still alive
      const { stdout: alive } = await execAsync(
        `ps -p ${pid} -o pid= 2>/dev/null || true`,
      );
      if (!alive.trim()) continue;

      // Get process details
      const { stdout: psOutput } = await execAsync(
        `ps -p ${pid} -o pid,command 2>/dev/null || true`,
      );
      const lines = psOutput.trim().split("\n");

      if (lines.length > 1) {
        const processLine = lines[1];
        const parts = processLine.trim().split(/\s+/);
        const processCmd = parts.slice(1).join(" ");

        return {
          pid: parseInt(pid, 10),
          command: processCmd || "Unknown process",
          port,
        };
      }
    }

    // Fallback for Windows
    if (process.platform === "win32") {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split("\n");

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];

        if (pid && pid !== "0") {
          return {
            pid: parseInt(pid),
            command: "Use Task Manager to identify process",
            port,
          };
        }
      }
    }

    return null;
  } catch (_error) {
    // If commands fail, return null
    return null;
  }
}

/**
 * Check all required ports and return status
 */
export async function checkRequiredPorts(
  ports: number[],
): Promise<PortStatus[]> {
  const results: PortStatus[] = [];

  // Robust sampling based purely on lsof LISTEN results to avoid false positives
  const samplesPerPort = 6;
  const sampleDelayMs = 120;

  for (const port of ports) {
    let conflictSamples = 0;
    let lastProcessInfo: ProcessInfo | null = null;

    for (let i = 0; i < samplesPerPort; i++) {
      const info = await getProcessOnPort(port);
      if (info) {
        conflictSamples += 1;
        lastProcessInfo = info;
      }
      if (i < samplesPerPort - 1) {
        await new Promise((r) => setTimeout(r, sampleDelayMs));
      }
    }

    const isConflict = conflictSamples >= 2 && lastProcessInfo !== null;
    results.push({
      port,
      available: !isConflict,
      process: isConflict ? lastProcessInfo : null,
    });
  }

  return results;
}

/**
 * Format port status for display
 */
export function formatPortStatus(portStatus: PortStatus[]): PortStatusResult {
  const unavailable = portStatus.filter((p) => !p.available);

  if (unavailable.length === 0) {
    return {
      hasConflicts: false,
      message: "✅ All required ports are available",
    };
  }

  let message = "\n❌ Port conflict detected!\n\n";
  message += "The following ports are already in use:\n";
  message += "─".repeat(60) + "\n";

  for (const port of unavailable) {
    message += `\n  Port ${port.port}:\n`;
    if (port.process) {
      message += `    PID: ${port.process.pid}\n`;
      message += `    Command: ${port.process.command.substring(0, 50)}${port.process.command.length > 50 ? "..." : ""}\n`;
      message += `    Kill command: kill -9 ${port.process.pid}\n`;
    } else {
      message += `    Unable to identify process\n`;
      message += `    Try: lsof -ti:${port.port} | xargs kill -9\n`;
    }
  }

  message += "\n" + "─".repeat(60) + "\n";
  message += "\nTo resolve:\n";
  message += "  1. Kill the conflicting processes using the commands above\n";
  message += "  2. Or change the PORT in your .env file\n";
  message += "  3. Then restart the application\n";

  return {
    hasConflicts: true,
    message,
  };
}

/**
 * Find an available port starting from a base port
 */
export async function findAvailablePort(
  startPort: number,
  maxAttempts: number = 10,
): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  return null;
}

/**
 * Clear a port by terminating the process using it
 */
export async function clearPort(port: number): Promise<PortClearResult> {
  const processInfo = await getProcessOnPort(port);

  if (!processInfo) {
    return { cleared: true, port }; // Port is already free
  }

  try {
    if (process.platform === "win32") {
      execSync(`taskkill /F /PID ${processInfo.pid}`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${processInfo.pid}`, { stdio: "ignore" });
    }

    // Wait a bit for the process to terminate
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify the port is now free
    const available = await isPortAvailable(port);
    return { cleared: available, port };
  } catch (_error: any) {
    console.warn(`Failed to clear port ${port}:`, _error.message);
    return {
      cleared: false,
      port,
      error: _error.message,
    };
  }
}

/**
 * Get port information for display
 */
export async function getPortInfo(port: number): Promise<string> {
  const available = await isPortAvailable(port);
  const processInfo = available ? null : await getProcessOnPort(port);

  if (available) {
    return `Port ${port} is available`;
  }

  if (processInfo) {
    return `Port ${port} is in use by PID ${processInfo.pid}: ${processInfo.command}`;
  }

  return `Port ${port} is in use by unknown process`;
}

/**
 * Wait for port to become available
 */
export async function waitForPort(
  port: number,
  timeout: number = 5000,
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await isPortAvailable(port)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Get all ports in use within a range
 */
export async function getPortsInUse(
  startPort: number = 3000,
  endPort: number = 9999,
): Promise<number[]> {
  const portsInUse: number[] = [];

  for (let port = startPort; port <= endPort; port++) {
    if (!(await isPortAvailable(port))) {
      portsInUse.push(port);
    }
  }

  return portsInUse;
}

export default {
  isPortAvailable,
  getProcessOnPort,
  checkRequiredPorts,
  formatPortStatus,
  findAvailablePort,
  clearPort,
  getPortInfo,
  waitForPort,
  getPortsInUse,
};
