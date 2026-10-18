/**
 * Runtime durability for the kernel gates' decision logs (CORE.19 C3.3).
 *
 * The gate rings are bounded in memory; this writes what they hold to disk with
 * rotation and retention, so a restart (and C4's replay) has an input instead of
 * a log that only ever existed inside a test. It replaces the bare `appendJsonl`
 * of `persistGateLogs`: the same rows, but bounded on disk and flushed while the
 * kernel runs, not only in a fixture.
 */
import type { CognitiveEvent } from '@senars/core/schemas';
import { CognitiveEventSchema } from '@senars/core/schemas';
import { createLogger } from '@senars/util';
import { BaseLedgerEntrySchema, createLedger, type Ledger } from '@senars/util/ledger';
import { z } from 'zod';
import { GATE_LOG_KEYS } from './event-ring.js';
import type { GateRegistry } from './GateRegistry.js';

/** One gate decision as it lands on disk: the ring it came from, the stamp, the event. */
export const GateEventEntrySchema = BaseLedgerEntrySchema.extend({
  /** The gate ring the event came from, so a restore routes it back (CORE.19 C4.3). */
  gate: z.enum(GATE_LOG_KEYS),
  event: CognitiveEventSchema,
});

export type GateEventEntry = z.infer<typeof GateEventEntrySchema>;

export interface GateEventLedgerOptions {
  /** Files older than this many days are pruned on daily rollover. Default 30. */
  retentionDays?: number;
  /** Entries per file before rolling to `<date>-<n>.jsonl`. Default 10 000. */
  maxEntriesPerFile?: number;
  /** Where a replay reports what it resumed. */
  logger?: ReturnType<typeof createLogger>;
}

/**
 * A ledger over the gate registry's rings. `flush` appends only events it has
 * not seen before, tracked by identity in a `WeakSet`: the rings hand back the
 * same objects, so a periodic flush neither re-appends a growing window nor
 * needs an id the events do not carry. The set is weak, so an event the ring has
 * evicted is collectable — the cursor is a window, not a second log.
 */
export class GateEventLedger {
  readonly #ledger: Ledger<GateEventEntry>;
  readonly #seen = new WeakSet<CognitiveEvent>();
  readonly #logger: ReturnType<typeof createLogger>;

  constructor(basePath: string, options: GateEventLedgerOptions = {}) {
    this.#logger = options.logger ?? createLogger({ scope: 'NAR.GateEventLedger' });
    this.#ledger = createLedger(basePath, GateEventEntrySchema, {
      rollover: {
        retentionDays: options.retentionDays ?? 30,
        maxEntriesPerFile: options.maxEntriesPerFile ?? 10_000,
      },
    });
  }

  /** Append every not-yet-written gate event; returns how many were written. */
  flush(registry: GateRegistry): number {
    const logs = registry.getAllEventLogs();
    let appended = 0;
    for (const gate of GATE_LOG_KEYS) {
      for (const event of logs[gate]) {
        if (this.#seen.has(event)) continue;
        this.#seen.add(event);
        this.#ledger.append({ gate, correlationId: event.correlationId, event });
        appended++;
      }
    }
    return appended;
  }

  /** The durable entries, each with the gate it came from — the C4.3 replay input. */
  async readEntries(limit?: number): Promise<GateEventEntry[]> {
    return this.#ledger.query(limit ? { limit } : {});
  }

  /** The events written so far, oldest first (optionally the most recent `limit`). */
  async read(limit?: number): Promise<CognitiveEvent[]> {
    return (await this.readEntries(limit)).map((entry) => entry.event);
  }

  /**
   * Mark events read back from disk as already-written, so a restore that
   * re-seeds the rings (CORE.19 C4.3) does not have the next flush append them a
   * second time.
   */
  adopt(entries: ReadonlyArray<GateEventEntry>): void {
    for (const entry of entries) this.#seen.add(entry.event);
  }

  /**
   * Replay the persisted log into the registry's rings (CORE.19 C4.3): re-seed
   * them with what a prior run decided, then adopt it so the next flush appends
   * only what the restart produced. The ledger owns its own replay rather than
   * the NAR facade, which stays a directory of subsystems.
   */
  async replayInto(registry: GateRegistry): Promise<number> {
    const entries = await this.readEntries();
    const restored = registry.restoreEventLogs(entries);
    this.adopt(entries);
    if (restored > 0) this.#logger.info('Replayed the persisted gate log', { events: restored });
    return restored;
  }

  getBasePath(): string {
    return this.#ledger.getBasePath();
  }

  close(): void {
    this.#ledger.close();
  }
}
