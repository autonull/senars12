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
export type Reducer<S, E extends CognitiveEvent = CognitiveEvent> = (
  state: S,
  event: E,
  entry: LogEntry
) => S;

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
export async function replay<S>(
  store: LogStore,
  options: ReplayOptions<S>
): Promise<ReplayResult<S>> {
  const {
    initialState,
    reducer,
    filter,
    fromSeq = store.getFirstSeq(),
    toSeq = store.getLastSeq(),
    limit,
    onProgress,
  } = options;

  let state = initialState;
  let eventsProcessed = 0;
  const startTime = Date.now();

  const totalExpected = Math.min(
    limit ?? Number.MAX_SAFE_INTEGER,
    toSeq - fromSeq + 1
  );

  for (let seq = fromSeq; seq <= toSeq; seq++) {
    if (limit && eventsProcessed >= limit) break;

    const entry = await store.read(seq);
    if (!entry) continue;

    if (filter && !filter(entry.event)) continue;

    state = reducer(state, entry.event, entry);
    eventsProcessed++;

    if (onProgress) {
      onProgress(eventsProcessed, totalExpected, entry.event);
    }
  }

  return {
    state,
    eventsProcessed,
    fromSeq,
    toSeq: Math.min(toSeq, fromSeq + eventsProcessed - 1),
    completed: eventsProcessed >= totalExpected || toSeq === store.getLastSeq(),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Replay with checkpointing: periodically save state for faster resume.
 */
export interface CheckpointReplayOptions<S> extends ReplayOptions<S> {
  /** Checkpoint interval (every N events). */
  checkpointInterval: number;
  /** Save checkpoint function. */
  saveCheckpoint: (seq: number, state: S) => Promise<void>;
  /** Load checkpoint function. Returns { seq, state } or null. */
  loadCheckpoint: () => Promise<{ seq: number; state: S } | null>;
}

export interface CheckpointReplayResult<S> extends ReplayResult<S> {
  /** Sequence number of the last checkpoint. */
  lastCheckpointSeq: number;
}

/**
 * Replay with periodic checkpointing for long-running replays.
 */
export async function replayWithCheckpoints<S>(
  store: LogStore,
  options: CheckpointReplayOptions<S>
): Promise<CheckpointReplayResult<S>> {
  const {
    initialState,
    reducer,
    filter,
    fromSeq = store.getFirstSeq(),
    toSeq = store.getLastSeq(),
    limit,
    onProgress,
    checkpointInterval,
    saveCheckpoint,
    loadCheckpoint,
  } = options;

  // Try to resume from checkpoint
  const checkpoint = await loadCheckpoint();
  let state = checkpoint?.state ?? initialState;
  let startSeq = (checkpoint?.seq ?? fromSeq - 1) + 1;
  let eventsProcessed = 0;
  let lastCheckpointSeq = checkpoint?.seq ?? fromSeq - 1;
  const startTime = Date.now();

  const totalExpected = Math.min(
    limit ?? Number.MAX_SAFE_INTEGER,
    toSeq - startSeq + 1
  );

  for (let seq = startSeq; seq <= toSeq; seq++) {
    if (limit && eventsProcessed >= limit) break;

    const entry = await store.read(seq);
    if (!entry) continue;

    if (filter && !filter(entry.event)) continue;

    state = reducer(state, entry.event, entry);
    eventsProcessed++;

    // Checkpoint
    if (eventsProcessed % checkpointInterval === 0) {
      await saveCheckpoint(seq, state);
      lastCheckpointSeq = seq;
    }

    if (onProgress) {
      onProgress(eventsProcessed, totalExpected, entry.event);
    }
  }

  // Final checkpoint
  if (eventsProcessed > 0) {
    await saveCheckpoint(lastCheckpointSeq + eventsProcessed, state);
  }

  return {
    state,
    eventsProcessed,
    fromSeq: startSeq,
    toSeq: Math.min(toSeq, startSeq + eventsProcessed - 1),
    completed: eventsProcessed >= totalExpected || toSeq === store.getLastSeq(),
    durationMs: Date.now() - startTime,
    lastCheckpointSeq,
  };
}

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
export async function replayParallel<S, K>(
  store: LogStore,
  options: ParallelReplayOptions<S, K>
): Promise<ParallelReplayResult<S>> {
  const {
    initialState,
    reducer,
    filter,
    fromSeq = store.getFirstSeq(),
    toSeq = store.getLastSeq(),
    limit,
    onProgress,
    partitionKey,
    merge,
    concurrency = navigator?.hardwareConcurrency ?? 4,
  } = options;

  // First pass: collect entries and partition them
  const partitions = new Map<K, LogEntry[]>();
  let totalEntries = 0;

  for (let seq = fromSeq; seq <= toSeq; seq++) {
    if (limit && totalEntries >= limit) break;

    const entry = await store.read(seq);
    if (!entry) continue;
    if (filter && !filter(entry.event)) continue;

    const key = partitionKey(entry.event);
    if (!partitions.has(key)) partitions.set(key, []);
    partitions.get(key)!.push(entry);
    totalEntries++;
  }

  // Replay each partition
  const partitionStates = new Map<K, S>();
  const partitionCounts = new Map<string, number>();
  let totalProcessed = 0;
  const startTime = Date.now();

  const partitionEntries = Array.from(partitions.entries());
  const batchSize = Math.ceil(partitionEntries.length / concurrency);

  for (let i = 0; i < partitionEntries.length; i += batchSize) {
    const batch = partitionEntries.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async ([key, entries]) => {
        let state = initialState;
        let count = 0;
        for (const entry of entries) {
          state = reducer(state, entry.event, entry);
          count++;
        }
        partitionStates.set(key, state);
        partitionCounts.set(String(key), count);
        totalProcessed += count;
      })
    );

    if (onProgress) {
      onProgress(totalProcessed, totalEntries, { type: 'Progress' } as unknown as CognitiveEvent);
    }
  }

  const finalState = merge(partitionStates);

  return {
    state: finalState,
    eventsProcessed: totalProcessed,
    fromSeq,
    toSeq,
    completed: true,
    durationMs: Date.now() - startTime,
    partitionCounts,
  };
}

/**
 * Verify that replay produces the same state as a reference.
 * Used for golden replay tests.
 */
export async function verifyReplay<S>(
  store: LogStore,
  reducer: Reducer<S>,
  expectedState: S,
  options: Partial<ReplayOptions<S>> = {}
): Promise<{ match: boolean; diff?: unknown; result: ReplayResult<S> }> {
  const result = await replay(store, { initialState: expectedState, reducer, ...options });
  const match = JSON.stringify(result.state) === JSON.stringify(expectedState);
  return { match, diff: match ? undefined : result.state, result };
}

/**
 * Create a reducer that collects all events of a specific type.
 */
export function createCollectorReducer<T extends CognitiveEvent>(
  type: T['type']
): Reducer<T[], T> {
  return (events, event) => {
    if (event.type === type) {
      return [...events, event as T];
    }
    return events;
  };
}

/**
 * Create a reducer that builds a map keyed by a field.
 */
export function createMapReducer<K, T extends CognitiveEvent>(
  keyFn: (event: T) => K,
  valueFn: (event: T, entry: LogEntry) => unknown
): Reducer<Map<K, unknown>, T> {
  return (map, event, entry) => {
    const newMap = new Map(map);
    newMap.set(keyFn(event), valueFn(event, entry));
    return newMap;
  };
}