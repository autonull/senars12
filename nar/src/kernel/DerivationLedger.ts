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
import { join } from 'node:path';
import { type DerivationRecord, type DerivationStep, DerivationRecordSchema, DerivationStepSchema } from '@senars/core/schemas';
import { createLogger } from '@senars/util';
import { BaseLedgerEntrySchema, createLedger, type Ledger } from '@senars/util/ledger';
import { z } from 'zod';
import type { DerivationRecorder } from '../rules/impls/recorder.js';

/** One rule fire as it lands on disk: its durable `derivation.accepted` form. */
export const DerivationEventEntrySchema = BaseLedgerEntrySchema.extend({
  fire: DerivationStepSchema,
});

/** One completed derivation chain as it lands on disk (CORE.19 C3.4). */
export const DerivationRecordEntrySchema = BaseLedgerEntrySchema.extend({
  record: DerivationRecordSchema,
});

export type DerivationEventEntry = z.infer<typeof DerivationEventEntrySchema>;
export type DerivationRecordEntry = z.infer<typeof DerivationRecordEntrySchema>;

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
 * A ledger over the recorder's derivation output: the bounded fire ring (pulled,
 * `flush`) and the completed-chain ring (pushed, `observe`). The fire cursor is
 * tracked by identity in a `WeakSet`: the ring hands back the same objects, so a
 * periodic flush neither re-appends a growing window nor needs an id the fires do
 * not already carry; the set is weak, so a fire the ring has evicted is
 * collectable — the cursor is a window, not a second log. A completed chain is
 * pushed the moment it closes, because the ring is drain-emptied by consumers and
 * a pull could miss it (CORE.19 C3.4).
 */
export class DerivationLedger {
  readonly #ledger: Ledger<DerivationEventEntry>;
  readonly #records: Ledger<DerivationRecordEntry>;
  readonly #seen = new WeakSet<DerivationStep>();
  readonly #logger: ReturnType<typeof createLogger>;
  #unsubscribeRecords: (() => void) | null = null;

  constructor(basePath: string, options: DerivationLedgerOptions = {}) {
    this.#logger = options.logger ?? createLogger({ scope: 'NAR.DerivationLedger' });
    const rollover = {
      retentionDays: options.retentionDays ?? 30,
      maxEntriesPerFile: options.maxEntriesPerFile ?? 10_000,
    };
    this.#ledger = createLedger(basePath, DerivationEventEntrySchema, { rollover });
    this.#records = createLedger(join(basePath, 'chains'), DerivationRecordEntrySchema, {
      rollover,
    });
  }

  /**
   * Persist each completed chain as it closes (CORE.19 C3.4). Push, not pull:
   * the completed ring is drain-emptied by consumers, so a periodic flush could
   * miss a record a drain took first. The sink is bound to the recorder's own
   * `onRecord`, so every chain lands whether or not anything drained it.
   */
  observe(recorder: DerivationRecorder): void {
    this.#unsubscribeRecords ??= recorder.onRecord.on((record) => {
      this.#records.append({ correlationId: record.derivationId, record });
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

  /** The completed chains written so far, oldest first (optionally the most recent `limit`). */
  async readRecords(limit?: number): Promise<DerivationRecord[]> {
    const entries = await this.#records.query(limit ? { limit } : {});
    return entries.map((entry) => entry.record);
  }

  /**
   * Re-seed the completed ring from the persisted chains (CORE.19 C3.4), so a
   * restart resumes the records a consumer's `records()`/`drain()` reads.
   */
  async replayRecordsInto(recorder: DerivationRecorder): Promise<number> {
    const restored = recorder.restoreRecords(await this.readRecords());
    if (restored > 0)
      this.#logger.info('Replayed the persisted derivation chains', { chains: restored });
    return restored;
  }

  getBasePath(): string {
    return this.#ledger.getBasePath();
  }

  close(): void {
    this.#unsubscribeRecords?.();
    this.#unsubscribeRecords = null;
    this.#ledger.close();
    this.#records.close();
  }
}
