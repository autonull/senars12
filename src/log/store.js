/**
 * Log Store — append-only event storage with durability guarantees.
 *
 * The store is the single persistence site for all cognitive events.
 * It provides append, read, and query operations with ACID guarantees
 * for the event log.
 */
import { promises as fs } from 'node:fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { hashEntry, createLogEntry } from './events';
import { SenarsError } from '../errors/senars-error';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = join(__dirname, '..', '..', 'data', 'log');
/** Default configuration. */
export const defaultLogStoreConfig = {
    dir: DEFAULT_LOG_DIR,
    segmentSize: 64 * 1024 * 1024, // 64MB
    maxEntriesPerSegment: 100_000,
    syncOnAppend: true,
};
/** FinalizationRegistry for safety-net cleanup of unclosed LogStore instances. */
const logStoreFinalization = new FinalizationRegistry(({ store }) => {
    // Use a safe method to close if available
    const closeFn = store.close;
    if (typeof closeFn === 'function') {
        closeFn().catch(() => { });
    }
});
/**
 * Append-only log store with segment rotation and indexing.
 */
export class LogStore {
    config;
    segments = [];
    index = [];
    currentSeq = 0;
    currentSegment = 0;
    closed = false;
    constructor(config = {}) {
        this.config = { ...defaultLogStoreConfig, ...config };
        // Use a separate object as the held value to avoid "target and holdings must not be same"
        logStoreFinalization.register(this, { store: this });
    }
    /** Initialize the store, creating directories and loading existing segments. */
    async open() {
        if (!this.closed && this.segments.length > 0) {
            // Already open - idempotent
            return;
        }
        this.closed = false;
        await fs.mkdir(this.config.dir, { recursive: true });
        await this.loadSegments();
        await this.openCurrentSegment();
    }
    /** Load existing segments and build index. */
    async loadSegments() {
        const files = await fs.readdir(this.config.dir);
        const segmentFiles = files
            .filter((f) => f.startsWith('segment-') && f.endsWith('.log'))
            .sort((a, b) => {
            const an = parseInt(a.split('-')[1].split('.')[0], 10);
            const bn = parseInt(b.split('-')[1].split('.')[0], 10);
            return an - bn;
        });
        for (const file of segmentFiles) {
            const segmentNum = parseInt(file.split('-')[1].split('.')[0], 10);
            const path = join(this.config.dir, file);
            const stat = await fs.stat(path);
            const fd = await fs.open(path, 'r');
            this.segments.push({ fd, path, size: stat.size, entryCount: 0 });
            await this.indexSegment(segmentNum, fd, stat.size);
        }
        this.currentSegment = this.segments.length;
    }
    /** Build index for a segment by scanning entries. */
    async indexSegment(segmentNum, fd, size) {
        // Read entire segment into memory for reliable line parsing (max 64MB)
        const buffer = Buffer.alloc(size);
        const { bytesRead } = await fd.read(buffer, 0, size, 0);
        if (bytesRead === 0)
            return;
        const content = buffer.subarray(0, bytesRead).toString('utf-8');
        const lines = content.split('\n');
        let offset = 0;
        for (const line of lines) {
            const lineWithNewline = line + '\n';
            const lineByteLength = Buffer.byteLength(lineWithNewline, 'utf-8');
            if (line.trim()) {
                try {
                    const entry = JSON.parse(line);
                    this.index.push({
                        seq: entry.seq,
                        id: entry.id,
                        ts: entry.ts,
                        offset,
                        length: lineByteLength,
                        segment: segmentNum,
                    });
                    this.currentSeq = Math.max(this.currentSeq, entry.seq);
                }
                catch {
                    // Skip malformed lines
                }
            }
            offset += lineByteLength;
        }
    }
    /** Open the current write segment. */
    async openCurrentSegment() {
        const path = join(this.config.dir, `segment-${this.currentSegment.toString().padStart(6, '0')}.log`);
        const fd = await fs.open(path, 'a+');
        this.segments.push({ fd, path, size: 0, entryCount: 0 });
    }
    /** Append an event to the log. Returns the assigned sequence number. */
    async append(event, options = {}) {
        if (this.closed)
            throw new SenarsError('Log store is closed', 'VALIDATION_ERROR', { storeDir: this.config.dir });
        const entryBase = createLogEntry(event, options);
        const seq = ++this.currentSeq;
        const id = crypto.randomUUID();
        const hash = hashEntry(entryBase);
        const entry = { ...entryBase, seq, id, hash };
        const line = JSON.stringify(entry) + '\n';
        const buffer = Buffer.from(line, 'utf-8');
        const segment = this.segments[this.currentSegment];
        if (!segment)
            throw new SenarsError('No current segment', 'VALIDATION_ERROR', { currentSegment: this.currentSegment, segmentCount: this.segments.length });
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
    async rotateSegment() {
        const oldSegment = this.segments[this.currentSegment];
        if (!oldSegment)
            throw new SenarsError('No current segment to rotate', 'VALIDATION_ERROR', { currentSegment: this.currentSegment });
        await oldSegment.fd.datasync();
        await oldSegment.fd.close();
        // Reopen the rotated segment in read mode so it remains readable
        const readFd = await fs.open(oldSegment.path, 'r');
        oldSegment.fd = readFd;
        this.currentSegment++;
        await this.openCurrentSegment();
    }
    /** Read an entry by sequence number. */
    async read(seq) {
        const idx = this.index.find((e) => e.seq === seq);
        if (!idx)
            return null;
        const segment = this.segments[idx.segment];
        if (!segment)
            return null;
        const buffer = Buffer.alloc(idx.length);
        await segment.fd.read(buffer, 0, idx.length, idx.offset);
        const line = buffer.toString('utf-8').trim();
        return JSON.parse(line);
    }
    /** Read entries in a sequence range [start, end]. */
    async readRange(start, end) {
        const results = [];
        for (const idx of this.index) {
            if (idx.seq >= start && idx.seq <= end) {
                const entry = await this.read(idx.seq);
                if (entry)
                    results.push(entry);
            }
        }
        return results;
    }
    /** Read the last N entries. */
    async readTail(n) {
        const start = Math.max(1, this.currentSeq - n + 1);
        return this.readRange(start, this.currentSeq);
    }
    /** Query entries by event type. */
    async queryByType(type, limit = 100) {
        const results = [];
        for (let i = this.index.length - 1; i >= 0 && results.length < limit; i--) {
            const idx = this.index[i];
            if (!idx)
                continue;
            const entry = await this.read(idx.seq);
            if (entry && entry.event.type === type) {
                results.push(entry);
            }
        }
        return results.reverse();
    }
    /** Get the current sequence number (last appended). */
    getCurrentSeq() {
        return this.currentSeq;
    }
    /** Get the total number of entries. */
    getEntryCount() {
        return this.index.length;
    }
    /** Get the first sequence number. */
    getFirstSeq() {
        return this.index[0]?.seq ?? 1;
    }
    /** Get the last sequence number. */
    getLastSeq() {
        return this.currentSeq;
    }
    /** Close the store, flushing all buffers. */
    async close() {
        if (this.closed)
            return;
        this.closed = true;
        logStoreFinalization.unregister(this);
        for (const segment of this.segments) {
            await segment.fd.datasync();
            await segment.fd.close();
        }
        this.segments = [];
        this.index = [];
    }
    /** Get store statistics. */
    getStats() {
        return {
            segments: this.segments.length,
            entries: this.index.length,
            size: this.segments.reduce((sum, s) => sum + s.size, 0),
            currentSeq: this.currentSeq,
        };
    }
}
/** Create a log store with default configuration. */
export const createLogStore = (config) => {
    return new LogStore(config);
};
/**
 * In-memory LogStore implementation for testing.
 * Stores all data in memory without filesystem I/O.
 */
export class InMemoryLogStore extends LogStore {
    memorySegments = [];
    memoryIndex = [];
    memorySeq = 0;
    memoryClosed = false;
    constructor() {
        // Call parent with minimal config, but we'll override the methods
        super({ dir: ':memory:', syncOnAppend: false });
        // Unregister from finalization since we don't need it
        logStoreFinalization.unregister(this);
    }
    async open() {
        if (this.memoryClosed && this.memorySegments.length > 0) {
            return;
        }
        this.memoryClosed = false;
        // Initialize with one empty segment
        if (this.memorySegments.length === 0) {
            this.memorySegments.push(Buffer.alloc(0));
        }
    }
    async append(event, options = {}) {
        if (this.memoryClosed)
            throw new SenarsError('Log store is closed', 'VALIDATION_ERROR', { storeDir: ':memory:' });
        const entryBase = createLogEntry(event, options);
        const seq = ++this.memorySeq;
        const id = crypto.randomUUID();
        const hash = hashEntry(entryBase);
        const entry = { ...entryBase, seq, id, hash };
        const line = JSON.stringify(entry) + '\n';
        const buffer = Buffer.from(line, 'utf-8');
        // Append to current segment
        const currentSegment = this.memorySegments[this.memorySegments.length - 1];
        const newSegment = Buffer.concat([currentSegment, buffer]);
        this.memorySegments[this.memorySegments.length - 1] = newSegment;
        this.memoryIndex.push({
            seq,
            id,
            ts: entry.ts,
            offset: currentSegment.length,
            length: buffer.length,
            segment: this.memorySegments.length - 1,
        });
        // No sync needed for in-memory
        // Check rotation (simplified - just create new segment if over size)
        if (newSegment.length >= this.config.segmentSize || this.memoryIndex.length >= this.config.maxEntriesPerSegment) {
            this.memorySegments.push(Buffer.alloc(0));
        }
        return seq;
    }
    async read(seq) {
        const idx = this.memoryIndex.find((e) => e.seq === seq);
        if (!idx)
            return null;
        const segment = this.memorySegments[idx.segment];
        if (!segment)
            return null;
        const buffer = segment.subarray(idx.offset, idx.offset + idx.length);
        const line = buffer.toString('utf-8').trim();
        return JSON.parse(line);
    }
    async readRange(start, end) {
        const results = [];
        for (let seq = start; seq <= end; seq++) {
            const entry = await this.read(seq);
            if (entry)
                results.push(entry);
        }
        return results;
    }
    async query(options = {}) {
        const { fromSeq = 1, toSeq = this.memorySeq, limit = 1000, types } = options;
        const results = [];
        for (let seq = fromSeq; seq <= toSeq && results.length < limit; seq++) {
            const entry = await this.read(seq);
            if (entry && (!types || types.includes(entry.event.type))) {
                results.push(entry);
            }
        }
        return results;
    }
    getFirstSeq() {
        return this.memoryIndex[0]?.seq ?? 1;
    }
    getLastSeq() {
        return this.memorySeq;
    }
    async close() {
        if (this.memoryClosed)
            return;
        this.memoryClosed = true;
        this.memorySegments = [];
        this.memoryIndex = [];
        this.memorySeq = 0;
    }
    getStats() {
        return {
            segments: this.memorySegments.length,
            entries: this.memoryIndex.length,
            size: this.memorySegments.reduce((sum, s) => sum + s.length, 0),
            currentSeq: this.memorySeq,
        };
    }
}
/**
 * Create an in-memory log store for testing.
 */
export const createInMemoryLogStore = () => {
    return new InMemoryLogStore();
};
