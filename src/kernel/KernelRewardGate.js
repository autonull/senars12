import { proposalRisk, SelfImprovementProposalSchema } from '@senars/schemas/governance';
import { makeId } from '@senars/util/id';
import { SenarsError } from '@senars/errors';
import { KernelGate, projectOutcome } from './gate-base';
/** The targets a reward signal may mutate — trust and scheduling, never a belief's
 *  frequency or confidence. The firewall message reads this list, so a configured
 *  gate cannot report targets it no longer allows. */
const DEFAULT_ALLOWED_TARGETS = new Set(['attention-priority', 'policy-weights']);
export class EpistemicFirewallViolation extends SenarsError {
    targetType;
    targetId;
    correlationId;
    constructor(targetType, targetId, correlationId, allowedTargets = DEFAULT_ALLOWED_TARGETS, options) {
        super(`Epistemic firewall violation: Reward signal cannot mutate ${targetType} (target: ${targetId}). Allowed targets: ${[...allowedTargets].join(', ')}`, 'CROSS_DOMAIN', { targetType, targetId, correlationId, allowedTargets: [...allowedTargets] }, options);
        this.targetType = targetType;
        this.targetId = targetId;
        this.correlationId = correlationId;
        this.name = 'EpistemicFirewallViolation';
    }
}
export class KernelRewardGate extends KernelGate {
    allowedTargets;
    constructor(config) {
        super();
        this.allowedTargets = config?.allowedTargets ?? DEFAULT_ALLOWED_TARGETS;
    }
    outcomeOf(output) {
        return projectOutcome(output, 
        // A proposal requirement is a restriction, not a grant: nothing was mutated.
        (o) => o.accepted && !o.requiresProposal, (o) => (o.requiresProposal ? 'requires-proposal' : o.rejectionReason));
    }
    process(input) {
        return this.decideAndRecord('reward', input.targetType, input, (inp, correlation) => this.decideReward(inp, correlation), (inp) => inp.correlationId);
    }
    decideReward(input, correlation) {
        const domain = input.domain ?? 'external-reflex';
        if (!this.allowedTargets.has(input.targetType)) {
            const violation = new EpistemicFirewallViolation(input.targetType, input.targetId, correlation(), this.allowedTargets);
            this.recordPolicyViolation({
                policyId: 'epistemic-firewall',
                violationType: 'epistemic-firewall',
                detail: violation.message,
                correlationId: violation.correlationId,
            });
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
}
export class ExternalRewardGate extends KernelRewardGate {
    ingest(outcome) {
        return this.process({
            eventId: outcome.eventId ?? makeId(),
            rewardSignal: outcome.rewardSignal,
            rewardType: outcome.rewardType,
            targetType: 'policy-weights',
            targetId: outcome.targetId,
            domain: 'external-reflex',
        });
    }
}
export class SelfRewardGate extends KernelRewardGate {
    queue = [];
    propose(kind, payload, rewardDomain, correlationId = makeId()) {
        return SelfImprovementProposalSchema.parse({
            proposalId: makeId(),
            kind,
            riskTier: proposalRisk(kind),
            payload,
            rewardDomain,
            correlationId,
        });
    }
    submit(kind, payload, rewardDomain, correlationId = makeId()) {
        const proposal = this.propose(kind, payload, rewardDomain, correlationId);
        this.queue.push(proposal);
        return proposal;
    }
    pending() {
        return this.queue;
    }
    drain() {
        const out = [...this.queue];
        this.queue = [];
        return out;
    }
}
