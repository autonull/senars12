/**
 * LogStore-based GateEventLedger — runtime durability for kernel gate decisions.
 *
 * Replaces file-based GateEventLedger with LogStore-backed persistence.
 * Uses the unified event log for all gate events.
 * Gate events are identified by engine='kernel' and specific event types.
 */
import { createLogger } from '@senars/util/logger';
/** Gate log keys — must match nar/src/kernel/event-ring.ts */
const GATE_LOG_KEYS = ['perception', 'action', 'autonomy', 'reward', 'budget'];
/** Gate event types that kernel gates produce (engine='kernel'). */
const GATE_EVENT_TYPES = new Set([
    'task.admitted',
    'concept.activated',
    'belief.revised',
    'derivation.accepted',
    'shadow.validation.dropped',
    'policy.violation',
    'autonomy.mode.changed',
    'budget.consumed',
    'budget.exhausted',
]);
/** Decode gate from causationId (encoded during flush). */
function gateFromCausationId(causationId) {
    if (!causationId)
        return null;
    const prefix = causationId.split(':')[0];
    if (GATE_LOG_KEYS.includes(prefix)) {
        return prefix;
    }
    return null;
}
/**
 * LogStore-backed gate event ledger.
 * Gate events are stored as CognitiveEvents with engine='kernel' in the unified log.
 */
export class LogStoreGateEventLedger {
    #store;
    #logger;
    /** Events flushed in the current run (prevents re-flushing within the run). */
    #flushedKeys = new Set();
    /** Events replayed from the log (prevents re-replaying and re-flushing after restart). */
    #replayedKeys = new Set();
    constructor(store, options = {}) {
        this.#store = store;
        this.#logger = options.logger ?? createLogger({ scope: 'NAR.LogStoreGateEventLedger' });
    }
    /** Append every not-yet-written gate event; returns how many were written. */
    async flush(registry) {
        const logs = registry.getAllEventLogs();
        let appended = 0;
        for (const gate of GATE_LOG_KEYS) {
            for (const event of logs[gate]) {
                // Only append kernel-engine events (gate events)
                if (event.engine !== 'kernel')
                    continue;
                // Stable deduplication key: hash of event content (legacy events lack id)
                const eventKey = this.#eventKey(event);
                // Skip if already replayed from a previous run
                if (this.#replayedKeys.has(eventKey))
                    continue;
                // Skip if already flushed in this run
                if (this.#flushedKeys.has(eventKey))
                    continue;
                this.#flushedKeys.add(eventKey);
                // Encode gate in causationId for replay routing
                const eventWithGate = {
                    ...event,
                    id: event.id ?? crypto.randomUUID(),
                    causationId: `${gate}:${event.causationId ?? ''}`,
                };
                await this.#store.append(eventWithGate, { ts: event.timestamp });
                appended++;
            }
        }
        return appended;
    }
    /** Create a stable key for deduplication from event content. */
    #eventKey(event) {
        // Use correlationId + type + timestamp + JSON payload for stability
        const payloadStr = JSON.stringify(event.payload);
        return `${event.correlationId}:${event.type}:${event.timestamp}:${payloadStr}`;
    }
    /** Get the current cursor position (for compatibility). */
    getCursor() {
        return this.#store.getLastSeq();
    }
    /** Advance the cursor to the current log head (no-op, kept for compatibility). */
    advanceCursor() {
        // No-op: WeakSet handles deduplication
    }
    /** Read gate events from the log, oldest first. */
    async read(limit) {
        const startSeq = 1;
        const endSeq = this.#store.getLastSeq();
        if (startSeq > endSeq)
            return [];
        const entries = await this.#store.readRange(startSeq, endSeq);
        const events = entries
            .map((e) => e.event)
            .filter((e) => e.engine === 'kernel' && GATE_EVENT_TYPES.has(e.type));
        if (limit && events.length > limit) {
            return events.slice(-limit);
        }
        return events;
    }
    /** Read gate events with their originating gate ring. */
    async readWithGate(limit) {
        const startSeq = 1;
        const endSeq = this.#store.getLastSeq();
        if (startSeq > endSeq)
            return [];
        const entries = await this.#store.readRange(startSeq, endSeq);
        const results = [];
        for (const entry of entries) {
            const event = entry.event;
            if (event.engine !== 'kernel' || !GATE_EVENT_TYPES.has(event.type))
                continue;
            const gate = gateFromCausationId(event.causationId);
            if (!gate)
                continue;
            results.push({ gate, event });
        }
        if (limit && results.length > limit) {
            return results.slice(-limit);
        }
        return results;
    }
    /** Mark events read back from disk as already-replayed. */
    adopt(entries) {
        for (const entry of entries) {
            const key = this.#eventKey(entry.event);
            this.#replayedKeys.add(key);
        }
    }
    /**
     * Replay persisted gate events into the registry's rings.
     * Re-seeds them with what a prior run decided.
     */
    async replayInto(registry) {
        const entries = await this.readWithGate();
        if (entries.length === 0)
            return 0;
        // Filter out already-replayed events
        const unseenEntries = entries.filter((e) => !this.#replayedKeys.has(this.#eventKey(e.event)));
        if (unseenEntries.length === 0)
            return 0;
        // Convert to GateLogEntry format for public restoreEventLogs method
        const gateEntries = unseenEntries.map(({ gate, event }) => ({ gate, event }));
        const restored = registry.restoreEventLogs(gateEntries);
        // Mark restored events as replayed so they are not re-replayed or re-flushed
        this.adopt(unseenEntries);
        if (restored > 0) {
            this.#logger.info('Replayed the persisted gate log', { events: restored });
        }
        return restored;
    }
    close() {
        // LogStore is managed externally; no close needed here
    }
}
/** Create a LogStoreGateEventLedger. */
export const createLogStoreGateEventLedger = (store, options) => {
    return new LogStoreGateEventLedger(store, options);
};
