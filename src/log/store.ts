/**
 * Log Store — append-only event storage with durability guarantees.
 *
 * The store is the single persistence site for all cognitive events.
 * It provides append, read, and query operations with ACID guarantees
 * for the event log.
 */

import { promises as fs } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import type { LogEntry, CognitiveEvent, UUID, TimestampMs } from './events.js';
import { hashEntry, createLogEntry } from './events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = join(__dirname, '..', '..', 'data', 'log');

/** Configuration for the log store. */
export interface LogStoreConfig {
  /** Directory for log segments. */
  dir: string;
  /** Maximum segment size in bytes before rotation. */
  segmentSize: number;
  /** Maximum entries per segment. */
  maxEntriesPerSegment: number;
  /** Whether to fsync after each append. */
  syncOnAppend: boolean;
}

/** Default configuration. */
export const defaultLogStoreConfig: LogStoreConfig = {
  dir: DEFAULT_LOG_DIR,
  segmentSize: 64 * 1024 * 1024, // 64MB
  maxEntriesPerSegment: 100_000,
  syncOnAppend: true,
};

/** In-memory index entry. */
interface IndexEntry {
  seq: number;
  id: UUID;
  ts: TimestampMs;
  offset: number;
  length: number;
  segment: number;
}

/** Log segment file handle. */
interface SegmentHandle {
  fd: FileHandle;
  path: string;
  size: number;
  entryCount: number;
}

/**
 * Append-only log store with segment rotation and indexing.
 */
export class LogStore {
  private config: LogStoreConfig;
  private segments: SegmentHandle[] = [];
  private index: IndexEntry[] = [];
  private currentSeq = 0;
  private currentSegment = 0;
  private closed = false;

  constructor(config: Partial<LogStoreConfig> = {}) {
    this.config = { ...defaultLogStoreConfig, ...config };
  }

  /** Initialize the store, creating directories and loading existing segments. */
  async open(): Promise<void> {
    await fs.mkdir(this.config.dir, { recursive: true });
    await this.loadSegments();
    await this.openCurrentSegment();
  }

  /** Load existing segments and build index. */
  private async loadSegments(): Promise<void> {
    const files = await fs.readdir(this.config.dir);
    const segmentFiles = files
      .filter((f) => f.startsWith('segment-') && f.endsWith('.log'))
      .sort((a, b) => {
        const an = parseInt(a.split('-')[1]!.split('.')[0]!, 10);
        const bn = parseInt(b.split('-')[1]!.split('.')[0]!, 10);
        return an - bn;
      });

    for (const file of segmentFiles) {
      const segmentNum = parseInt(file.split('-')[1]!.split('.')[0]!, 10);
      const path = join(this.config.dir, file);
      const stat = await fs.stat(path);
      const fd = await fs.open(path, 'r');
      this.segments.push({ fd, path, size: stat.size, entryCount: 0 });
      await this.indexSegment(segmentNum, fd, stat.size);
    }
    this.currentSegment = this.segments.length;
  }

  /** Build index for a segment by scanning entries. */
  private async indexSegment(segmentNum: number, fd: FileHandle, size: number): Promise<void> {
    // Read entire segment into memory for reliable line parsing (max 64MB)
    const buffer = Buffer.alloc(size);
    const { bytesRead } = await fd.read(buffer, 0, size, 0);
    if (bytesRead === 0) return;

    const content = buffer.subarray(0, bytesRead).toString('utf-8');
    const lines = content.split('\n');
    let offset = 0;

    for (const line of lines) {
      const lineWithNewline = line + '\n';
      const lineByteLength = Buffer.byteLength(lineWithNewline, 'utf-8');
      if (line.trim()) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          this.index.push({
            seq: entry.seq,
            id: entry.id,
            ts: entry.ts,
            offset,
            length: lineByteLength,
            segment: segmentNum,
          });
          this.currentSeq = Math.max(this.currentSeq, entry.seq);
        } catch {
          // Skip malformed lines
        }
      }
      offset += lineByteLength;
    }
  }

  /** Open the current write segment. */
  private async openCurrentSegment(): Promise<void> {
    const path = join(this.config.dir, `segment-${this.currentSegment.toString().padStart(6, '0')}.log`);
    const fd = await fs.open(path, 'a+');
    this.segments.push({ fd, path, size: 0, entryCount: 0 });
  }

  /** Append an event to the log. Returns the assigned sequence number. */
  async append(event: CognitiveEvent, options: { parents?: UUID[]; ts?: TimestampMs } = {}): Promise<number> {
    if (this.closed) throw new Error('Log store is closed');

    const entryBase = createLogEntry(event, options);
    const seq = ++this.currentSeq;
    const id = crypto.randomUUID();
    const hash = hashEntry(entryBase);

    const entry: LogEntry = { ...entryBase, seq, id, hash };
    const line = JSON.stringify(entry) + '\n';
    const buffer = Buffer.from(line, 'utf-8');

    const segment = this.segments[this.currentSegment];
    if (!segment) throw new Error('No current segment');
    await segment.fd.write(buffer, 0, buffer.length);
    segment.size += buffer.length;
    segment.entryCount++;

    this.index.push({
      seq,
      id,
      ts: entry.ts,
      offset: segment.size - buffer.length,
      length: buffer.length,
      segment: this.currentSegment,
    });

    if (this.config.syncOnAppend) {
      await segment.fd.datasync();
    }

    // Check rotation
    if (segment.size >= this.config.segmentSize || segment.entryCount >= this.config.maxEntriesPerSegment) {
      await this.rotateSegment();
    }

    return seq;
  }

  /** Rotate to a new segment. */
  private async rotateSegment(): Promise<void> {
    const oldSegment = this.segments[this.currentSegment];
    if (!oldSegment) throw new Error('No current segment to rotate');
    await oldSegment.fd.datasync();
    await oldSegment.fd.close();
    // Reopen the rotated segment in read mode so it remains readable
    const readFd = await fs.open(oldSegment.path, 'r');
    oldSegment.fd = readFd;
    this.currentSegment++;
    await this.openCurrentSegment();
  }

  /** Read an entry by sequence number. */
  async read(seq: number): Promise<LogEntry | null> {
    const idx = this.index.find((e) => e.seq === seq);
    if (!idx) return null;

    const segment = this.segments[idx.segment];
    if (!segment) return null;
    const buffer = Buffer.alloc(idx.length);
    await segment.fd.read(buffer, 0, idx.length, idx.offset);
    const line = buffer.toString('utf-8').trim();
    return JSON.parse(line) as LogEntry;
  }

  /** Read entries in a sequence range [start, end]. */
  async readRange(start: number, end: number): Promise<LogEntry[]> {
    const results: LogEntry[] = [];
    for (const idx of this.index) {
      if (idx.seq >= start && idx.seq <= end) {
        const entry = await this.read(idx.seq);
        if (entry) results.push(entry);
      }
    }
    return results;
  }

  /** Read the last N entries. */
  async readTail(n: number): Promise<LogEntry[]> {
    const start = Math.max(1, this.currentSeq - n + 1);
    return this.readRange(start, this.currentSeq);
  }

  /** Query entries by event type. */
  async queryByType(type: CognitiveEvent['type'], limit = 100): Promise<LogEntry[]> {
    const results: LogEntry[] = [];
    for (let i = this.index.length - 1; i >= 0 && results.length < limit; i--) {
      const idx = this.index[i];
      if (!idx) continue;
      const entry = await this.read(idx.seq);
      if (entry && entry.event.type === type) {
        results.push(entry);
      }
    }
    return results.reverse();
  }

  /** Get the current sequence number (last appended). */
  getCurrentSeq(): number {
    return this.currentSeq;
  }

  /** Get the total number of entries. */
  getEntryCount(): number {
    return this.index.length;
  }

  /** Get the first sequence number. */
  getFirstSeq(): number {
    return this.index[0]?.seq ?? 1;
  }

  /** Get the last sequence number. */
  getLastSeq(): number {
    return this.currentSeq;
  }

  /** Close the store, flushing all buffers. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    for (const segment of this.segments) {
      await segment.fd.datasync();
      await segment.fd.close();
    }
  }

  /** Get store statistics. */
  getStats(): { segments: number; entries: number; size: number; currentSeq: number } {
    return {
      segments: this.segments.length,
      entries: this.index.length,
      size: this.segments.reduce((sum, s) => sum + s.size, 0),
      currentSeq: this.currentSeq,
    };
  }
}

/** Create a log store with default configuration. */
export const createLogStore = (config?: Partial<LogStoreConfig>): LogStore => {
  return new LogStore(config);
};