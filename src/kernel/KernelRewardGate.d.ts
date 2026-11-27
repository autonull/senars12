import type { PolicyViolationEvent } from '@senars/schemas/cognitive-events';
import type { GateOutcome, RewardGateInput, RewardGateOutput } from '@senars/schemas/gate-io';
import type { RewardDomain, SelfImprovementProposal } from '@senars/schemas/governance';
import { SenarsError } from '@senars/errors';
import { KernelGate } from './gate-base';
export declare class EpistemicFirewallViolation extends SenarsError {
    readonly targetType: string;
    readonly targetId: string;
    readonly correlationId: string;
    constructor(targetType: string, targetId: string, correlationId: string, allowedTargets?: Iterable<string>, options?: ErrorOptions);
}
export interface KernelRewardGateConfig {
    allowedTargets: ReadonlySet<string>;
}
export declare class KernelRewardGate extends KernelGate<PolicyViolationEvent> {
    private allowedTargets;
    constructor(config?: Partial<KernelRewardGateConfig>);
    protected outcomeOf(output: unknown): GateOutcome;
    process(input: RewardGateInput): RewardGateOutput;
    private decideReward;
}
export declare class ExternalRewardGate extends KernelRewardGate {
    ingest(outcome: {
        rewardSignal: number;
        rewardType: RewardGateInput['rewardType'];
        targetId: string;
        eventId?: string;
    }): RewardGateOutput;
}
export declare class SelfRewardGate extends KernelRewardGate {
    private queue;
    propose(kind: SelfImprovementProposal['kind'], payload: Record<string, unknown>, rewardDomain: RewardDomain, correlationId?: any): SelfImprovementProposal;
    submit(kind: SelfImprovementProposal['kind'], payload: Record<string, unknown>, rewardDomain: RewardDomain, correlationId?: any): SelfImprovementProposal;
    pending(): ReadonlyArray<SelfImprovementProposal>;
    drain(): SelfImprovementProposal[];
}
//# sourceMappingURL=KernelRewardGate.d.ts.map