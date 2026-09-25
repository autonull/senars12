/**
 * TODO25 Phase A (N1/N2): retrospective-driven strategy adaptation.
 * A correction-dominated retrospective is evidence the current reasoning
 * strategies under-serve the dialogue — the same precedent as the kernel's
 * `adaptWithRLFP`. Clamped: strategy-type switches only (never numeric
 * parameter mutation), one switch set per retrospective digest (N2), full
 * snapshot/restore, append-only ledger for the audit trail.
 */
import type { ParameterLedger } from '../../config/parameter-ledger.js';
import type { StrategyType } from '../../strategies/index.js';
import type { Retrospective } from '../types.js';

/** Structural surface of `CognitiveController` this consumer needs. */
export interface StrategyController {
  getStrategy(type: StrategyType): string | undefined;
  setStrategy(type: StrategyType, name: string): void;
}

export interface AdaptationRecord {
  retrospectiveDigest: string;
  from: Partial<Record<StrategyType, string | undefined>>;
  to: Partial<Record<StrategyType, string>>;
  at: number;
}

export interface AdaptationOptions {
  /** Negative reactions (correct+reject+abandon) required before adapting. */
  minNegative?: number;
  /** Fraction of reactions that must be negative (default 0.5). */
  negativeShare?: number;
  /** Phase B: observe strategy switches in the parameter ledger (C2). */
  ledger?: ParameterLedger;
}

const SWITCHES = [
  ['derivation', 'focused'],
  ['lm-rule', 'priority'],
] as const;

export class RetrospectiveAdapter {
  /** N2: one-shot per retrospective digest. */
  #applied = new Set<string>();
  #ledger: AdaptationRecord[] = [];

  constructor(
    private readonly controller: StrategyController,
    private readonly options: AdaptationOptions = {}
  ) {}

  get ledger(): readonly AdaptationRecord[] {
    return this.#ledger;
  }

  /** Adapt once per digest; returns true when a clamped switch set applied. */
  adaptFromRetrospective(r: Retrospective): boolean {
    if (this.#applied.has(r.digest)) return false;
    this.#applied.add(r.digest);

    const d = r.reactionDistribution;
    const negative = (d['correct'] ?? 0) + (d['reject'] ?? 0) + (d['abandon'] ?? 0);
    const minNegative = this.options.minNegative ?? 2;
    const share = this.options.negativeShare ?? 0.5;
    if (r.reactionCount < minNegative || negative / r.reactionCount < share) return false;

    const from: AdaptationRecord['from'] = {};
    const to: AdaptationRecord['to'] = {};
    for (const [type, name] of SWITCHES) {
      from[type] = this.controller.getStrategy(type);
      this.controller.setStrategy(type, name);
      to[type] = name;
      this.options.ledger?.record({
        writer: 'retrospective-adapter',
        scope: 'strategy',
        parameter: `strategy:${type}`,
        oldValue: from[type] ?? '',
        newValue: name,
        at: Date.now(),
        trigger: r.digest,
      });
    }
    this.#ledger.push({ retrospectiveDigest: r.digest, from, to, at: Date.now() });
    return true;
  }

  /** N1 rollback: restore the strategies captured by the most recent switch. */
  restore(): boolean {
    const last = this.#ledger.at(-1);
    if (!last) return false;
    for (const [type, name] of SWITCHES) {
      const previous = last.from[type];
      if (previous) this.controller.setStrategy(type, previous);
    }
    this.#ledger.pop();
    return true;
  }
}
