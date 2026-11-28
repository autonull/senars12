/**
 * Log Replay — deterministic reconstruction of state from the event log.
 *
 * Replay is the primary mechanism for state recovery, verification,
 * and time-travel debugging. It processes events in order through
 * a reducer function to reconstruct any derived state.
 */
import type { LogEntry, CognitiveEvent } from './events';
import type { LogStore } from './store';
/** Reducer function for replay: (state, event) -> newState. */
export type Reducer<S, E extends CognitiveEvent = CognitiveEvent> = (state: S, event: E, entry: LogEntry) => S;
/** Replay options. */
export interface ReplayOptions<S> {
    /** Initial state for the reducer. */
    initialState: S;
    /** Reducer function to apply events. */
    reducer: Reducer<S>;
    /** Optional filter to skip events. */
    filter?: (event: CognitiveEvent) => boolean;
    /** Start sequence (inclusive). Default: first event. */
    fromSeq?: number;
    /** End sequence (inclusive). Default: last event. */
    toSeq?: number;
    /** Maximum number of events to process. */
    limit?: number;
    /** Progress callback: (processed, total, currentEvent). */
    onProgress?: (processed: number, total: number, event: CognitiveEvent) => void;
}
/** Replay result with final state and metadata. */
export interface ReplayResult<S> {
    /** Final reconstructed state. */
    state: S;
    /** Number of events processed. */
    eventsProcessed: number;
    /** First sequence number processed. */
    fromSeq: number;
    /** Last sequence number processed. */
    toSeq: number;
    /** Whether replay completed (hit toSeq or end of log). */
    completed: boolean;
    /** Duration in milliseconds. */
    durationMs: number;
}
/**
 * Replay events from a log store through a reducer.
 *
 * This is the core replay function. It reads events in sequence order
 * and applies the reducer to accumulate state.
 */
export declare function replay<S>(store: LogStore, options: ReplayOptions<S>): Promise<ReplayResult<S>>;
/**
 * Replay with checkpointing: periodically save state for faster resume.
 */
export interface CheckpointReplayOptions<S> extends ReplayOptions<S> {
    /** Checkpoint interval (every N events). */
    checkpointInterval: number;
    /** Save checkpoint function. */
    saveCheckpoint: (seq: number, state: S) => Promise<void>;
    /** Load checkpoint function. Returns { seq, state } or null. */
    loadCheckpoint: () => Promise<{
        seq: number;
        state: S;
    } | null>;
}
export interface CheckpointReplayResult<S> extends ReplayResult<S> {
    /** Sequence number of the last checkpoint. */
    lastCheckpointSeq: number;
}
/**
 * Replay with periodic checkpointing for long-running replays.
 */
export declare function replayWithCheckpoints<S>(store: LogStore, options: CheckpointReplayOptions<S>): Promise<CheckpointReplayResult<S>>;
/**
 * Parallel replay for independent event streams.
 * Splits events by a partition key and replays each partition in parallel.
 */
export interface ParallelReplayOptions<S, K> extends ReplayOptions<S> {
    /** Extract partition key from event. */
    partitionKey: (event: CognitiveEvent) => K;
    /** Merge partition states into final state. */
    merge: (states: Map<K, S>) => S;
    /** Number of parallel workers. */
    concurrency?: number;
}
export interface ParallelReplayResult<S> extends ReplayResult<S> {
    /** Per-partition event counts. */
    partitionCounts: Map<string, number>;
}
/**
 * Replay events in parallel partitions for independent sub-streams.
 * Use when events can be partitioned by a key (e.g., by term, by agent).
 */
export declare function replayParallel<S, K>(store: LogStore, options: ParallelReplayOptions<S, K>): Promise<ParallelReplayResult<S>>;
/**
 * Verify that replay produces the same state as a reference.
 * Used for golden replay tests.
 */
export declare function verifyReplay<S>(store: LogStore, reducer: Reducer<S>, expectedState: S, options?: Partial<ReplayOptions<S>>): Promise<{
    match: boolean;
    diff?: unknown;
    result: ReplayResult<S>;
}>;
/**
 * Create a reducer that collects all events of a specific type.
 */
export declare function createCollectorReducer<T extends CognitiveEvent>(type: T['type']): Reducer<T[], T>;
/**
 * Create a reducer that builds a map keyed by a field.
 */
export declare function createMapReducer<K, T extends CognitiveEvent>(keyFn: (event: T) => K, valueFn: (event: T, entry: LogEntry) => unknown): Reducer<Map<K, unknown>, T>;
//# sourceMappingURL=replay.d.ts.map