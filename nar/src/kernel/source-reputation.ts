/**
 * Phase E (REFACTOR.todo1): per-source-key track record → trust ceiling
 * multiplier. Trust-not-truth (RewardGate-compatible, C2): adjusts the
 * source-quality ceiling only — never a Truth value. Accumulates from
 * verification signals only (egress-gate rejections, `.react` corrections,
 * peer shadow-validation failures).
 *
 * REFACTOR.todo4 Phase B: now backed by the generic `Ledger<T>` primitive from `@senars/io`.
 */

import { z } from 'zod';
import { Ledger, createLedger, BaseLedgerEntrySchema } from '@senars/io';
import { clamp01 } from '../utils';

export interface ReputationEntry {
  confirmed: number;
  contradicted: number;
}

export interface SourceReputationOptions {
  /** Multiplier floor (default 0.5). */
  floor?: number;
  /** JSONL persistence sink directory (append-only, ledger-style). */
  path?: string;
  /** Contradictions needed before the multiplier starts dropping (default 2). */
  contradictionsBeforeDecay?: number;
}

const ReputationDeltaSchema = BaseLedgerEntrySchema.extend({
  key: z.string(),
  delta: z.object({
    confirmed: z.number().optional(),
    contradicted: z.number().optional(),
  }),
});

export type ReputationDeltaEntry = z.infer<typeof ReputationDeltaSchema>;

export const DEFAULT_REPUTATION_PATH = '.cache/parameters/source-reputation';

/**
 * SourceReputation — now backed by the generic `Ledger<T>` primitive.
 * Maintains the exact same public API for existing consumers.
 */
export class SourceReputation {
  readonly #ledger: Ledger<ReputationDeltaEntry>;
  readonly #entries = new Map<string, ReputationEntry>();
  readonly #floor: number;
  readonly #decayGate: number;

  constructor(options: SourceReputationOptions = {}) {
    this.#floor = options.floor ?? 0.5;
    this.#decayGate = options.contradictionsBeforeDecay ?? 2;
    const basePath = options.path
      ? require('node:path').dirname(options.path)
      : DEFAULT_REPUTATION_PATH;
    this.#ledger = createLedger<ReputationDeltaEntry>(basePath, ReputationDeltaSchema, {
      rollover: { daily: true, maxEntriesPerFile: 10_000, retentionDays: 30 },
    });
    this.#load();
  }

  #load(): void {
    const basePath = this.#ledger.getBasePath();
    const fs = require('node:fs');
    const path = require('node:path');
    try {
      const files = fs.readdirSync(basePath);
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const content = fs.readFileSync(path.join(basePath, file), 'utf-8');
        for (const line of content.split('\n')) {
          if (!line.trim()) continue;
          try {
            const r = JSON.parse(line) as ReputationDeltaEntry;
            const entry = this.#entries.get(r.key) ?? { confirmed: 0, contradicted: 0 };
            entry.confirmed += r.delta.confirmed ?? 0;
            entry.contradicted += r.delta.contradicted ?? 0;
            this.#entries.set(r.key, entry);
          } catch {
            /* skip malformed lines */
          }
        }
      }
    } catch {
      /* no ledger yet */
    }
  }

  record(key: string, outcome: 'confirmed' | 'contradicted'): void {
    const entry = this.#entries.get(key) ?? { confirmed: 0, contradicted: 0 };
    entry[outcome]++;
    this.#entries.set(key, entry);

    const delta = outcome === 'confirmed'
      ? { confirmed: 1, contradicted: 0 }
      : { confirmed: 0, contradicted: 1 };

    this.#ledger.append({
      at: Date.now(),
      key,
      delta,
    });
  }

  /** Clamped trust multiplier: 1.0 default, decays with contradictions, never below floor. */
  multiplier(key: string): number {
    const entry = this.#entries.get(key);
    if (!entry) return 1;
    if (entry.contradicted < this.#decayGate) return 1;
    const share = entry.contradicted / Math.max(entry.confirmed + entry.contradicted, 1);
    return Math.max(this.#floor, clamp01(1 - share));
  }

  /** `effectiveCeiling = baseQuality × multiplier` (clamped to [0, 1]). */
  effectiveCeiling(baseQuality: number, key: string): number {
    return clamp01(baseQuality * this.multiplier(key));
  }

  /** Reputation table for `.status` / retrospective audits. */
  table(): ReadonlyMap<string, ReputationEntry & { multiplier: number }> {
    return new Map(
      [...this.#entries.entries()].map(([key, e]) => [
        key,
        { ...e, multiplier: this.multiplier(key) },
      ])
    );
  }

  get size(): number {
    return this.#entries.size;
  }
}