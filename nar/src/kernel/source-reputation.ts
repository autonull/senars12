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
  /** Maximum entries in memory (AIKR bound; default 10000). LRU eviction applies. */
  capacity?: number;
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
export const DEFAULT_REPUTATION_CAPACITY = 10_000;

/**
 * SourceReputation — now backed by the generic `Ledger<T>` primitive.
 * Maintains the exact same public API for existing consumers.
 */
export class SourceReputation {
  readonly #ledger: Ledger<ReputationDeltaEntry>;
  readonly #entries = new Map<string, ReputationEntry>();
  readonly #accessOrder = new Set<string>(); // LRU: least recently used at start
  readonly #floor: number;
  readonly #decayGate: number;
  readonly #capacity: number;

  constructor(options: SourceReputationOptions = {}) {
    this.#floor = options.floor ?? 0.5;
    this.#decayGate = options.contradictionsBeforeDecay ?? 2;
    this.#capacity = options.capacity ?? DEFAULT_REPUTATION_CAPACITY;
    
    const path = options.path ?? DEFAULT_REPUTATION_PATH;
    this.#ledger = createLedger<ReputationDeltaEntry>(path, ReputationDeltaSchema, {
      rollover: { daily: true, maxEntriesPerFile: 10_000, retentionDays: 30 },
    });
    
    // Async load for rollover mode - fire and forget
    this.#ledger.query({}).then((entries) => {
      for (const r of entries) {
        const entry = this.#entries.get(r.key) ?? { confirmed: 0, contradicted: 0 };
        entry.confirmed += r.delta.confirmed ?? 0;
        entry.contradicted += r.delta.contradicted ?? 0;
        this.#entries.set(r.key, entry);
        this.#touch(r.key);
      }
    }).catch(() => {});
  }

  /** LRU touch — moves key to most-recently-used position. */
  #touch(key: string): void {
    this.#accessOrder.delete(key);
    this.#accessOrder.add(key);
    this.#evictIfNeeded();
  }

  /** Evict LRU entries if over capacity. */
  #evictIfNeeded(): void {
    while (this.#entries.size > this.#capacity && this.#accessOrder.size > 0) {
      const lru = this.#accessOrder.values().next().value;
      if (lru) {
        this.#accessOrder.delete(lru);
        this.#entries.delete(lru);
      } else {
        break;
      }
    }
  }

  record(key: string, outcome: 'confirmed' | 'contradicted'): void {
    const entry = this.#entries.get(key) ?? { confirmed: 0, contradicted: 0 };
    entry[outcome]++;
    this.#entries.set(key, entry);
    this.#touch(key);

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
    this.#touch(key);
    if (entry.contradicted < this.#decayGate) return 1;
    const share = entry.contradicted / Math.max(entry.confirmed + entry.contradicted, 1);
    return Math.max(this.#floor, clamp01(1 - share));
  }

  /** `effectiveCeiling = baseQuality × multiplier` (clamped to [0, 1]). */
  effectiveCeiling(baseQuality: number, key: string): number {
    const entry = this.#entries.get(key);
    if (!entry) return clamp01(baseQuality);
    this.#touch(key);
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

  /** Current capacity bound (for diagnostics/tests). */
  get capacity(): number {
    return this.#capacity;
  }
}