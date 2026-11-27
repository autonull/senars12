/**
 * Log Replay — deterministic reconstruction of state from the event log.
 *
 * Replay is the primary mechanism for state recovery, verification,
 * and time-travel debugging. It processes events in order through
 * a reducer function to reconstruct any derived state.
 */
/**
 * Replay events from a log store through a reducer.
 *
 * This is the core replay function. It reads events in sequence order
 * and applies the reducer to accumulate state.
 */
export async function replay(store, options) {
    const { initialState, reducer, filter, fromSeq = store.getFirstSeq(), toSeq = store.getLastSeq(), limit, onProgress, } = options;
    let state = initialState;
    let eventsProcessed = 0;
    const startTime = Date.now();
    const totalExpected = Math.min(limit ?? Number.MAX_SAFE_INTEGER, toSeq - fromSeq + 1);
    for (let seq = fromSeq; seq <= toSeq; seq++) {
        if (limit && eventsProcessed >= limit)
            break;
        const entry = await store.read(seq);
        if (!entry)
            continue;
        if (filter && !filter(entry.event))
            continue;
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
 * Replay with periodic checkpointing for long-running replays.
 */
export async function replayWithCheckpoints(store, options) {
    const { initialState, reducer, filter, fromSeq = store.getFirstSeq(), toSeq = store.getLastSeq(), limit, onProgress, checkpointInterval, saveCheckpoint, loadCheckpoint, } = options;
    // Try to resume from checkpoint
    const checkpoint = await loadCheckpoint();
    let state = checkpoint?.state ?? initialState;
    let startSeq = (checkpoint?.seq ?? fromSeq - 1) + 1;
    let eventsProcessed = 0;
    let lastCheckpointSeq = checkpoint?.seq ?? fromSeq - 1;
    const startTime = Date.now();
    const totalExpected = Math.min(limit ?? Number.MAX_SAFE_INTEGER, toSeq - startSeq + 1);
    for (let seq = startSeq; seq <= toSeq; seq++) {
        if (limit && eventsProcessed >= limit)
            break;
        const entry = await store.read(seq);
        if (!entry)
            continue;
        if (filter && !filter(entry.event))
            continue;
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
 * Replay events in parallel partitions for independent sub-streams.
 * Use when events can be partitioned by a key (e.g., by term, by agent).
 */
export async function replayParallel(store, options) {
    const { initialState, reducer, filter, fromSeq = store.getFirstSeq(), toSeq = store.getLastSeq(), limit, onProgress, partitionKey, merge, concurrency = navigator?.hardwareConcurrency ?? 4, } = options;
    // First pass: collect entries and partition them
    const partitions = new Map();
    let totalEntries = 0;
    for (let seq = fromSeq; seq <= toSeq; seq++) {
        if (limit && totalEntries >= limit)
            break;
        const entry = await store.read(seq);
        if (!entry)
            continue;
        if (filter && !filter(entry.event))
            continue;
        const key = partitionKey(entry.event);
        if (!partitions.has(key))
            partitions.set(key, []);
        partitions.get(key).push(entry);
        totalEntries++;
    }
    // Replay each partition
    const partitionStates = new Map();
    const partitionCounts = new Map();
    let totalProcessed = 0;
    const startTime = Date.now();
    const partitionEntries = Array.from(partitions.entries());
    const batchSize = Math.ceil(partitionEntries.length / concurrency);
    for (let i = 0; i < partitionEntries.length; i += batchSize) {
        const batch = partitionEntries.slice(i, i + batchSize);
        await Promise.all(batch.map(async ([key, entries]) => {
            let state = initialState;
            let count = 0;
            for (const entry of entries) {
                state = reducer(state, entry.event, entry);
                count++;
            }
            partitionStates.set(key, state);
            partitionCounts.set(String(key), count);
            totalProcessed += count;
        }));
        if (onProgress) {
            onProgress(totalProcessed, totalEntries, { type: 'Progress' });
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
export async function verifyReplay(store, reducer, expectedState, options = {}) {
    const result = await replay(store, { initialState: expectedState, reducer, ...options });
    const match = JSON.stringify(result.state) === JSON.stringify(expectedState);
    return { match, diff: match ? undefined : result.state, result };
}
/**
 * Create a reducer that collects all events of a specific type.
 */
export function createCollectorReducer(type) {
    return (events, event) => {
        if (event.type === type) {
            return [...events, event];
        }
        return events;
    };
}
/**
 * Create a reducer that builds a map keyed by a field.
 */
export function createMapReducer(keyFn, valueFn) {
    return (map, event, entry) => {
        const newMap = new Map(map);
        newMap.set(keyFn(event), valueFn(event, entry));
        return newMap;
    };
}
