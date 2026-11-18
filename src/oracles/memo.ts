/**
 * Oracle Memoization — caching layer for deterministic oracle calls.
 *
 * Provides memoization with configurable TTL, size limits, and persistence.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import type { UUID, TimestampMs } from '../generated/schemas.js';
import type { OracleInput, OracleOutput, OracleOperation } from './oracle.js';

/** Memo entry. */
export interface MemoEntry<T = unknown> {
  /** Unique entry ID. */
  id: UUID;
  /** Operation this memo is for. */
  operation: OracleOperation;
  /** Input hash. */
  inputHash: string;
  /** The memoized output. */
  output: OracleOutput<T>;
  /** When this entry was created. */
  createdAt: TimestampMs;
  /** When this entry expires (0 = no expiry). */
  expiresAt: TimestampMs;
  /** Access count. */
  hits: number;
  /** Last access time. */
  lastAccessed: TimestampMs;
}

/** Memo store configuration. */
export interface MemoStoreConfig {
  /** Directory for memo files. */
  dir: string;
  /** Maximum entries per file. */
  maxEntriesPerFile: number;
  /** Default TTL in milliseconds (0 = no expiry). */
  defaultTtlMs: number;
  /** Maximum total entries in memory. */
  maxMemoryEntries: number;
}

/** Default memo store configuration. */
export const defaultMemoStoreConfig: MemoStoreConfig = {
  dir: join(process.cwd(), 'data', 'memo'),
  maxEntriesPerFile: 10000,
  defaultTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  maxMemoryEntries: 100000,
};

/** In-memory memo index entry. */
interface MemoIndexEntry {
  id: UUID;
  operation: OracleOperation;
  inputHash: string;
  file: string;
  offset: number;
  expiresAt: TimestampMs;
}

/**
 * Memo store for caching oracle calls.
 * Supports both in-memory and persistent storage.
 */
export class MemoStore {
  private config: MemoStoreConfig;
  private index = new Map<string, MemoIndexEntry>();
  private memoryCache = new Map<string, MemoEntry>();
  private currentFile = 0;
  private currentCount = 0;
  private currentFd: fs.FileHandle | null = null;
  private initialized = false;

  constructor(config: Partial<MemoStoreConfig> = {}) {
    this.config = { ...defaultMemoStoreConfig, ...config };
  }

  /** Initialize the memo store. */
  async open(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(this.config.dir, { recursive: true });
    await this.loadIndex();
    await this.openCurrentFile();
    this.initialized = true;
  }

  /** Load existing memos into index. */
  private async loadIndex(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.dir);
      const memoFiles = files.filter(f => f.startsWith('memo-') && f.endsWith('.jsonl')).sort();

      for (const file of memoFiles) {
        const path = join(this.config.dir, file);
        const content = await fs.readFile(path, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l);

        let offset = 0;
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as MemoEntry;
            // Skip expired entries
            if (entry.expiresAt > 0 && entry.expiresAt < Date.now()) {
              offset += Buffer.byteLength(line + '\n', 'utf-8');
              continue;
            }
            const key = `${entry.operation}:${entry.inputHash}`;
            this.index.set(key, {
              id: entry.id,
              operation: entry.operation,
              inputHash: entry.inputHash,
              file,
              offset,
              expiresAt: entry.expiresAt,
            });
            offset += Buffer.byteLength(line + '\n', 'utf-8');
            this.currentCount++;
          } catch {
            // Skip malformed
          }
        }
      }
      this.currentFile = memoFiles.length;
    } catch {
      // No existing memos
    }
  }

  /** Open current write file. */
  private async openCurrentFile(): Promise<void> {
    const fileName = `memo-${this.currentFile.toString().padStart(4, '0')}.jsonl`;
    const path = join(this.config.dir, fileName);
    this.currentFd = await fs.open(path, 'a');
  }

  /** Generate input hash from operation and arguments. */
  hashInput(operation: OracleOperation, args: unknown[]): string {
    const json = JSON.stringify({ operation, args }, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return createHash('sha256').update(json).digest('hex').substring(0, 32);
  }

  /** Get a memoized value. */
  async get<T>(operation: OracleOperation, args: unknown[]): Promise<OracleOutput<T> | null> {
    const inputHash = this.hashInput(operation, args);
    const key = `${operation}:${inputHash}`;

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (memoryEntry.expiresAt === 0 || memoryEntry.expiresAt > Date.now()) {
        memoryEntry.hits++;
        memoryEntry.lastAccessed = Date.now() as TimestampMs;
        return memoryEntry.output as OracleOutput<T>;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check persistent index
    const indexEntry = this.index.get(key);
    if (indexEntry) {
      if (indexEntry.expiresAt > 0 && indexEntry.expiresAt < Date.now()) {
        this.index.delete(key);
        return null;
      }

      const path = join(this.config.dir, indexEntry.file);
      try {
        const content = await fs.readFile(path, 'utf-8');
        const lines = content.trim().split('\n');
        for (const line of lines) {
          const entry = JSON.parse(line) as MemoEntry<T>;
          if (entry.inputHash === inputHash && entry.operation === operation) {
            // Promote to memory cache
            if (this.memoryCache.size < this.config.maxMemoryEntries) {
              this.memoryCache.set(key, entry);
            }
            entry.hits++;
            entry.lastAccessed = Date.now() as TimestampMs;
            return entry.output as OracleOutput<T>;
          }
        }
      } catch {
        // File read error, fall through to miss
      }
    }

    return null;
  }

  /** Store a memoized value. */
  async set<T>(operation: OracleOperation, args: unknown[], output: OracleOutput<T>, ttlMs?: number): Promise<UUID> {
    await this.open();

    const inputHash = this.hashInput(operation, args);
    const key = `${operation}:${inputHash}`;
    const now = Date.now() as TimestampMs;
    const ttl = ttlMs ?? this.config.defaultTtlMs;
    const expiresAt = ttl > 0 ? (now + ttl) as TimestampMs : 0;

    const id = crypto.randomUUID() as UUID;
    const entry: MemoEntry<T> = {
      id,
      operation,
      inputHash,
      output,
      createdAt: now,
      expiresAt,
      hits: 0,
      lastAccessed: now,
    };

    // Store in memory cache
    if (this.memoryCache.size < this.config.maxMemoryEntries) {
      this.memoryCache.set(key, entry);
    }

    // Persist to file
    if (this.currentFd === null) await this.openCurrentFile();

    const line = JSON.stringify(entry) + '\n';
    const buffer = Buffer.from(line, 'utf-8');
    await this.currentFd!.write(buffer);
    this.currentCount++;

    this.index.set(key, {
      id,
      operation,
      inputHash,
      file: `memo-${this.currentFile.toString().padStart(4, '0')}.jsonl`,
      offset: 0,
      expiresAt,
    });

    if (this.currentCount >= this.config.maxEntriesPerFile) {
      await this.currentFd!.close();
      this.currentFile++;
      this.currentCount = 0;
      await this.openCurrentFile();
    }

    return id;
  }

  /** Check if a memo exists (and is not expired). */
  has(operation: OracleOperation, args: unknown[]): boolean {
    const inputHash = this.hashInput(operation, args);
    const key = `${operation}:${inputHash}`;

    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      return entry.expiresAt === 0 || entry.expiresAt > Date.now();
    }

    const indexEntry = this.index.get(key);
    if (indexEntry) {
      return indexEntry.expiresAt === 0 || indexEntry.expiresAt > Date.now();
    }

    return false;
  }

  /** Invalidate a specific memo. */
  async invalidate(operation: OracleOperation, args: unknown[]): Promise<boolean> {
    const inputHash = this.hashInput(operation, args);
    const key = `${operation}:${inputHash}`;

    this.memoryCache.delete(key);
    this.index.delete(key);
    return true;
  }

  /** Invalidate all memos for an operation. */
  async invalidateOperation(operation: OracleOperation): Promise<number> {
    let count = 0;
    for (const [key, entry] of this.index) {
      if (entry.operation === operation) {
        this.index.delete(key);
        count++;
      }
    }
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`${operation}:`)) {
        this.memoryCache.delete(key);
      }
    }
    return count;
  }

  /** Clear all memos. */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    this.index.clear();
    if (this.currentFd) {
      await this.currentFd.close();
      this.currentFd = null;
    }
    this.currentFile = 0;
    this.currentCount = 0;
    await this.openCurrentFile();
  }

  /** Close the memo store. */
  async close(): Promise<void> {
    if (this.currentFd !== null) {
      await this.currentFd.close();
      this.currentFd = null;
    }
  }

  /** Get statistics. */
  getStats(): {
    memoryEntries: number;
    persistentEntries: number;
    files: number;
    operations: Set<OracleOperation>;
    hitRate: number;
  } {
    const operations = new Set<OracleOperation>();
    let totalHits = 0;
    for (const entry of this.memoryCache.values()) {
      operations.add(entry.operation);
      totalHits += entry.hits;
    }
    for (const entry of this.index.values()) {
      operations.add(entry.operation);
    }
    const totalAccesses = totalHits + this.index.size;
    return {
      memoryEntries: this.memoryCache.size,
      persistentEntries: this.index.size,
      files: this.currentFile + 1,
      operations,
      hitRate: totalAccesses > 0 ? totalHits / totalAccesses : 0,
    };
  }

  /** Clean up expired entries. */
  async cleanup(): Promise<number> {
    const now = Date.now();
    let removed = 0;

    // Clean memory cache
    for (const [key, entry] of this.memoryCache) {
      if (entry.expiresAt > 0 && entry.expiresAt < now) {
        this.memoryCache.delete(key);
        removed++;
      }
    }

    // Clean index (persistent entries are cleaned on next load)
    for (const [key, entry] of this.index) {
      if (entry.expiresAt > 0 && entry.expiresAt < now) {
        this.index.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/** Create a memo store. */
export function createMemoStore(config?: Partial<MemoStoreConfig>): MemoStore {
  return new MemoStore(config);
}

/** Memoization decorator for oracle methods. */
export function memoize<T extends OracleInput, TOutput>(
  store: MemoStore,
  operation: OracleOperation,
  ttlMs?: number
) {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<(input: T) => Promise<OracleOutput<TOutput>>>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (input: T) {
      // Try to get from memo
      const memoized = await store.get<TOutput>(operation, input.args);
      if (memoized) {
        return { ...memoized, meta: { ...memoized.meta, pinned: true } };
      }

      // Call original method
      const result = await originalMethod.apply(this, [input]);

      // Store in memo
      await store.set(operation, input.args, result, ttlMs);

      return result;
    };

    return descriptor;
  };
}

/** Higher-order function to add memoization to an oracle call. */
export async function withMemo<TInput extends OracleInput, TOutput>(
  store: MemoStore,
  operation: OracleOperation,
  input: TInput,
  compute: () => Promise<OracleOutput<TOutput>>,
  ttlMs?: number
): Promise<OracleOutput<TOutput>> {
  const memoized = await store.get<TOutput>(operation, input.args);
  if (memoized) {
    return { ...memoized, meta: { ...memoized.meta, pinned: true } };
  }

  const result = await compute();
  await store.set(operation, input.args, result, ttlMs);
  return result;
}