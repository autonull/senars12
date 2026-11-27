/**
 * Phase D (REFACTOR.todo2): Self-Improvement Proposals as an AIKR process —
 * proposals accumulate in a capacity-bounded bag (priority = expected impact ×
 * risk-inverse × drive-alignment); under pressure the highest-leverage
 * proposals drain into the governance router. Superseded proposals (same
 * kind + scope) decay out. Inert until wired: default processing stays
 * arrival-order.
 */
import type { SelfImprovementProposal } from '@senars/schemas';
import { type AikrBagOptions, type ProcessOptions } from '../learning/aikr-processor';
export interface ProposalCandidate {
    id: string;
    priority: number;
    proposal: SelfImprovementProposal;
    /** Supersede scope: same kind + payload target ⇒ newer supersedes older. */
    scope: string;
}
export declare const proposalScope: (proposal: SelfImprovementProposal) => string;
export interface ProposalBagOptions extends AikrBagOptions {
    /** Optional drive-alignment multiplier (default neutral 1). */
    alignmentOf?: (proposal: SelfImprovementProposal) => number;
    /** Injected clock for deterministic timestamps (default Date.now). */
    clock?: () => number;
}
/**
 * Governance routing is a per-call concern rather than a constructor-wired
 * sink, so this one composes the shell instead of inheriting it.
 */
export declare class ProposalBag {
    #private;
    constructor(options?: ProposalBagOptions);
    /** Admit a proposal; same-scope elders halve in priority (superseded ⇒ decay out). */
    admit(proposal: SelfImprovementProposal): boolean;
    /** Drain under pressure into the governance router (caller supplies routing). */
    drainIfPressured(route: (proposal: SelfImprovementProposal) => void, options?: ProcessOptions): Promise<SelfImprovementProposal[]>;
    /** Explicit drain — ignores the pressure gate (CLI/.proposals paths). */
    drain(route: (proposal: SelfImprovementProposal) => void, options?: ProcessOptions): Promise<SelfImprovementProposal[]>;
    /** Stage 6 — decay (superseded/stale proposals evaporate). */
    decay(rate?: number): void;
    get pressure(): number;
    get size(): number;
    peek(): SelfImprovementProposal[];
}
//# sourceMappingURL=proposal-bag.d.ts.map