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
import { BaseLedgerEntrySchema, createLedger, type Ledger } from '@senars/util/ledger';
import { z } from 'zod';
import type { GateRegistry } from './GateRegistry.js';

/** One gate decision as it lands on disk: the ledger's stamp beside the event. */
export const GateEventEntrySchema = BaseLedgerEntrySchema.extend({
  event: CognitiveEventSchema,
});

export type GateEventEntry = z.infer<typeof GateEventEntrySchema>;

export interface GateEventLedgerOptions {
  /** Files older than this many days are pruned on daily rollover. Default 30. */
  retentionDays?: number;
  /** Entries per file before rolling to `<date>-<n>.jsonl`. Default 10 000. */
  maxEntriesPerFile?: number;
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

  constructor(basePath: string, options: GateEventLedgerOptions = {}) {
    this.#ledger = createLedger(basePath, GateEventEntrySchema, {
      rollover: {
        retentionDays: options.retentionDays ?? 30,
        maxEntriesPerFile: options.maxEntriesPerFile ?? 10_000,
      },
    });
  }

  /** Append every not-yet-written gate event; returns how many were written. */
  flush(registry: GateRegistry): number {
    let appended = 0;
    for (const events of Object.values(registry.getAllEventLogs())) {
      for (const event of events) {
        if (this.#seen.has(event)) continue;
        this.#seen.add(event);
        this.#ledger.append({ event, correlationId: event.correlationId });
        appended++;
      }
    }
    return appended;
  }

  /** The events written so far, oldest first (optionally the most recent `limit`). */
  async read(limit?: number): Promise<CognitiveEvent[]> {
    const entries = await this.#ledger.query(limit ? { limit } : {});
    return entries.map((entry) => entry.event);
  }

  getBasePath(): string {
    return this.#ledger.getBasePath();
  }

  close(): void {
    this.#ledger.close();
  }
}
