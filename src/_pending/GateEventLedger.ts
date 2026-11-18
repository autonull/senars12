/**
 * LogStore-based Gate Event Ledger — replaces file-based GateEventLedger.
 *
 * This ledger persists gate decision events (action, budget, perception, reward)
 * to the unified LogStore instead of separate JSONL files.
 */

import type { LogStore } from '../../../../src/log/store.js';
import type { CognitiveEvent } from '../../../../src/log/events.js';
import type { GateRegistry } from '../../../../nar/src/kernel/GateRegistry.js';
import { GATE_LOG_KEYS } from '../../../../nar/src/kernel/event-ring.js';
import { createLogger } from '@senars/util';

export interface GateEventLedgerOptions {
  /** Where a replay reports what it resumed. */
  logger?: ReturnType<typeof createLogger>;
}

interface StoredGateEvent {
  gate: string;
  event: CognitiveEvent;
  seq: number;
}

export class LogStoreGateEventLedger {
  readonly #store: LogStore;
  readonly #seen = new WeakSet<CognitiveEvent>();
  readonly #logger: ReturnType<typeof createLogger>;

  constructor(store: LogStore, options: GateEventLedgerOptions = {}) {
    this.#store = store;
    this.#logger = options.logger ?? createLogger({ scope: 'NAR.LogStoreGateEventLedger' });
  }

  /** Append every not-yet-written gate event; returns how many were written. */
  flush(registry: GateRegistry): number {
    const logs = registry.getAllEventLogs();
    let appended = 0;

    for (const gate of GATE_LOG_KEYS) {
      for (const event of logs[gate]) {
        if (this.#seen.has(event)) continue;
        this.#seen.add(event);

        // Append to LogStore - event must be compatible with CognitiveEvent
        this.#store.append(event as unknown as CognitiveEvent, { ts: event.timestamp });
        appended++;
      }
    }

    return appended;
  }

  /** The durable gate events, each with the gate it came from. */
  async readEntries(limit?: number): Promise<StoredGateEvent[]> {
    const results: StoredGateEvent[] = [];
    const gateTypes = new Set(GATE_LOG_KEYS);

    // Read from newest to oldest for limit efficiency
    for (let seq = this.#store.getLastSeq(); seq >= this.#store.getFirstSeq() && (!limit || results.length < limit); seq--) {
      const entry = await this.#store.read(seq);
      if (!entry) continue;

      if (gateTypes.has(entry.event.type)) {
        results.push({
          gate: this.#gateFromEventType(entry.event.type),
          event: entry.event,
          seq,
        });
      }
    }

    return results.reverse(); // Return in chronological order
  }

  /** The events written so far, oldest first (optionally the most recent `limit`). */
  async read(limit?: number): Promise<CognitiveEvent[]> {
    return (await this.readEntries(limit)).map((entry) => entry.event);
  }

  /**
   * Mark events read back from disk as already-written, so a restore that
   * re-seeds the rings does not have the next flush append them a second time.
   */
  adopt(entries: ReadonlyArray<StoredGateEvent>): void {
    for (const entry of entries) this.#seen.add(entry.event);
  }

  /**
   * Replay the persisted log into the registry's rings: re-seed
   * them with what a prior run decided, then adopt it so the next flush appends
   * only what the restart produced.
   */
  async replayInto(registry: GateRegistry): Promise<number> {
    const entries = await this.readEntries();
    const restored = registry.restoreEventLogs(
      entries.reduce((acc, entry) => {
        if (!acc[entry.gate]) acc[entry.gate] = [];
        acc[entry.gate].push(entry.event);
        return acc;
      }, {} as Record<string, CognitiveEvent[]>)
    );
    this.adopt(entries);
    if (restored > 0) this.#logger.info('Replayed the persisted gate log', { events: restored });
    return restored;
  }

  getBasePath(): string {
    return 'logstore';
  }

  close(): void {
    // LogStore handles its own closing
  }

  #gateFromEventType(eventType: string): string {
    // Map event types back to gate keys
    if (eventType.startsWith('action')) return 'action';
    if (eventType.startsWith('budget')) return 'budget';
    if (eventType.startsWith('perception')) return 'perception';
    if (eventType.startsWith('reward')) return 'reward';
    if (eventType.startsWith('egress')) return 'egress';
    if (eventType.startsWith('autonomy')) return 'autonomy';
    return 'unknown';
  }
}

/**
 * Create a LogStoreGateEventLedger.
 */
export function createLogStoreGateEventLedger(
  store: LogStore,
  options?: GateEventLedgerOptions
): LogStoreGateEventLedger {
  return new LogStoreGateEventLedger(store, options);
}