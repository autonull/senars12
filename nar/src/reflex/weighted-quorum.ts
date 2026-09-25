/**
 * Phase E (REFACTOR.todo2 §3/§8): pluggable arbitration for `Negotiator`.
 * `NalVetoArbitration` is the extracted default (byte-identical to the former
 * inline `decide()`); `WeightedQuorum` is the opt-in consensus alternative.
 */
import type { NALDerivation, NegotiationDecision } from './negotiation-types.js';
import type { ActionProposal } from './Reflex.js';

export interface ArbitrationStrategy {
  decide(
    reflexProposals: readonly ActionProposal[],
    nalDerivations: readonly NALDerivation[]
  ): NegotiationDecision;
}

const none = (arbitration: NegotiationDecision['arbitration']): NegotiationDecision => ({
  action: null,
  actionExecuted: null,
  vetoedBy: null,
  confidence: 0,
  source: 'none',
  arbitration,
});

const bestOf = (proposals: readonly ActionProposal[]): ActionProposal | null =>
  proposals.reduce<ActionProposal | null>(
    (best, p) => (!best || p.value * p.confidence > best.value * best.confidence ? p : best),
    null
  );

/** Extracted Negotiator default: reflex best-of with the NAL trap veto (Bench-15). */
export class NalVetoArbitration implements ArbitrationStrategy {
  /**
   * P3 (TODO20): memoized `isVetoingAction` keyed by the full predicate input
   * (action, truth, proposal) — pure function of the key, so entries can never
   * go stale; bounded and cleared wholesale past the cap.
   */
  readonly #vetoMemo = new Map<string, boolean>();
  static readonly #VETO_MEMO_CAP = 10_000;
  readonly #nalVetoThreshold: number;
  readonly #reflexThreshold: number;

  constructor(options: { nalVetoThreshold?: number; reflexThreshold?: number } = {}) {
    this.#nalVetoThreshold = options.nalVetoThreshold ?? 0.8;
    this.#reflexThreshold = options.reflexThreshold ?? 0.3;
  }

  decide(
    reflexProposals: readonly ActionProposal[],
    nalDerivations: readonly NALDerivation[]
  ): NegotiationDecision {
    if (reflexProposals.length === 0) return none('nal-veto');

    const bestReflex = bestOf(reflexProposals)!;
    if (bestReflex.value * bestReflex.confidence < this.#reflexThreshold) {
      return { ...none('nal-veto'), vetoedBy: 'below-threshold' };
    }

    // Veto (Bench-15): NAL derives the best action leads to bad outcome (low
    // frequency = trap). The veto blocks the trap action; if another legal
    // proposal remains, the best one acts instead — the veto prevents the
    // known trap without paralyzing the agent. Otherwise the tick yields.
    const trap = nalDerivations.find((d) => this.#isVetoingAction(d, bestReflex.action));
    if (!trap) {
      return {
        action: bestReflex.action,
        actionExecuted: bestReflex.action,
        vetoedBy: null,
        confidence: bestReflex.confidence,
        source: 'reflex',
        arbitration: 'nal-veto',
      };
    }
    const fallback = reflexProposals
      .filter((p) => !nalDerivations.some((d) => this.#isVetoingAction(d, p.action)))
      .reduce<ActionProposal | null>(
        (best, p) => (!best || p.value * p.confidence > best.value * best.confidence ? p : best),
        null
      );
    return {
      action: bestReflex.action,
      actionExecuted: fallback?.action ?? null,
      vetoedBy: `nal-${trap.source}`,
      confidence: fallback?.confidence ?? trap.truth.c,
      source: 'nal',
      arbitration: 'nal-veto',
    };
  }

  /** Memo size surface (Negotiator.memoStats parity, P3/TODO20). */
  memoSize(): number {
    return this.#vetoMemo.size;
  }

  #isVetoingAction(derivation: NALDerivation, proposedAction: string): boolean {
    const key = `${derivation.action}|${derivation.truth.f}|${derivation.truth.c}|${proposedAction}`;
    const cached = this.#vetoMemo.get(key);
    if (cached !== undefined) return cached;
    const result =
      derivation.action === proposedAction &&
      derivation.truth.f < 0.3 &&
      derivation.truth.c >= this.#nalVetoThreshold;
    if (this.#vetoMemo.size >= NalVetoArbitration.#VETO_MEMO_CAP) this.#vetoMemo.clear();
    this.#vetoMemo.set(key, result);
    return result;
  }
}

/**
 * Consensus arbitration (opt-in): NAL derivations vote on proposed actions
 * instead of hard-vetoing — supporting derivations (f ≥ 0.5) add weight,
 * opposing ones (f < 0.3 with high confidence) subtract; the top quorum score
 * above the floor acts.
 */
export class WeightedQuorum implements ArbitrationStrategy {
  readonly #floor: number;
  readonly #reflexThreshold: number;
  readonly #vetoThreshold: number;

  constructor(
    options: { reflexThreshold?: number; quorumFloor?: number; nalVetoThreshold?: number } = {}
  ) {
    this.#reflexThreshold = options.reflexThreshold ?? 0.3;
    this.#floor = options.quorumFloor ?? 0;
    this.#vetoThreshold = options.nalVetoThreshold ?? 0.8;
  }

  decide(
    reflexProposals: readonly ActionProposal[],
    nalDerivations: readonly NALDerivation[]
  ): NegotiationDecision {
    if (reflexProposals.length === 0) return none('weighted-quorum');

    const quorum = new Map<string, number>();
    for (const p of reflexProposals) {
      quorum.set(p.action, (quorum.get(p.action) ?? 0) + p.value * p.confidence);
    }
    for (const d of nalDerivations) {
      if (!quorum.has(d.action)) continue;
      const vote =
        d.truth.f >= 0.5 ? d.truth.c : d.truth.f < 0.3 && d.truth.c >= this.#vetoThreshold ? -d.truth.c : 0;
      quorum.set(d.action, quorum.get(d.action)! + vote);
    }

    const winner = [...quorum.entries()]
      .filter(([action, score]) => score >= this.#floor)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
    if (!winner) return none('weighted-quorum');
    const best = bestOf(reflexProposals.filter((p) => p.action === winner[0]));
    if (!best || best.value * best.confidence < this.#reflexThreshold) return none('weighted-quorum');
    return {
      action: winner[0],
      actionExecuted: winner[0],
      vetoedBy: null,
      confidence: best.confidence,
      source: 'reflex',
      arbitration: 'weighted-quorum',
    };
  }
}
