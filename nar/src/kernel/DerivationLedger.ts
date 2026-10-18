/**
 * Runtime durability for the derivation fire ring (CORE.19 C4.3).
 *
 * The gate log has a durable twin (`GateEventLedger`); this is the derivation
 * half of the same seam. The fire ring in `DerivationRecorder` is bounded in
 * memory and, before this, never written — so a restart resumed gate
 * observations but not the fire records `getRuleFiresByConclusion` and
 * `explainDerivation` read. This writes them beside the gate ring, in their
 * `derivation.accepted` form (no wall-clock, D13), and re-seeds the ring on a
 * restore.
 */
import { type DerivationStep, DerivationStepSchema } from '@senars/core/schemas';
import { createLogger } from '@senars/util';
import { BaseLedgerEntrySchema, createLedger, type Ledger } from '@senars/util/ledger';
import { z } from 'zod';
import type { DerivationRecorder } from '../rules/impls/recorder.js';

/** One rule fire as it lands on disk: its durable `derivation.accepted` form. */
export const DerivationEventEntrySchema = BaseLedgerEntrySchema.extend({
  fire: DerivationStepSchema,
});

export type DerivationEventEntry = z.infer<typeof DerivationEventEntrySchema>;

export interface DerivationLedgerOptions {
  /** Files older than this many days are pruned on daily rollover. Default 30. */
  retentionDays?: number;
  /** Entries per file before rolling to `<date>-<n>.jsonl`. Default 10 000. */
  maxEntriesPerFile?: number;
  /** Where a replay reports what it resumed. */
  logger?: ReturnType<typeof createLogger>;
}

/** The fire without its wall-clock — the durable form, and the one a seeded trace can carry (D13). */
const durableFire = (fire: DerivationStep): DerivationStep => {
  const { timestamp, ...rest } = fire;
  return timestamp === undefined ? fire : rest;
};

/**
 * A ledger over the recorder's fire ring. `flush` appends only fires it has not
 * seen, tracked by identity in a `WeakSet`: the ring hands back the same objects,
 * so a periodic flush neither re-appends a growing window nor needs an id the
 * records do not already carry. The set is weak, so a fire the ring has evicted
 * is collectable — the cursor is a window, not a second log.
 */
export class DerivationLedger {
  readonly #ledger: Ledger<DerivationEventEntry>;
  readonly #seen = new WeakSet<DerivationStep>();
  readonly #logger: ReturnType<typeof createLogger>;

  constructor(basePath: string, options: DerivationLedgerOptions = {}) {
    this.#logger = options.logger ?? createLogger({ scope: 'NAR.DerivationLedger' });
    this.#ledger = createLedger(basePath, DerivationEventEntrySchema, {
      rollover: {
        retentionDays: options.retentionDays ?? 30,
        maxEntriesPerFile: options.maxEntriesPerFile ?? 10_000,
      },
    });
  }

  /** Append every not-yet-written rule fire; returns how many were written. */
  flush(recorder: DerivationRecorder): number {
    let appended = 0;
    for (const fire of recorder.fires()) {
      if (this.#seen.has(fire)) continue;
      this.#seen.add(fire);
      this.#ledger.append({ correlationId: fire.correlationId, fire: durableFire(fire) });
      appended++;
    }
    return appended;
  }

  /** The durable entries, oldest first — the C4.3 replay input. */
  async readEntries(limit?: number): Promise<DerivationEventEntry[]> {
    return this.#ledger.query(limit ? { limit } : {});
  }

  /** The fires written so far, oldest first (optionally the most recent `limit`). */
  async read(limit?: number): Promise<DerivationStep[]> {
    return (await this.readEntries(limit)).map((entry) => entry.fire);
  }

  /**
   * Mark fires read back from disk as already-written, so a restore that
   * re-seeds the ring (CORE.19 C4.3) does not have the next flush append them a
   * second time.
   */
  adopt(entries: ReadonlyArray<DerivationEventEntry>): void {
    for (const entry of entries) this.#seen.add(entry.fire);
  }

  /**
   * Replay the persisted log into the recorder's fire ring (CORE.19 C4.3):
   * re-seed it with what a prior run derived, then adopt it so the next flush
   * appends only what the restart produced. The ledger owns its own replay rather
   * than the NAR facade, which stays a directory of subsystems.
   */
  async replayInto(recorder: DerivationRecorder): Promise<number> {
    const entries = await this.readEntries();
    const restored = recorder.restoreFires(entries.map((entry) => entry.fire));
    this.adopt(entries);
    if (restored > 0) this.#logger.info('Replayed the persisted derivation log', { fires: restored });
    return restored;
  }

  getBasePath(): string {
    return this.#ledger.getBasePath();
  }

  close(): void {
    this.#ledger.close();
  }
}
