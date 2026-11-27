import type { CapabilityApproval } from '../../capability/space';
import type { ActionProposal } from '../../reflex/Reflex';
import type { JudgmentDataset } from './distill';
import { ConfidenceRouter } from './policy';
import type { JudgmentProposition } from './types';
export interface ActionGateTransducerOptions {
    /** HITL hook; headless environments auto-reject by default. */
    approvals?: CapabilityApproval;
    /** Proposal-vs-desire threshold τ; builds the default router's act band. */
    threshold?: number;
    /** Explicit router (single threshold definition site); overrides `threshold`. */
    router?: ConfidenceRouter;
    /** Optional distillation dataset for recording approval labels. */
    distillationDataset?: JudgmentDataset;
}
/**
 * Teleological transducer (§7.2): converts Teleological judgments into
 * ActionProposals for the existing proposal → negotiate → authorize →
 * dispatch chain. Never produces Truth; authorization stays with KernelActionGate.
 */
export declare class ActionGateTransducer {
    #private;
    constructor(options?: ActionGateTransducerOptions);
    transduce(p: JudgmentProposition): ActionProposal | undefined;
}
//# sourceMappingURL=action-transducer.d.ts.map