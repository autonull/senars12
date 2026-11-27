import type { RewardDomain } from '@senars/schemas';
import { SenarsError } from '@senars/errors';
import type { CapabilityRisk } from '@senars/util/capability-risk';
import type { FocusBag } from '../focus/FocusBag';
import type { SelfRewardGate } from '../kernel/KernelRewardGate';
import type { Reflex } from '../reflex/Reflex';
export type LearnerDomain = RewardDomain | 'external-reflex';
export interface DomainLearningEvent {
    domain: LearnerDomain;
    reward: number;
    focusId?: string;
    key?: string;
}
export declare class CrossDomainError extends SenarsError {
    constructor(learner: string, expected: string, got: string);
}
export declare abstract class DomainLearner {
    abstract readonly domain: LearnerDomain;
    abstract readonly risk: CapabilityRisk;
    protected guard(event: DomainLearningEvent): void;
    abstract learn(event: DomainLearningEvent): void;
}
export declare class ReflexLearner extends DomainLearner {
    private readonly reflex;
    readonly domain: LearnerDomain;
    readonly risk: 'low';
    constructor(reflex: Reflex);
    learn(event: DomainLearningEvent): void;
}
export declare class SchedulerAdapter extends DomainLearner {
    private readonly focusBag;
    private readonly learningRate;
    readonly domain: LearnerDomain;
    readonly risk: 'low';
    constructor(focusBag: FocusBag, learningRate?: number);
    learn(event: DomainLearningEvent): void;
}
export declare class PreferenceRanker extends DomainLearner {
    readonly domain: LearnerDomain;
    readonly risk: 'low';
    private scores;
    learn(event: DomainLearningEvent): void;
    rank(): string[];
}
export declare class ConfigOptimizer extends DomainLearner {
    private readonly proposals;
    readonly domain: LearnerDomain;
    readonly risk: 'medium';
    constructor(proposals: SelfRewardGate);
    learn(event: DomainLearningEvent): void;
    suggestKnob(knob: string, value: number): SelfImprovementProposal;
}
export declare class PatchSelector extends DomainLearner {
    private readonly proposals;
    readonly domain: LearnerDomain;
    readonly risk: 'high';
    constructor(proposals: SelfRewardGate);
    learn(event: DomainLearningEvent): void;
    scorePatch(diffRef: string, score: number): SelfImprovementProposal;
}
import { FunctionRegistry } from '../util/registry';
export declare class LearnerRegistry extends FunctionRegistry<LearnerDomain, DomainLearner> {
    constructor();
    register(learner: DomainLearner): void;
    dispatch(event: DomainLearningEvent): void;
    get(domain: LearnerDomain): DomainLearner | undefined;
}
//# sourceMappingURL=domain-learners.d.ts.map