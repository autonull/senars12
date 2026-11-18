/**
 * LogStore-based GateEventLedger — runtime durability for kernel gate decisions.
 *
 * Replaces file-based GateEventLedger with LogStore-backed persistence.
 * Uses the unified event log for all gate events.
 * Gate events are identified by engine='kernel' and specific event types.
 */

import type { LogStore } from './store.js';
import type { CognitiveEvent } from './events.js';
import type { GateRegistry, GateLogEntry } from '../../nar/src/kernel/GateRegistry.js';
import { GATE_LOG_KEYS, type GateLogKey } from '../../nar/src/kernel/event-ring.js';
import { createLogger } from '@senars/util';

export interface GateEventLedgerOptions {
  /** Where a replay reports what it resumed. */
  logger?: ReturnType<typeof createLogger>;
}

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
function gateFromCausationId(causationId: string | undefined): (typeof GATE_LOG_KEYS)[number] | null {
  if (!causationId) return null;
  const prefix = causationId.split(':')[0];
  if (GATE_LOG_KEYS.includes(prefix as (typeof GATE_LOG_KEYS)[number])) {
    return prefix as (typeof GATE_LOG_KEYS)[number];
  }
  return null;
}

/**
 * LogStore-backed gate event ledger.
 * Gate events are stored as CognitiveEvents with engine='kernel' in the unified log.
 */
export class LogStoreGateEventLedger {
  readonly #store: LogStore;
  readonly #logger: ReturnType<typeof createLogger>;
  readonly #cursor: number;

  constructor(store: LogStore, options: GateEventLedgerOptions = {}) {
    this.#store = store;
    this.#logger = options.logger ?? createLogger({ scope: 'NAR.LogStoreGateEventLedger' });
    this.#cursor = store.getLastSeq();
  }

  /** Get the current cursor position. */
  getCursor(): number {
    return this.#cursor;
  }

  /** Advance the cursor to the current log head. */
  advanceCursor(): void {
    // Cursor is implicitly the last seq; no separate state needed
  }

  /** Append every not-yet-written gate event; returns how many were written. */
  async flush(registry: GateRegistry): Promise<number> {
    const logs = registry.getAllEventLogs();
    let appended = 0;

    for (const gate of GATE_LOG_KEYS) {
      for (const event of logs[gate]) {
        // Only append kernel-engine events (gate events)
        if (event.engine !== 'kernel') continue;

        // Encode gate in causationId for replay routing
        const eventWithGate = {
          ...event,
          causationId: `${gate}:${event.causationId ?? ''}`,
        };

        await this.#store.append(eventWithGate, { ts: event.timestamp });
        appended++;
      }
    }

    return appended;
  }

  /** Read gate events from the log, oldest first. */
  async read(limit?: number): Promise<CognitiveEvent[]> {
    const startSeq = this.#cursor + 1;
    const endSeq = this.#store.getLastSeq();

    if (startSeq > endSeq) return [];

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
  async readWithGate(limit?: number): Promise<Array<{ gate: (typeof GATE_LOG_KEYS)[number]; event: CognitiveEvent }>> {
    const startSeq = this.#cursor + 1;
    const endSeq = this.#store.getLastSeq();

    if (startSeq > endSeq) return [];

    const entries = await this.#store.readRange(startSeq, endSeq);
    const results: Array<{ gate: (typeof GATE_LOG_KEYS)[number]; event: CognitiveEvent }> = [];

    for (const entry of entries) {
      const event = entry.event;
      if (event.engine !== 'kernel' || !GATE_EVENT_TYPES.has(event.type)) continue;

      const gate = gateFromCausationId(event.causationId);
      if (!gate) continue;

      results.push({ gate, event });
    }

    if (limit && results.length > limit) {
      return results.slice(-limit);
    }
    return results;
  }

  /** Mark events read back from disk as already-written. */
  adopt(entries: ReadonlyArray<{ event: CognitiveEvent }>): void {
    // No-op for LogStore version - cursor handles dedup
  }

  /**
   * Replay persisted gate events into the registry's rings.
   * Re-seeds them with what a prior run decided.
   */
  async replayInto(registry: GateRegistry): Promise<number> {
    const entries = await this.readWithGate();
    if (entries.length === 0) return 0;

    // Convert to GateLogEntry format for public restoreEventLogs method
    // Type assertion needed because GateLogEntry expects CognitiveEvent but doesn't constrain per gate
    const gateEntries = entries.map(({ gate, event }) => ({ gate, event })) as GateLogEntry[];
    const restored = registry.restoreEventLogs(gateEntries);

    if (restored > 0) {
      this.#logger.info('Replayed the persisted gate log', { events: restored });
    }
    return restored;
  }

  close(): void {
    // LogStore is managed externally; no close needed here
  }
}

/** Create a LogStoreGateEventLedger. */
export const createLogStoreGateEventLedger = (
  store: LogStore,
  options?: GateEventLedgerOptions
): LogStoreGateEventLedger => {
  return new LogStoreGateEventLedger(store, options);
};