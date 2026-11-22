/**
 * Log-Backed Oracle Pin Store — pin storage on the event log.
 *
 * Pins are stored as log entries in the LogStore, providing deterministic
 * replay with the same durability and ordering guarantees as the event log.
 */

import { createHash } from 'crypto';
import type { UUID, TimestampMs } from '../generated/schemas.js';
import type { OracleOperation } from './oracle.js';
import type { PinStore, PinKey } from './oracle.js';
import { LogStore, createLogStore, type LogStoreConfig } from '../log/store.js';
import { hashEntry, createLogEntry, type LogEntry } from '../log/events.js';

/** Pin event payload for the log. */
interface PinLogEvent {
  type: 'oracle.pin';
  operation: OracleOperation;
  queryDigest: string;
  provider: string;
  version?: string;
  context?: Record<string, unknown>;
  output: unknown;
  schemaVersion: number;
}

/** Log-backed pin store configuration. */
export interface LogBackedPinStoreConfig {
  /** Log store configuration. */
  logConfig?: Partial<LogStoreConfig>;
  /** In-memory index for fast lookups. */
  indexSize?: number;
}

/** Default configuration. */
export const defaultLogBackedPinStoreConfig: LogBackedPinStoreConfig = {
  logConfig: {},
  indexSize: 100000,
};

/** In-memory index entry for fast pin lookups. */
interface PinIndexEntry {
  key: string;
  seq: number;
  operation: OracleOperation;
  queryDigest: string;
  provider: string;
  version?: string;
  context?: Record<string, unknown>;
}

/** Serialize pin key for index lookup. */
function serializePinKey(key: PinKey): string {
  return `${key.operation}:${key.queryDigest}:${key.provider}:${key.version ?? ''}:${JSON.stringify(key.context ?? {})}`;
}

/** Compute query digest from args. */
function computeQueryDigest(args: unknown[]): string {
  const json = JSON.stringify(args, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v
  );
  return createHash('sha256').update(json).digest('hex').substring(0, 32);
}

/**
 * Log-backed pin store — uses the event log for durable, replayable pin storage.
 */
export class LogBackedPinStore implements PinStore {
  private logStore: LogStore;
  private index = new Map<string, PinIndexEntry>();
  private initialized = false;
  private maxIndexSize: number;

  constructor(config: LogBackedPinStoreConfig = defaultLogBackedPinStoreConfig) {
    this.logStore = createLogStore(config.logConfig);
    this.maxIndexSize = config.indexSize ?? 100000;
  }

  /** Initialize the pin store by opening the log and building the index. */
  async open(): Promise<void> {
    if (this.initialized) return;
    await this.logStore.open();
    await this.buildIndex();
    this.initialized = true;
  }

  /** Build in-memory index by scanning the log for pin events. */
  private async buildIndex(): Promise<void> {
    const entries = await this.logStore.readTail(this.maxIndexSize);
    for (const entry of entries) {
      const eventType = (entry.event as { type?: string }).type;
      if (eventType === 'oracle.pin') {
        const pinEvent = entry.event as unknown as PinLogEvent;
        const key = serializePinKey({
          operation: pinEvent.operation,
          queryDigest: pinEvent.queryDigest,
          provider: pinEvent.provider,
          version: pinEvent.version,
          context: pinEvent.context,
        });
        this.index.set(key, {
          key,
          seq: entry.seq,
          operation: pinEvent.operation,
          queryDigest: pinEvent.queryDigest,
          provider: pinEvent.provider,
          version: pinEvent.version,
          context: pinEvent.context,
        });
      }
    }
  }

  /** Compute query digest from args. */
  hashInput(args: unknown[]): string {
    return computeQueryDigest(args);
  }

  /** Store a pin in the log. */
  async pin(key: PinKey, value: unknown): Promise<void> {
    await this.open();

    const pinEvent: PinLogEvent = {
      type: 'oracle.pin',
      operation: key.operation,
      queryDigest: key.queryDigest,
      provider: key.provider,
      version: key.version,
      context: key.context,
      output: value,
      schemaVersion: 1,
    };

    const logEntryBase = createLogEntry(pinEvent as any, { ts: Date.now() as TimestampMs });
    const seq = ++(this.logStore as any).currentSeq;
    const id = crypto.randomUUID();
    const hash = hashEntry(logEntryBase);

    const logEntry: LogEntry = { ...logEntryBase, seq, id, hash };
    const line = JSON.stringify(logEntry) + '\n';
    const buffer = Buffer.from(line, 'utf-8');

    const segment = (this.logStore as any).segments[(this.logStore as any).currentSegment];
    await segment.fd.write(buffer, 0, buffer.length);
    segment.size += buffer.length;
    segment.entryCount++;

    if ((this.logStore as any).config.syncOnAppend) {
      await segment.fd.datasync();
    }

    // Update in-memory index
    const indexKey = serializePinKey(key);
    this.index.set(indexKey, {
      key: indexKey,
      seq,
      operation: key.operation,
      queryDigest: key.queryDigest,
      provider: key.provider,
      version: key.version,
      context: key.context,
    });

    // Prune index if too large
    if (this.index.size > this.maxIndexSize) {
      const entriesToRemove = this.index.size - this.maxIndexSize;
      const keys = Array.from(this.index.keys()).slice(0, entriesToRemove);
      for (const k of keys) {
        this.index.delete(k);
      }
    }
  }

  /** Get a pinned value. */
  async getPin(key: PinKey): Promise<unknown | null> {
    await this.open();

    const indexKey = serializePinKey(key);
    const indexEntry = this.index.get(indexKey);
    if (!indexEntry) return null;

    // Read the log entry
    const entry = await this.logStore.read(indexEntry.seq);
    if (!entry) return null;

    const pinEvent = entry.event as unknown as PinLogEvent;
    const eventType = (entry.event as { type?: string }).type;
    if (eventType === 'oracle.pin') {
      return pinEvent.output;
    }
    return null;
  }

  /** Check if a pin exists. */
  hasPin(key: PinKey): boolean {
    const indexKey = serializePinKey(key);
    return this.index.has(indexKey);
  }

  /** Close the pin store. */
  async close(): Promise<void> {
    await this.logStore.close();
    this.initialized = false;
    this.index.clear();
  }

  /** Get statistics. */
  getStats(): { pins: number; logEntries: number; logSize: number } {
    const logStats = this.logStore.getStats();
    return {
      pins: this.index.size,
      logEntries: logStats.entries,
      logSize: logStats.size,
    };
  }
}

/** Create a log-backed pin store. */
export function createLogBackedPinStore(config?: Partial<LogBackedPinStoreConfig>): LogBackedPinStore {
  return new LogBackedPinStore(config);
}