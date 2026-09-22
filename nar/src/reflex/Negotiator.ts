import type { Focus } from '../focus/Focus.js';
import type { Perception } from '../game/Game.js';
import { withSpan } from '../otel/index.js';
import type { ActionProposal, LearningEvent } from './Reflex.js';

export interface NALDerivation {
  action: string;
  truth: { f: number; c: number };
  source: string;
  /** Serialized premise term the derivation was indexed from (belief seeding, E7). */
  premise?: string;
}

export interface NegotiationDecision {
  action: string | null;
  actionExecuted: string | null;
  vetoedBy: string | null;
  confidence: number;
  source: 'reflex' | 'nal' | 'none';
}

export interface NegotiatorOptions {
  nalVetoThreshold?: number;
  reflexThreshold?: number;
}

export class Negotiator {
  private readonly nalVetoThreshold: number;
  private readonly reflexThreshold: number;
  /**
   * P3 (TODO20): memoized `isVetoingAction` keyed by the full predicate input
   * (action, truth, proposal) — pure function of the key, so entries can never
   * go stale; bounded and cleared wholesale past the cap.
   */
  private readonly vetoMemo = new Map<string, boolean>();
  private static readonly VETO_MEMO_CAP = 10_000;

  constructor(options: NegotiatorOptions = {}) {
    this.nalVetoThreshold = options.nalVetoThreshold ?? 0.8;
    this.reflexThreshold = options.reflexThreshold ?? 0.3;
  }

  resolve(reflexProposals: ActionProposal[], nalDerivations: NALDerivation[]): NegotiationDecision {
    return withSpan(
      'negotiator.resolve',
      {
        'negotiator.proposals': reflexProposals.length,
        'negotiator.derivations': nalDerivations.length,
      },
      (span) => {
        const decision = this.decide(reflexProposals, nalDerivations);
        span.setAttributes({
          'negotiator.source': decision.source,
          'negotiator.vetoed': decision.vetoedBy !== null,
          ...(decision.vetoedBy ? { 'negotiator.veto_reason': decision.vetoedBy } : {}),
        });
        return decision;
      }
    );
  }

  private decide(
    reflexProposals: ActionProposal[],
    nalDerivations: NALDerivation[]
  ): NegotiationDecision {
    if (reflexProposals.length === 0) {
      return { action: null, actionExecuted: null, vetoedBy: null, confidence: 0, source: 'none' };
    }

    const bestReflex = reflexProposals.reduce((best, p) =>
      p.value * p.confidence > best.value * best.confidence ? p : best
    );

    if (bestReflex.value * bestReflex.confidence < this.reflexThreshold) {
      return {
        action: null,
        actionExecuted: null,
        vetoedBy: 'below-threshold',
        confidence: 0,
        source: 'none',
      };
    }

    // Veto (Bench-15): NAL derives the best action leads to bad outcome (low
    // frequency = trap). The veto blocks the trap action; if another legal
    // proposal remains, the best one acts instead — the veto prevents the
    // known trap without paralyzing the agent. Otherwise the tick yields.
    const trap = nalDerivations.find((d) => this.isVetoingAction(d, bestReflex.action));
    if (!trap) {
      return {
        action: bestReflex.action,
        actionExecuted: bestReflex.action,
        vetoedBy: null,
        confidence: bestReflex.confidence,
        source: 'reflex',
      };
    }
    const vetoedBy = `nal-${trap.source}`;
    const fallback = reflexProposals
      .filter((p) => !nalDerivations.some((d) => this.isVetoingAction(d, p.action)))
      .reduce<ActionProposal | null>(
        (best, p) => (!best || p.value * p.confidence > best.value * best.confidence ? p : best),
        null
      );
    return {
      action: bestReflex.action,
      actionExecuted: fallback?.action ?? null,
      vetoedBy,
      confidence: fallback?.confidence ?? trap.truth.c,
      source: 'nal',
    };
  }

  private isVetoingAction(derivation: NALDerivation, proposedAction: string): boolean {
    const key = `${derivation.action}|${derivation.truth.f}|${derivation.truth.c}|${proposedAction}`;
    const cached = this.vetoMemo.get(key);
    if (cached !== undefined) return cached;
    const result =
      derivation.action === proposedAction &&
      derivation.truth.f < 0.3 &&
      derivation.truth.c >= this.nalVetoThreshold;
    if (this.vetoMemo.size >= Negotiator.VETO_MEMO_CAP) this.vetoMemo.clear();
    this.vetoMemo.set(key, result);
    return result;
  }

  /** P3 (TODO20): memo hit rate over the veto predicate (0 before first fill). */
  memoStats(): { size: number } {
    return { size: this.vetoMemo.size };
  }

  createLearningEvent(
    focus: Focus,
    decision: NegotiationDecision,
    outcome: {
      reward: number;
      terminal: boolean;
      perception: any;
      previousPerception?: Perception | null;
    }
  ): LearningEvent {
    return {
      perception: outcome.perception,
      previousPerception: outcome.previousPerception ?? null,
      actionProposed: decision.action ?? '',
      actionExecuted: decision.actionExecuted,
      reward: outcome.reward,
      terminal: outcome.terminal,
      overriddenBy: decision.vetoedBy,
    };
  }
}
