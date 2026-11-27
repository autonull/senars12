import type { ParameterLedger } from '../../config/parameter-ledger';
import type { FocusStepReport } from '../../focus/Focus';
import type { FocusBag } from '../../focus/FocusBag';
import type { GameFocus } from '../../focus/GameFocus';
import type { ProposalRouterPort } from '../../governance/proposal-router-port';
import type { GateRegistry } from '../../kernel/index';
import type { SelfRewardGate } from '../../kernel/KernelRewardGate';
import type { LearnerRegistry } from '../../learning/domain-learners';
import type { ProposalBag } from '../../meta/proposal-bag';
import type { ContradictionEvent } from '../../types/events';
import type { SelfMetaGame } from '../Game';
import { MetaGame, type MetaGameConfig } from './MetaGame';
export interface KnobConfig {
    name: string;
    min: number;
    max: number;
    defaultValue: number;
}
export interface SelfMetaGameConfig extends MetaGameConfig {
    focusBag: FocusBag;
    gameFocuses: Map<string, GameFocus>;
    knobs?: KnobConfig[];
    /** Phase D (REFACTOR.todo2): bounded proposal bag — priority-ordered routing under pressure. */
    proposalBag?: ProposalBag;
    /** Phase B (REFACTOR.todo3): bag-drain budget (was hardcoded 4; `proposals.budget`). */
    drainBudget?: number;
    /** Gate authority for proposal routing; defaults to the process-global registry. */
    gates: GateRegistry;
    /** Optional proposal router for governance; defaults to no-op. */
    proposalRouter?: ProposalRouterPort;
}
export declare class SelfMetaGameImpl extends MetaGame implements SelfMetaGame {
    #private;
    private focusBag;
    private gameFocuses;
    /** TODO19 F5: system-scoped ParameterTable (the knob store + actuators). */
    private readonly parameterTable;
    private static readonly knobScope;
    private scheduler;
    /** D20 (TODO17b): the governance router that consumes self-improvement proposals. */
    private readonly proposalRouter;
    /** Phase D (REFACTOR.todo2): bounded proposal bag — absent ⇒ arrival-order routing. */
    private readonly proposalBag?;
    private readonly drainBudget;
    private readonly gates;
    constructor(config: SelfMetaGameConfig);
    setFocusWeight(focusId: string, weight: number): void;
    attachScheduler(registry: LearnerRegistry, rewardGate: SelfRewardGate): void;
    recordFocusStepReport(report: FocusStepReport): void;
    /** Route queued proposals through ProposalRouter with real actuators. */
    private routeProposals;
    /**
     * Phase C (REFACTOR.todo3 §10a M5): typed MeTTa/NAL disagreement intake.
     * The meta-game resolution strategy: penalize the disagreeing term's policy
     * signal and count the event (replaces the nar-execution substring-only path).
     */
    handleContradiction(event: ContradictionEvent): void;
    /** Phase C (REFACTOR.todo3): contradiction intake telemetry. */
    get contradictionCount(): number;
    /** D20 follow-up (TODO17b): live depth of the governance human-review queues. */
    getGovernanceQueues(): {
        validation: number;
        approval: number;
    };
    applyProposal(proposal: {
        kind: string;
        riskTier: string;
        payload: Record<string, unknown>;
    }): {
        applied: boolean;
        reason: string;
    };
    setKnob(knob: string, value: number): void;
    /** P4 (TODO20): batched knob application — one validation pass, coalesced actuation. */
    setKnobs(knobs: Record<string, number>): void;
    disableReflex(focusId: string, reflexId: string): void;
    getKnobValue(knob: string): number | undefined;
    getAllKnobs(): Map<string, number>;
    /** Phase B (REFACTOR.todo1): observe knob writes in the parameter ledger. */
    attachParameterLedger(ledger: ParameterLedger, writer?: string): void;
}
export declare function createSelfMetaGame(config: SelfMetaGameConfig): SelfMetaGameImpl;
//# sourceMappingURL=SelfMetaGame.d.ts.map