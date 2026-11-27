/**
 * Phase E (REFACTOR.todo2 §3/§8): pluggable arbitration for `Negotiator`.
 * `NalVetoArbitration` is the extracted default (byte-identical to the former
 * inline `decide()`); `WeightedQuorum` is the opt-in consensus alternative.
 */
import type { NALDerivation, NegotiationDecision } from './negotiation-types';
import { type ActionProposal } from './Reflex';
export interface ArbitrationStrategy {
    decide(reflexProposals: readonly ActionProposal[], nalDerivations: readonly NALDerivation[]): NegotiationDecision;
}
/** Extracted Negotiator default: reflex best-of with the NAL trap veto (Bench-15). */
export declare class NalVetoArbitration implements ArbitrationStrategy {
    #private;
    constructor(options?: {
        nalVetoThreshold?: number;
        reflexThreshold?: number;
    });
    decide(reflexProposals: readonly ActionProposal[], nalDerivations: readonly NALDerivation[]): NegotiationDecision;
    /** Memo size surface (Negotiator.memoStats parity, P3/TODO20). */
    memoSize(): number;
}
/**
 * Consensus arbitration (opt-in): NAL derivations vote on proposed actions
 * instead of hard-vetoing — supporting derivations (f ≥ 0.5) add weight,
 * opposing ones (f < 0.3 with high confidence) subtract; the top quorum score
 * above the floor acts.
 */
export declare class WeightedQuorum implements ArbitrationStrategy {
    #private;
    constructor(options?: {
        reflexThreshold?: number;
        quorumFloor?: number;
        nalVetoThreshold?: number;
    });
    decide(reflexProposals: readonly ActionProposal[], nalDerivations: readonly NALDerivation[]): NegotiationDecision;
}
//# sourceMappingURL=weighted-quorum.d.ts.map