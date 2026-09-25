/**
 * Phase B (REFACTOR.todo1): append-only parameter change ledger + outcome
 * correlation. Ledgers observe (C2) — never decide: records are consulted by
 * governors (`.parameters` command, retrospectives, `improvedOnly` series);
 * no write path mutates truth values.
 *
 * Ledger-off default (C1): nothing is attached or persisted unless a host
 * wires `ParameterLedger` into the writers (NAR.setParameterLedger, bot).
 */

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
  /** Append-only JSONL sink; omitted ⇒ in-memory only. */
  path?: string;
}

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const DEFAULT_LEDGER_PATH = '.cache/parameters/ledger.jsonl';

export class ParameterLedger {
  readonly #records: ParameterRecord[] = [];
  readonly #path?: string;

  constructor(options: ParameterLedgerOptions = {}) {
    this.#path = options.path;
  }

  get size(): number {
    return this.#records.length;
  }

  record(entry: ParameterRecord): void {
    const r: ParameterRecord = { ...entry, at: entry.at ?? Date.now() };
    this.#records.push(r);
    if (!this.#path) return;
    try {
      mkdirSync(dirname(this.#path), { recursive: true });
      appendFileSync(this.#path, `${JSON.stringify(r)}\n`);
    } catch {
      /* persistence is best-effort; the in-memory record stands */
    }
  }

  query(filter: { parameter?: string; writer?: string } = {}): readonly ParameterRecord[] {
    return this.#records.filter(
      (r) =>
        (!filter.parameter || r.parameter === filter.parameter) &&
        (!filter.writer || r.writer === filter.writer)
    );
  }

  /** Latest record per parameter (writer-agnostic). */
  latest(): ReadonlyMap<string, ParameterRecord> {
    const out = new Map<string, ParameterRecord>();
    for (const r of this.#records) out.set(r.parameter, r);
    return out;
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

  correlate(options: { parameter?: string; windowMs?: number } = {}): ParameterImprovement[] {
    const windowMs = options.windowMs ?? 60_000;
    const samples = this.outcomes();
    const mean = (from: number, to: number): number | null => {
      const inWindow = samples.filter((s) => s.at >= from && s.at < to).map((s) => s.quality);
      if (inWindow.length === 0) return null;
      return inWindow.reduce((a, b) => a + b, 0) / inWindow.length;
    };
    const out: ParameterImprovement[] = [];
    for (const r of this.ledger.query({ parameter: options.parameter })) {
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
  improvedOnly(options: { parameter?: string; windowMs?: number } = {}): ParameterImprovement[] {
    return this.correlate(options).filter((i) => i.improved);
  }
}
