/**
 * Log Pins — deterministic pinning for oracle outputs and external calls.
 *
 * Pins capture the exact output of non-deterministic operations (LM calls,
 * engine queries, external APIs) so that replay is byte-identical.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { UUID, TimestampMs } from '../generated/schemas.js';

/** A pinned value for deterministic replay. */
export interface Pin<T = unknown> {
  /** Unique pin ID. */
  id: UUID;
  /** Operation type that was pinned. */
  operation: string;
  /** Input hash that produced this output. */
  inputHash: string;
  /** The pinned output value. */
  output: T;
  /** When this pin was created. */
  ts: TimestampMs;
  /** Schema version of the output. */
  schemaVersion: number;
}

/** Pin store configuration. */
export interface PinStoreConfig {
  /** Directory for pin files. */
  dir: string;
  /** Maximum pins per file. */
  maxPinsPerFile: number;
  /** Whether to compress pins. */
  compress: boolean;
}

/** Default pin store configuration. */
export const defaultPinStoreConfig: PinStoreConfig = {
  dir: join(process.cwd(), 'data', 'pins'),
  maxPinsPerFile: 10000,
  compress: false,
};

/** Pin entry for storage. */
interface PinEntry<T = unknown> extends Pin<T> {
  /** Sequence number in the log when this pin was used. */
  logSeq?: number;
}

/** In-memory pin index. */
interface PinIndexEntry {
  id: UUID;
  operation: string;
  inputHash: string;
  file: string;
  offset: number;
}

/**
 * Pin store for deterministic replay of external calls.
 */
export class PinStore {
  private config: PinStoreConfig;
  private index = new Map<string, PinIndexEntry>();
  private currentFile = 0;
  private currentCount = 0;
  private currentFd: number | null = null;

  constructor(config: Partial<PinStoreConfig> = {}) {
    this.config = { ...defaultPinStoreConfig, ...config };
  }

  /** Initialize the pin store. */
  async open(): Promise<void> {
    await fs.mkdir(this.config.dir, { recursive: true });
    await this.loadIndex();
    await this.openCurrentFile();
  }

  /** Load existing pins into index. */
  private async loadIndex(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.dir);
      const pinFiles = files.filter(f => f.startsWith('pins-') && f.endsWith('.jsonl')).sort();

      for (const file of pinFiles) {
        const path = join(this.config.dir, file);
        const content = await fs.readFile(path, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l);

        let offset = 0;
        for (const line of lines) {
          try {
            const pin = JSON.parse(line) as PinEntry;
            const key = `${pin.operation}:${pin.inputHash}`;
            this.index.set(key, {
              id: pin.id,
              operation: pin.operation,
              inputHash: pin.inputHash,
              file,
              offset,
            });
            offset += Buffer.byteLength(line + '\n', 'utf-8');
            this.currentCount++;
          } catch {
            // Skip malformed
          }
        }
      }
      this.currentFile = pinFiles.length;
    } catch {
      // No existing pins
    }
  }

  /** Open current write file. */
  private async openCurrentFile(): Promise<void> {
    const fileName = `pins-${this.currentFile.toString().padStart(4, '0')}.jsonl`;
    const path = join(this.config.dir, fileName);
    this.currentFd = await fs.open(path, 'a');
  }

  /** Generate input hash from operation and arguments. */
  private hashInput(operation: string, args: unknown[]): string {
    const json = JSON.stringify({ operation, args }, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  /** Get or create a pin for an operation. */
  async getOrPin<T>(
    operation: string,
    args: unknown[],
    compute: () => Promise<T>
  ): Promise<T> {
    const inputHash = this.hashInput(operation, args);
    const key = `${operation}:${inputHash}`;

    // Check index
    const existing = this.index.get(key);
    if (existing) {
      // Load from file
      const path = join(this.config.dir, existing.file);
      const content = await fs.readFile(path, 'utf-8');
      const lines = content.trim().split('\n');
      // Find the line at offset (simplified: scan)
      for (const line of lines) {
        const pin = JSON.parse(line) as PinEntry<T>;
        if (pin.inputHash === inputHash && pin.operation === operation) {
          return pin.output;
        }
      }
    }

    // Compute and pin
    const output = await compute();
    await this.pin(operation, inputHash, output);
    return output;
  }

  /** Store a pin. */
  async pin<T>(operation: string, inputHash: string, output: T): Promise<UUID> {
    if (this.currentFd === null) await this.openCurrentFile();

    const id = crypto.randomUUID();
    const pin: PinEntry<T> = {
      id,
      operation,
      inputHash,
      output,
      ts: Date.now(),
      schemaVersion: 1,
    };

    const line = JSON.stringify(pin) + '\n';
    const buffer = Buffer.from(line, 'utf-8');
    await fs.write(this.currentFd!, buffer);
    this.currentCount++;

    this.index.set(`${operation}:${inputHash}`, {
      id,
      operation,
      inputHash,
      file: `pins-${this.currentFile.toString().padStart(4, '0')}.jsonl`,
      offset: 0, // Approximate
    });

    if (this.currentCount >= this.config.maxPinsPerFile) {
      await fs.close(this.currentFd!);
      this.currentFile++;
      this.currentCount = 0;
      await this.openCurrentFile();
    }

    return id;
  }

  /** Check if a pin exists. */
  hasPin(operation: string, args: unknown[]): boolean {
    const inputHash = this.hashInput(operation, args);
    return this.index.has(`${operation}:${inputHash}`);
  }

  /** Get a pinned value without computing. */
  async getPin<T>(operation: string, args: unknown[]): Promise<T | null> {
    const inputHash = this.hashInput(operation, args);
    const key = `${operation}:${inputHash}`;
    const existing = this.index.get(key);
    if (!existing) return null;

    const path = join(this.config.dir, existing.file);
    const content = await fs.readFile(path, 'utf-8');
    for (const line of content.trim().split('\n')) {
      const pin = JSON.parse(line) as PinEntry<T>;
      if (pin.inputHash === inputHash && pin.operation === operation) {
        return pin.output;
      }
    }
    return null;
  }

  /** Get all pins for an operation. */
  async getPinsForOperation<T>(operation: string): Promise<Pin<T>[]> {
    const results: Pin<T>[] = [];
    for (const [key, entry] of this.index) {
      if (entry.operation === operation) {
        const path = join(this.config.dir, entry.file);
        const content = await fs.readFile(path, 'utf-8');
        for (const line of content.trim().split('\n')) {
          const pin = JSON.parse(line) as PinEntry<T>;
          if (pin.operation === operation) {
            results.push(pin);
          }
        }
      }
    }
    return results;
  }

  /** Close the pin store. */
  async close(): Promise<void> {
    if (this.currentFd !== null) {
      await fs.close(this.currentFd);
      this.currentFd = null;
    }
  }

  /** Get statistics. */
  getStats(): { pins: number; files: number; operations: Set<string> } {
    const operations = new Set<string>();
    for (const entry of this.index.values()) {
      operations.add(entry.operation);
    }
    return {
      pins: this.index.size,
      files: this.currentFile + 1,
      operations,
    };
  }
}

/** Create a pin store. */
export function createPinStore(config?: Partial<PinStoreConfig>): PinStore {
  return new PinStore(config);
}

/**
 * Pinning decorator for class methods.
 * Usage: @pin('operation-name') async method(...args) { ... }
 */
export function pin(operation: string) {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => Promise<unknown>>
  ) {
    const originalMethod = descriptor.value!;
    const store = createPinStore();
    let initialized = false;

    descriptor.value = async function (...args: unknown[]) {
      if (!initialized) {
        await store.open();
        initialized = true;
      }
      return store.getOrPin(operation, args, () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Higher-order function to pin a function.
 */
export function withPin<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  operation: string,
  store: PinStore
): T {
  return (async (...args: unknown[]) => {
    return store.getOrPin(operation, args, () => fn(...args));
  }) as T;
}

/**
 * Replay-pinned function: during replay, returns pinned value; during live, computes and pins.
 */
export function createReplayPinned<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  operation: string,
  store: PinStore,
  isReplay: boolean
): T {
  return (async (...args: unknown[]) => {
    if (isReplay) {
      const pinned = await store.getPin(operation, args);
      if (pinned !== null) return pinned;
      // Fallback: compute if not pinned (should not happen in correct replay)
      console.warn(`[Pin] No pin found for ${operation} during replay, computing`);
    }
    return store.getOrPin(operation, args, () => fn(...args));
  }) as T;
}