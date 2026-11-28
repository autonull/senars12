import type { AutonomyMode, GovernanceDecision, GovernanceEvent, PatchProposal, RiskAssessment, SelfImprovementProposal } from '@senars/schemas/governance';
import type { FocusStepReport } from '../focus/Focus';
import type { SelfMetaGameImpl } from '../game/impls/SelfMetaGame';
export declare class PatchRiskClassifier {
    classify(patch: PatchProposal): RiskAssessment;
}
/** SelfMetaGame evidence for governance resolution. */
export interface SelfMetaGameEvidence {
    readonly focusReports: FocusStepReport[];
    readonly contradictionCount: number;
    readonly governanceQueues: {
        validation: number;
        approval: number;
    };
    readonly knobValues: Map<string, number>;
    readonly proposalBagPressure?: number;
    /** Chain of adaptation IDs that led to this decision */
    readonly derivationChain?: readonly string[];
}
/** Adaptation record for audit trail. */
export interface AdaptationRecord {
    readonly adaptationId: string;
    readonly timestamp: number;
    readonly proposal: SelfImprovementProposal;
    readonly decision: GovernanceDecision;
    readonly evidence: SelfMetaGameEvidence;
    readonly applied: boolean;
    readonly restoredFrom?: string;
    /** Derivation chain from parent adaptations */
    readonly derivationChain?: readonly string[];
}
/** Governance resolver integrating SelfMetaGame evidence with proposal routing. */
export declare class GovernanceResolver {
    private readonly router;
    private readonly policyEngine;
    private readonly riskClassifier;
    private readonly validator;
    private readonly adaptations;
    private readonly metaGame?;
    private derivationChain;
    constructor(metaGame?: SelfMetaGameImpl);
    /** Resolve a proposal using SelfMetaGame evidence. */
    resolve(proposal: SelfImprovementProposal, mode: AutonomyMode, actuators?: ProposalActuators): {
        decision: GovernanceDecision;
        route: ProposalRoute;
        applied: boolean;
        reason: string;
        adaptationId: string;
    };
    /** Get the current derivation chain. */
    getDerivationChain(): readonly string[];
    /** Set the derivation chain (e.g., on restore). */
    setDerivationChain(chain: readonly string[]): void;
    /** Assess risk of a self-improvement proposal. */
    private assessRisk;
    /** Gather evidence from SelfMetaGame. */
    private gatherEvidence;
    /** Get all adaptations (audit trail). */
    getAdaptations(): ReadonlyArray<AdaptationRecord>;
    /** Restore to a previous adaptation (undo). */
    restore(adaptationId: string): AdaptationRecord | null;
    /** Get pending proposals from router. */
    getAwaitingValidation(): ReadonlyArray<SelfImprovementProposal>;
    getAwaitingApproval(): ReadonlyArray<SelfImprovementProposal>;
    drainAwaitingValidation(actuators?: ProposalActuators): Array<{
        proposal: SelfImprovementProposal;
        route: ProposalRoute;
        applied: boolean;
        reason: string;
    }>;
    drainAwaitingApproval(): SelfImprovementProposal[];
}
export type ProposalRoute = 'auto-apply' | 'sandbox-validate' | 'human-approval';
export interface ProposalActuators {
    applyFocusWeight?: (focusId: string, weight: number) => void;
    applyKnob?: (knob: string, value: number) => void;
    applySchemaPatch?: (patch: {
        schemaId: string;
        mettaProgram: string;
        sourceDerivationIds: string[];
    }) => void;
}
export interface ValidationVerdict {
    approved: boolean;
    reason: string;
}
export declare class SandboxValidator {
    validate(proposal: SelfImprovementProposal): ValidationVerdict;
}
export declare class ProposalRouter {
    private awaitingValidation;
    private awaitingApproval;
    route(proposal: SelfImprovementProposal, mode: AutonomyMode, actuators?: ProposalActuators, validator?: SandboxValidator): {
        route: ProposalRoute;
        applied: boolean;
        reason: string;
    };
    getAwaitingValidation(): ReadonlyArray<SelfImprovementProposal>;
    getAwaitingApproval(): ReadonlyArray<SelfImprovementProposal>;
    /** D14: consume held validation proposals — nothing queues forever. Each is
     *  re-routed (with the supplied validator/actuators) and removed from the queue. */
    drainAwaitingValidation(actuators?: ProposalActuators, validator?: SandboxValidator): Array<{
        proposal: SelfImprovementProposal;
        route: ProposalRoute;
        applied: boolean;
        reason: string;
    }>;
    /** D14: consume held approval proposals (callers apply their own human-review flow). */
    drainAwaitingApproval(): SelfImprovementProposal[];
}
export declare class GovernancePolicyEngine {
    decide(risk: RiskAssessment, mode: AutonomyMode): GovernanceDecision;
    record(proposal: PatchProposal, assessment: RiskAssessment, decision: GovernanceDecision, mode: AutonomyMode): GovernanceEvent;
}
//# sourceMappingURL=pipeline.d.ts.map