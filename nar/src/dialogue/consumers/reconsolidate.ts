/**
 * TODO25 Phase B (N2): retrospective-triggered re-consolidation. Lessons from
 * persisted retrospectives are ingested as Narsese self-beliefs exactly once
 * per retrospective digest — a persisted ledger makes the one-shot survive
 * restarts. Source loading is fail-closed (digest-pinned, cf. TODO24 Phase C).
 *
 * REFACTOR.todo4 Phase B: now backed by the generic `Ledger<T>` primitive.
 */
import { Ledger, createLedger, BaseLedgerEntrySchema } from '@senars/io';
import { z } from 'zod';
import type { Retrospective } from '../types.js';
import { extractLessons } from '../retrospect.js';

export interface RetrospectiveSource {
  load(n: number): Promise<Retrospective[]>;
}

export interface ReconsolidationSink {
  /** Ingest one lesson as a Narsese self-belief (seeded truth, non-LLM path). */
  input(term: string, frequency: number, confidence: number): Promise<void>;
}

export interface LessonSeed {
  term: string;
  truth: { frequency: number; confidence: number };
}

const ReconsolidatedEntrySchema = BaseLedgerEntrySchema.extend({
  digest: z.string(),
});

type ReconsolidatedLedgerEntry = z.infer<typeof ReconsolidatedEntrySchema>;

export class Reconsolidator {
  readonly #ledger: Ledger<ReconsolidatedLedgerEntry>;
  /** N2: digests already consolidated (persisted, survives restarts). */
  #done = new Set<string>();

  constructor(
    private readonly source: RetrospectiveSource,
    private readonly sink: ReconsolidationSink,
    private readonly seed: LessonSeed,
    ledgerPath = './.cache/dialogue/reconsolidated.jsonl'
  ) {
    this.#ledger = createLedger<ReconsolidatedLedgerEntry>('', ReconsolidatedEntrySchema, {
      rollover: { fixedFile: ledgerPath },
    });
  }

  /** Load the digest ledger; missing/corrupt lines are skipped (best-effort). */
  async load(): Promise<void> {
    const entries = await this.#ledger.query({});
    for (const entry of entries) this.#done.add(entry.digest);
  }

  /**
   * Ingest lessons from the latest retrospectives, skipping already-
   * consolidated digests (N2). Returns { ingested, skipped }.
   */
  async reconsolidate(n = 50): Promise<{ ingested: number; skipped: number }> {
    await this.load();
    const retrospectives = await this.source.load(n);
    let ingested = 0;
    let skipped = 0;
    const fresh: ReconsolidatedLedgerEntry[] = [];
    for (const r of retrospectives) {
      if (this.#done.has(r.digest)) {
        skipped++;
        continue;
      }
      this.#done.add(r.digest);
      fresh.push({ at: Date.now(), digest: r.digest });
      for (const lesson of extractLessons(r, this.seed)) {
        await this.sink.input(lesson.term, lesson.truth.frequency, lesson.truth.confidence);
        ingested++;
      }
    }
    if (fresh.length > 0) {
      for (const entry of fresh) this.#ledger.append(entry);
    }
    return { ingested, skipped };
  }
}
