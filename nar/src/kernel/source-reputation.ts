/**
 * Phase E (REFACTOR.todo1): per-source-key track record → trust ceiling
 * multiplier. Trust-not-truth (RewardGate-compatible, C2): adjusts the
 * source-quality ceiling only — never a Truth value. Accumulates from
 * verification signals only (egress-gate rejections, `.react` corrections,
 * peer shadow-validation failures).
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { clamp01 } from '../utils';

export interface ReputationEntry {
  confirmed: number;
  contradicted: number;
}

export interface SourceReputationOptions {
  /** Multiplier floor (default 0.5). */
  floor?: number;
  /** JSONL persistence sink (append-only, ledger-style). */
  path?: string;
  /** Contradictions needed before the multiplier starts dropping (default 2). */
  contradictionsBeforeDecay?: number;
}

export const DEFAULT_REPUTATION_PATH = '.cache/parameters/source-reputation.jsonl';

export class SourceReputation {
  readonly #entries = new Map<string, ReputationEntry>();
  readonly #floor: number;
  readonly #decayGate: number;
  readonly #path?: string;

  constructor(options: SourceReputationOptions = {}) {
    this.#floor = options.floor ?? 0.5;
    this.#decayGate = options.contradictionsBeforeDecay ?? 2;
    this.#path = options.path;
    this.#load();
  }

  #load(): void {
    if (!this.#path) return;
    try {
      const content = readFileSync(this.#path, 'utf-8');
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          const r = JSON.parse(line) as { key: string; delta: Partial<ReputationEntry> };
          const entry = this.#entries.get(r.key) ?? { confirmed: 0, contradicted: 0 };
          entry.confirmed += r.delta.confirmed ?? 0;
          entry.contradicted += r.delta.contradicted ?? 0;
          this.#entries.set(r.key, entry);
        } catch {
          /* skip malformed lines */
        }
      }
    } catch {
      /* no ledger yet */
    }
  }

  #persist(key: string, delta: ReputationEntry): void {
    if (!this.#path) return;
    try {
      mkdirSync(dirname(this.#path), { recursive: true });
      appendFileSync(this.#path, `${JSON.stringify({ key, delta, at: Date.now() })}\n`);
    } catch {
      /* best-effort */
    }
  }

  record(key: string, outcome: 'confirmed' | 'contradicted'): void {
    const entry = this.#entries.get(key) ?? { confirmed: 0, contradicted: 0 };
    entry[outcome]++;
    this.#entries.set(key, entry);
    this.#persist(
      key,
      outcome === 'confirmed'
        ? { confirmed: 1, contradicted: 0 }
        : { confirmed: 0, contradicted: 1 }
    );
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
