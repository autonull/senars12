import { v4 as uuidv4 } from 'uuid';
import type {
    RewardGateInput,
    RewardGateOutput,
    PolicyViolationEvent,
} from '@senars/kernel/schemas';
import { validateCognitiveEvent } from '@senars/kernel/schemas';

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

        const accepted = true;
        let mutationApplied = false;

        if (input.targetType === 'attention-priority') {
            mutationApplied = true;
        } else if (input.targetType === 'policy-weights') {
            mutationApplied = true;
        }

        return { accepted, mutationApplied };
    }

    getEventLog(): ReadonlyArray<PolicyViolationEvent> {
        return this.eventLog;
    }

    clearEventLog(): void {
        this.eventLog = [];
    }
}