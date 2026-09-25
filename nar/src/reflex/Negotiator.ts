import type { Focus } from '../focus/Focus.js';
import type { Perception } from '../game/Game.js';
import { withSpan } from '../otel/index.js';
import { TermBuilder } from '../terms';
import type { ContradictionEvent, NarEventBus } from '../types/events.js';
import type { ActionProposal, LearningEvent } from './Reflex.js';
import type { NALDerivation, NegotiationDecision } from './negotiation-types.js';
import { NalVetoArbitration, type ArbitrationStrategy } from './weighted-quorum.js';

export type { ArbitrationStrategy } from './weighted-quorum.js';
export type { NALDerivation, NegotiationDecision } from './negotiation-types.js';

export interface NegotiatorOptions {
  nalVetoThreshold?: number;
  reflexThreshold?: number;
  /** Additional proposal sources (e.g. a MeTTa voter) merged ahead of arbitration. */
  proposers?: IProposer[];
  /** Phase E (REFACTOR.todo2 §3): opt-in arbitration (default: NAL veto — Bench-15 parity). */
  arbitration?: ArbitrationStrategy;
  /** Phase C (REFACTOR.todo3 §10a M5): bus for typed `contradiction` events (absent ⇒ inert). */
  eventBus?: NarEventBus;
}

/** Proposal inputs a proposer may consult (REFACTOR.todo1 Phase A, §3 Negotiator generalization). */
export interface NegotiationInput {
  readonly reflexProposals: readonly ActionProposal[];
  readonly nalDerivations: readonly NALDerivation[];
}

export interface ProposerContribution {
  readonly reflex?: readonly ActionProposal[];
  readonly nal?: readonly NALDerivation[];
}

export interface IProposer {
  propose(input: NegotiationInput): ProposerContribution;
  learn(event: LearningEvent): void;
}

export class Negotiator {
  private readonly reflexThreshold: number;
  private readonly proposers: IProposer[];
  private readonly arbitration: ArbitrationStrategy;
  private readonly eventBus?: NarEventBus;

  constructor(options: NegotiatorOptions = {}) {
    this.reflexThreshold = options.reflexThreshold ?? 0.3;
    this.proposers = options.proposers ?? [];
    this.eventBus = options.eventBus;
    this.arbitration =
      options.arbitration ??
      new NalVetoArbitration({
        nalVetoThreshold: options.nalVetoThreshold,
        reflexThreshold: options.reflexThreshold,
      });
  }

  /** Registered proposers (empty by default — zero behavior change). */
  get registeredProposers(): readonly IProposer[] {
    return this.proposers;
  }

  /** Fan a learning event out to all proposers (no-op with none registered). */
  learn(event: LearningEvent): void {
    for (const p of this.proposers) p.learn(event);
  }

  /** P3 (TODO20): veto-memo hit-rate surface (size only; 0 with custom arbitration). */
  memoStats(): { size: number } {
    return { size: this.arbitration instanceof NalVetoArbitration ? this.arbitration.memoSize() : 0 };
  }

  resolve(reflexProposals: ActionProposal[], nalDerivations: NALDerivation[]): NegotiationDecision {
    return withSpan(
      'negotiator.resolve',
      {
        'negotiator.proposals': reflexProposals.length,
        'negotiator.derivations': nalDerivations.length,
      },
      (span) => {
        const input: NegotiationInput = { reflexProposals, nalDerivations };
        const mergedReflex: ActionProposal[] = [...reflexProposals];
        const mergedNal: NALDerivation[] = [...nalDerivations];
        for (const proposer of this.proposers) {
          const c = proposer.propose(input);
          if (c.reflex) mergedReflex.push(...c.reflex);
          if (c.nal) mergedNal.push(...c.nal);
        }
        const decision = this.arbitration.decide(mergedReflex, mergedNal);
        this.#emitContradictions(mergedReflex, mergedNal);
        span.setAttributes({
          'negotiator.source': decision.source,
          'negotiator.vetoed': decision.vetoedBy !== null,
          ...(decision.vetoedBy ? { 'negotiator.veto_reason': decision.vetoedBy } : {}),
        });
        return decision;
      }
    );
  }

  /**
   * Phase C (REFACTOR.todo3 §10a M5): MeTTa/NAL disagreement on the same
   * action → typed `contradiction` event (MeTTa votes yes, NAL lacks a
   * supporting derivation). Inert without an eventBus (C10: wired consumers only).
   */
  #emitContradictions(reflexProposals: readonly ActionProposal[], nalDerivations: readonly NALDerivation[]): void {
    if (!this.eventBus) return;
    const at = Date.now();
    for (const p of reflexProposals) {
      if (p.source !== 'metta') continue;
      const supporting = nalDerivations.some((d) => d.action === p.action && d.truth.f >= 0.5);
      const opposing = nalDerivations.find((d) => d.action === p.action && d.truth.f < 0.5);
      if (supporting || !opposing) continue;
      const event: ContradictionEvent = {
        source: 'metta',
        term: TermBuilder.atom(p.action),
        mettaVote: true,
        nalVote: false,
        at,
      };
      this.eventBus.emit('contradiction', event);
    }
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
