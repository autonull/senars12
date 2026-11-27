/**
 * Log Store — append-only event storage with durability guarantees.
 *
 * The store is the single persistence site for all cognitive events.
 * It provides append, read, and query operations with ACID guarantees
 * for the event log.
 */
import type { LogEntry, CognitiveEvent, UUID, TimestampMs } from './events';
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
export declare const defaultLogStoreConfig: LogStoreConfig;
/**
 * Append-only log store with segment rotation and indexing.
 */
export declare class LogStore {
    protected config: LogStoreConfig;
    private segments;
    private index;
    private currentSeq;
    private currentSegment;
    private closed;
    constructor(config?: Partial<LogStoreConfig>);
    /** Initialize the store, creating directories and loading existing segments. */
    open(): Promise<void>;
    /** Load existing segments and build index. */
    private loadSegments;
    /** Build index for a segment by scanning entries. */
    private indexSegment;
    /** Open the current write segment. */
    private openCurrentSegment;
    /** Append an event to the log. Returns the assigned sequence number. */
    append(event: CognitiveEvent, options?: {
        parents?: UUID[];
        ts?: TimestampMs;
    }): Promise<number>;
    /** Rotate to a new segment. */
    private rotateSegment;
    /** Read an entry by sequence number. */
    read(seq: number): Promise<LogEntry | null>;
    /** Read entries in a sequence range [start, end]. */
    readRange(start: number, end: number): Promise<LogEntry[]>;
    /** Read the last N entries. */
    readTail(n: number): Promise<LogEntry[]>;
    /** Query entries by event type. */
    queryByType(type: CognitiveEvent['type'], limit?: number): Promise<LogEntry[]>;
    /** Get the current sequence number (last appended). */
    getCurrentSeq(): number;
    /** Get the total number of entries. */
    getEntryCount(): number;
    /** Get the first sequence number. */
    getFirstSeq(): number;
    /** Get the last sequence number. */
    getLastSeq(): number;
    /** Close the store, flushing all buffers. */
    close(): Promise<void>;
    /** Get store statistics. */
    getStats(): {
        segments: number;
        entries: number;
        size: number;
        currentSeq: number;
    };
}
/** Create a log store with default configuration. */
export declare const createLogStore: (config?: Partial<LogStoreConfig>) => LogStore;
/**
 * In-memory LogStore implementation for testing.
 * Stores all data in memory without filesystem I/O.
 */
export declare class InMemoryLogStore extends LogStore {
    private memorySegments;
    private memoryIndex;
    private memorySeq;
    private memoryClosed;
    constructor();
    open(): Promise<void>;
    append(event: CognitiveEvent, options?: {
        parents?: UUID[];
        ts?: TimestampMs;
    }): Promise<number>;
    read(seq: number): Promise<LogEntry | null>;
    readRange(start: number, end: number): Promise<LogEntry[]>;
    query(options?: {
        fromSeq?: number;
        toSeq?: number;
        limit?: number;
        types?: string[];
    }): Promise<LogEntry[]>;
    getFirstSeq(): number;
    getLastSeq(): number;
    close(): Promise<void>;
    getStats(): {
        segments: number;
        entries: number;
        size: number;
        currentSeq: number;
    };
}
/**
 * Create an in-memory log store for testing.
 */
export declare const createInMemoryLogStore: () => InMemoryLogStore;
//# sourceMappingURL=store.d.ts.map