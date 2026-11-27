import type { Focus } from '../focus/Focus';
import type { Perception } from '../game/Game';
import type { NarEventBus } from '../types/events';
import type { NALDerivation, NegotiationDecision } from './negotiation-types';
import type { ActionProposal, LearningEvent } from './Reflex';
import { type ArbitrationStrategy } from './weighted-quorum';
export type { NALDerivation, NegotiationDecision } from './negotiation-types';
export type { ArbitrationStrategy } from './weighted-quorum';
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
export declare class Negotiator {
    #private;
    private readonly reflexThreshold;
    private readonly proposers;
    private readonly arbitration;
    private readonly eventBus?;
    constructor(options?: NegotiatorOptions);
    /** Registered proposers (empty by default — zero behavior change). */
    get registeredProposers(): readonly IProposer[];
    /** Fan a learning event out to all proposers (no-op with none registered). */
    learn(event: LearningEvent): void;
    /** P3 (TODO20): veto-memo hit-rate surface (size only; 0 with custom arbitration). */
    memoStats(): {
        size: number;
    };
    resolve(reflexProposals: ActionProposal[], nalDerivations: NALDerivation[]): NegotiationDecision;
    createLearningEvent(focus: Focus, decision: NegotiationDecision, outcome: {
        reward: number;
        terminal: boolean;
        perception: any;
        previousPerception?: Perception | null;
    }): LearningEvent;
}
//# sourceMappingURL=Negotiator.d.ts.map