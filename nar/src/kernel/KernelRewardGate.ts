import { v4 as uuidv4 } from 'uuid';
import type {
    RewardGateInput,
    RewardGateOutput,
    RewardDomain,
    PolicyViolationEvent,
    SelfImprovementProposal,
} from '@senars/kernel/schemas';
import { validateCognitiveEvent, SelfImprovementProposalSchema } from '@senars/kernel/schemas';

export class EpistemicFirewallViolation extends Error {
    public readonly targetType: string;
    public readonly targetId: string;
    public readonly correlationId: string;

    constructor(targetType: string, targetId: string, correlationId: string) {
        super(`Epistemic firewall violation: Reward signal cannot mutate ${targetType} (target: ${targetId}). Allowed targets: attention-priority, policy-weights`);
        this.name = 'EpistemicFirewallViolation';
        this.targetType = targetType;
        this.targetId = targetId;
        this.correlationId = correlationId;
    }
}

export interface KernelRewardGateConfig {
    allowedTargets: ReadonlySet<string>;
}

const DEFAULT_ALLOWED_TARGETS = new Set(['attention-priority', 'policy-weights']);

export class KernelRewardGate {
    private eventLog: PolicyViolationEvent[] = [];
    private allowedTargets: ReadonlySet<string>;

    constructor(config?: Partial<KernelRewardGateConfig>) {
        this.allowedTargets = config?.allowedTargets ?? DEFAULT_ALLOWED_TARGETS;
    }

    process(input: RewardGateInput): RewardGateOutput {
        const correlationId = input.correlationId ?? uuidv4();
        const domain: RewardDomain = input.domain ?? 'external-reflex';

        if (!this.allowedTargets.has(input.targetType)) {
            const violation = new EpistemicFirewallViolation(input.targetType, input.targetId, correlationId);

            const event: PolicyViolationEvent = {
                type: 'policy.violation',
                engine: 'kernel',
                timestamp: Date.now(),
                correlationId,
                payload: {
                    policyId: 'epistemic-firewall',
                    violationType: 'epistemic-firewall',
                    detail: violation.message,
                    severity: 'block',
                },
            };
            validateCognitiveEvent(event);
            this.eventLog.push(event);

            return {
                accepted: false,
                epistemicFirewallViolation: true,
                rejectionReason: violation.message,
            };
        }

        if (domain !== 'external-reflex') {
            return { accepted: true, mutationApplied: false, requiresProposal: true };
        }

        return { accepted: true, mutationApplied: true };
    }

    getEventLog(): ReadonlyArray<PolicyViolationEvent> {
        return this.eventLog;
    }

    clearEventLog(): void {
        this.eventLog = [];
    }
}

export class ExternalRewardGate extends KernelRewardGate {
    ingest(outcome: { rewardSignal: number; rewardType: RewardGateInput['rewardType']; targetId: string; eventId?: string }): RewardGateOutput {
        return this.process({ eventId: outcome.eventId ?? uuidv4(), rewardSignal: outcome.rewardSignal, rewardType: outcome.rewardType, targetType: 'policy-weights', targetId: outcome.targetId, domain: 'external-reflex' });
    }
}

const PROPOSAL_RISK: Record<SelfImprovementProposal['kind'], SelfImprovementProposal['riskTier']> = {
    'focus-weight': 'low', 'strategy-switch': 'low', 'knob-tune': 'medium',
    'schema-promotion': 'medium', 'test-generate': 'medium', 'patch-apply': 'high',
};

export class SelfRewardGate extends KernelRewardGate {
    private queue: SelfImprovementProposal[] = [];

    propose(kind: SelfImprovementProposal['kind'], payload: Record<string, unknown>, rewardDomain: RewardDomain, correlationId = uuidv4()): SelfImprovementProposal {
        return SelfImprovementProposalSchema.parse({ proposalId: uuidv4(), kind, riskTier: PROPOSAL_RISK[kind], payload, rewardDomain, correlationId });
    }

    submit(kind: SelfImprovementProposal['kind'], payload: Record<string, unknown>, rewardDomain: RewardDomain, correlationId = uuidv4()): SelfImprovementProposal {
        const proposal = this.propose(kind, payload, rewardDomain, correlationId);
        this.queue.push(proposal);
        return proposal;
    }

    pending(): ReadonlyArray<SelfImprovementProposal> {
        return this.queue;
    }

    drain(): SelfImprovementProposal[] {
        const out = [...this.queue];
        this.queue = [];
        return out;
    }
}