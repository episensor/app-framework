/**
 * Cross-Platform Buffer Handling Module
 *
 * Ensures consistent data representation across ARM and x86 architectures
 * by using explicit buffer operations that are not affected by processor endianness.
 */

export type Endianness = "LE" | "BE";
export type DataType =
  | "uint16"
  | "int16"
  | "uint32"
  | "int32"
  | "float32"
  | "float64"
  | "bool";

export interface BufferOptions {
  endian?: Endianness;
  wordSwap?: boolean;
  byteSwap?: boolean;
}

export class CrossPlatformBuffer {
  private systemEndianness: Endianness;

  constructor() {
    // Detect system endianness for debugging/logging purposes
    this.systemEndianness = this.detectSystemEndianness();
  }

  /**
   * Detect system endianness (for logging/debugging only)
   */
  private detectSystemEndianness(): Endianness {
    const arrayBuffer = new ArrayBuffer(2);
    const uint8Array = new Uint8Array(arrayBuffer);
    const uint16Array = new Uint16Array(arrayBuffer);

    uint16Array[0] = 0x1234;

    if (uint8Array[0] === 0x12) {
      return "BE"; // Big Endian
    } else {
      return "LE"; // Little Endian
    }
  }

  /**
   * Get system endianness
   */
  getSystemEndianness(): Endianness {
    return this.systemEndianness;
  }

  /**
   * Convert float32 to two 16-bit registers with explicit endianness control
   */
  float32ToRegisters(
    value: number,
    endian: Endianness = "LE",
    wordSwap: boolean = false,
    byteSwap: boolean = false,
  ): [number, number] {
    // Create a buffer to hold the float32
    const buffer = new ArrayBuffer(4);
    const float32View = new Float32Array(buffer);
    const dataView = new DataView(buffer);

    // Write the float32 value
    float32View[0] = value;

    // Read as two 16-bit values with specified endianness
    let reg1: number, reg2: number;

    if (endian === "BE") {
      // Big Endian: most significant word first
      reg1 = dataView.getUint16(0, false); // Big endian read
      reg2 = dataView.getUint16(2, false);
    } else {
      // Little Endian: least significant word first
      reg1 = dataView.getUint16(0, true); // Little endian read
      reg2 = dataView.getUint16(2, true);
    }

    // Apply word swap if needed
    if (wordSwap) {
      [reg1, reg2] = [reg2, reg1];
    }

    // Apply byte swap within each word if needed
    if (byteSwap) {
      reg1 = ((reg1 & 0xff) << 8) | ((reg1 >> 8) & 0xff);
      reg2 = ((reg2 & 0xff) << 8) | ((reg2 >> 8) & 0xff);
    }

    return [reg1, reg2];
  }

  /**
   * Convert two 16-bit registers to float32 with explicit endianness control
   */
  registersToFloat32(
    reg1: number,
    reg2: number,
    endian: Endianness = "LE",
    wordSwap: boolean = false,
    byteSwap: boolean = false,
  ): number {
    // Apply byte swap within each word if needed
    if (byteSwap) {
      reg1 = ((reg1 & 0xff) << 8) | ((reg1 >> 8) & 0xff);
      reg2 = ((reg2 & 0xff) << 8) | ((reg2 >> 8) & 0xff);
    }

    // Apply word swap if needed
    if (wordSwap) {
      [reg1, reg2] = [reg2, reg1];
    }

    // Create a buffer and write the registers
    const buffer = new ArrayBuffer(4);
    const dataView = new DataView(buffer);

    if (endian === "BE") {
      // Big Endian: write as big endian
      dataView.setUint16(0, reg1, false);
      dataView.setUint16(2, reg2, false);
    } else {
      // Little Endian: write as little endian
      dataView.setUint16(0, reg1, true);
      dataView.setUint16(2, reg2, true);
    }

    // Read as float32
    const float32View = new Float32Array(buffer);
    return float32View[0];
  }

  /**
   * Convert int32 to two 16-bit registers
   */
  int32ToRegisters(
    value: number,
    endian: Endianness = "LE",
    wordSwap: boolean = false,
  ): [number, number] {
    const buffer = new ArrayBuffer(4);
    const dataView = new DataView(buffer);

    // Write the int32 value
    dataView.setInt32(0, value, endian === "LE");

    // Read as two 16-bit values
    let reg1 = dataView.getUint16(0, endian === "LE");
    let reg2 = dataView.getUint16(2, endian === "LE");

    if (wordSwap) {
      [reg1, reg2] = [reg2, reg1];
    }

    return [reg1, reg2];
  }

  /**
   * Convert two 16-bit registers to int32
   */
  registersToInt32(
    reg1: number,
    reg2: number,
    endian: Endianness = "LE",
    wordSwap: boolean = false,
  ): number {
    if (wordSwap) {
      [reg1, reg2] = [reg2, reg1];
    }

    const buffer = new ArrayBuffer(4);
    const dataView = new DataView(buffer);

    dataView.setUint16(0, reg1, endian === "LE");
    dataView.setUint16(2, reg2, endian === "LE");

    return dataView.getInt32(0, endian === "LE");
  }

  /**
   * Convert uint32 to two 16-bit registers
   */
  uint32ToRegisters(
    value: number,
    endian: Endianness = "LE",
    wordSwap: boolean = false,
  ): [number, number] {
    const buffer = new ArrayBuffer(4);
    const dataView = new DataView(buffer);

    // Write the uint32 value
    dataView.setUint32(0, value, endian === "LE");

    // Read as two 16-bit values
    let reg1 = dataView.getUint16(0, endian === "LE");
    let reg2 = dataView.getUint16(2, endian === "LE");

    if (wordSwap) {
      [reg1, reg2] = [reg2, reg1];
    }

    return [reg1, reg2];
  }

  /**
   * Convert two 16-bit registers to uint32
   */
  registersToUint32(
    reg1: number,
    reg2: number,
    endian: Endianness = "LE",
    wordSwap: boolean = false,
  ): number {
    if (wordSwap) {
      [reg1, reg2] = [reg2, reg1];
    }

    const buffer = new ArrayBuffer(4);
    const dataView = new DataView(buffer);

    dataView.setUint16(0, reg1, endian === "LE");
    dataView.setUint16(2, reg2, endian === "LE");

    return dataView.getUint32(0, endian === "LE");
  }

  /**
   * Convert boolean to register value
   */
  boolToRegister(value: boolean): number {
    return value ? 1 : 0;
  }

  /**
   * Convert register value to boolean
   */
  registerToBool(value: number): boolean {
    return value !== 0;
  }

  /**
   * Convert int16 to register with proper sign extension
   */
  int16ToRegister(value: number): number {
    // Ensure value is within int16 range
    value = Math.max(-32768, Math.min(32767, value));

    // Convert to unsigned representation
    if (value < 0) {
      return 0x10000 + value; // Two's complement
    }
    return value;
  }

  /**
   * Convert register to int16 with proper sign handling
   */
  registerToInt16(value: number): number {
    // Check if the sign bit is set
    if (value & 0x8000) {
      // Negative number in two's complement
      return value - 0x10000;
    }
    return value;
  }

  /**
   * Convert string to register array
   */
  stringToRegisters(str: string, maxLength: number = 32): number[] {
    const registers: number[] = [];
    const buffer = Buffer.from(str, "utf8");

    // Pad with zeros to ensure even number of bytes
    const paddedLength = Math.min(maxLength, Math.ceil(buffer.length / 2) * 2);

    for (let i = 0; i < paddedLength; i += 2) {
      const byte1 = buffer[i] || 0;
      const byte2 = buffer[i + 1] || 0;
      registers.push((byte1 << 8) | byte2);
    }

    return registers;
  }

  /**
   * Convert register array to string
   */
  registersToString(registers: number[]): string {
    const bytes: number[] = [];

    for (const reg of registers) {
      bytes.push((reg >> 8) & 0xff); // High byte
      bytes.push(reg & 0xff); // Low byte
    }

    // Remove trailing zeros
    while (bytes.length > 0 && bytes[bytes.length - 1] === 0) {
      bytes.pop();
    }

    return Buffer.from(bytes).toString("utf8");
  }

  /**
   * Validate register value is within 16-bit range
   */
  validateRegisterValue(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= 0xffff;
  }

  /**
   * Create a buffer configuration for consistent handling
   */
  createBufferConfig(options: BufferOptions = {}): Required<BufferOptions> {
    return {
      endian: options.endian || "LE",
      wordSwap: options.wordSwap || false,
      byteSwap: options.byteSwap || false,
    };
  }
}

// Singleton instance
let crossPlatformBuffer: CrossPlatformBuffer | null = null;

export function getCrossPlatformBuffer(): CrossPlatformBuffer {
  if (!crossPlatformBuffer) {
    crossPlatformBuffer = new CrossPlatformBuffer();
  }
  return crossPlatformBuffer;
}

export default CrossPlatformBuffer;
