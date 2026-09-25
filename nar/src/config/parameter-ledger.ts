/**
 * Phase B (REFACTOR.todo1): append-only parameter change ledger + outcome
 * correlation. Ledgers observe (C2) — never decide: records are consulted by
 * governors (`.parameters` command, retrospectives, `improvedOnly` series);
 * no write path mutates truth values.
 *
 * Ledger-off default (C1): nothing is attached or persisted unless a host
 * wires `ParameterLedger` into the writers (NAR.setParameterLedger, bot).
 *
 * REFACTOR.todo4 Phase B: now backed by the generic `Ledger<T>` primitive from `@senars/io`.
 */

import { z } from 'zod';
import { Ledger, createLedger, BaseLedgerEntrySchema, type LedgerQuery } from '@senars/io';

export interface ParameterRecord {
  /** Subsystem that performed the write (e.g. 'self-meta-game', 'rlfp'). */
  writer: string;
  /** Parameter-table scope or logical surface ('strategy', 'rlfp'). */
  scope: string;
  parameter: string;
  oldValue: number | string;
  newValue: number | string;
  at: number;
  /** What motivated the change (e.g. tuning update, retrospective digest). */
  trigger?: string;
}

export interface ParameterLedgerOptions {
  /** Append-only JSONL sink directory; omitted ⇒ in-memory only. */
  path?: string;
}

const ParameterRecordSchema = BaseLedgerEntrySchema.extend({
  writer: z.string(),
  scope: z.string(),
  parameter: z.string(),
  oldValue: z.union([z.number(), z.string()]),
  newValue: z.union([z.number(), z.string()]),
  trigger: z.string().optional(),
});

export type ParameterLedgerEntry = z.infer<typeof ParameterRecordSchema>;

export const DEFAULT_LEDGER_PATH = '.cache/parameters';

/**
 * ParameterLedger — now backed by the generic `Ledger<T>` primitive from `@senars/io`.
 * Maintains the exact same public API for existing consumers.
 * Sync query methods read from an in-memory cache (hot + explicitly loaded entries).
 */
export class ParameterLedger {
  readonly #ledger: Ledger<ParameterLedgerEntry>;
  readonly #syncCache: ParameterLedgerEntry[] = [];

  constructor(options: ParameterLedgerOptions = {}) {
    const basePath = options.path ? require('node:path').dirname(options.path) : DEFAULT_LEDGER_PATH;
    this.#ledger = createLedger<ParameterLedgerEntry>(basePath, ParameterRecordSchema, {
      rollover: {
        daily: true,
        maxEntriesPerFile: 10_000,
        retentionDays: 30,
      },
    });
  }

  get size(): number {
    return this.#syncCache.length;
  }

  record(entry: ParameterRecord): void {
    const fullEntry = { ...entry, at: entry.at ?? Date.now() } as ParameterLedgerEntry;
    this.#ledger.append(fullEntry);
    this.#syncCache.push(fullEntry);
  }

  query(filter: { parameter?: string; writer?: string } = {}): readonly ParameterRecord[] {
    return this.#syncCache.filter(
      (r) =>
        (!filter.parameter || r.parameter === filter.parameter) &&
        (!filter.writer || r.writer === filter.writer)
    );
  }

  /** Latest record per parameter (writer-agnostic). */
  latest(): ReadonlyMap<string, ParameterRecord> {
    const out = new Map<string, ParameterRecord>();
    for (const r of this.#syncCache) out.set(r.parameter, r);
    return out;
  }

  /** Load all persisted entries into the sync cache (for full-query parity). */
  async loadAll(): Promise<void> {
    const entries = await this.#ledger.query({});
    this.#syncCache.length = 0;
    this.#syncCache.push(...entries);
  }

  /** Async query with full disk scan (for new consumers). */
  async queryAsync(filter: LedgerQuery = {}): Promise<readonly ParameterLedgerEntry[]> {
    return this.#ledger.query(filter);
  }

  /** Get the underlying ledger for advanced operations (compact, rotate, etc.). */
  get ledger(): Ledger<ParameterLedgerEntry> {
    return this.#ledger;
  }
}

export interface OutcomeSample {
  at: number;
  quality: number;
}

export interface ParameterImprovement {
  parameter: string;
  oldValue: number | string;
  newValue: number | string;
  at: number;
  /** Mean outcome quality in `windowMs` before vs after the change. */
  before: number;
  after: number;
  improved: boolean;
}

/**
 * Joins ledger changes against an outcome series (trace grades, Brier scores,
 * retrospective correction rates) — per-parameter improvement evidence.
 */
export class OutcomeLinker {
  constructor(
    private readonly ledger: ParameterLedger,
    private readonly outcomes: () => readonly OutcomeSample[]
  ) {}

  async correlate(options: { parameter?: string; windowMs?: number } = {}): Promise<ParameterImprovement[]> {
    const windowMs = options.windowMs ?? 60_000;
    const samples = this.outcomes();
    const mean = (from: number, to: number): number | null => {
      const inWindow = samples.filter((s) => s.at >= from && s.at < to).map((s) => s.quality);
      if (inWindow.length === 0) return null;
      return inWindow.reduce((a, b) => a + b, 0) / inWindow.length;
    };
    const entries = await this.ledger.queryAsync({});
    const filtered = options.parameter
      ? entries.filter((r) => r.parameter === options.parameter)
      : entries;
    const out: ParameterImprovement[] = [];
    for (const r of filtered) {
      const before = mean(r.at - windowMs, r.at);
      const after = mean(r.at, r.at + windowMs);
      if (before === null || after === null) continue;
      out.push({
        parameter: r.parameter,
        oldValue: r.oldValue,
        newValue: r.newValue,
        at: r.at,
        before,
        after,
        improved: after > before,
      });
    }
    return out;
  }

  /** Evidence-gated view (N1): only changes followed by quality improvement. */
  async improvedOnly(options: { parameter?: string; windowMs?: number } = {}): Promise<ParameterImprovement[]> {
    return (await this.correlate(options)).filter((i) => i.improved);
  }
}