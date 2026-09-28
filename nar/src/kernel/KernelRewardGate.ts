import { makeId } from '@senars/util';
import type {
  PolicyViolationEvent,
  RewardDomain,
  RewardGateInput,
  RewardGateOutput,
  SelfImprovementProposal,
} from '@senars/kernel/schemas';
import { SelfImprovementProposalSchema } from '@senars/kernel/schemas';
import { GATE_LOG_CAPACITY, recordPolicyViolation } from './event-ring.js';
import { KernelGate } from './gate-base.js';

export class EpistemicFirewallViolation extends Error {
  public readonly targetType: string;
  public readonly targetId: string;
  public readonly correlationId: string;

  constructor(targetType: string, targetId: string, correlationId: string) {
    super(
      `Epistemic firewall violation: Reward signal cannot mutate ${targetType} (target: ${targetId}). Allowed targets: attention-priority, policy-weights`
    );
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

export class KernelRewardGate extends KernelGate<PolicyViolationEvent> {
  private allowedTargets: ReadonlySet<string>;

  constructor(config?: Partial<KernelRewardGateConfig>) {
    super();
    this.allowedTargets = config?.allowedTargets ?? DEFAULT_ALLOWED_TARGETS;
  }

  process(input: RewardGateInput): RewardGateOutput {
    const correlationId = this.correlationOf(input.correlationId);
    const domain: RewardDomain = input.domain ?? 'external-reflex';

    if (!this.allowedTargets.has(input.targetType)) {
      const violation = new EpistemicFirewallViolation(
        input.targetType,
        input.targetId,
        correlationId
      );

      recordPolicyViolation(this.eventLog, {
        policyId: 'epistemic-firewall',
        violationType: 'epistemic-firewall',
        detail: violation.message,
        correlationId,
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
  ingest(outcome: {
    rewardSignal: number;
    rewardType: RewardGateInput['rewardType'];
    targetId: string;
    eventId?: string;
  }): RewardGateOutput {
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

const PROPOSAL_RISK: Record<SelfImprovementProposal['kind'], SelfImprovementProposal['riskTier']> =
  {
    'focus-weight': 'low',
    'strategy-switch': 'low',
    'knob-tune': 'medium',
    'schema-promotion': 'medium',
    'test-generate': 'medium',
    'patch-apply': 'high',
    'schema-evolution': 'low',
    'metta-rule-adoption': 'low',
  };

export class SelfRewardGate extends KernelRewardGate {
  private queue: SelfImprovementProposal[] = [];

  propose(
    kind: SelfImprovementProposal['kind'],
    payload: Record<string, unknown>,
    rewardDomain: RewardDomain,
    correlationId = makeId()
  ): SelfImprovementProposal {
    return SelfImprovementProposalSchema.parse({
      proposalId: makeId(),
      kind,
      riskTier: PROPOSAL_RISK[kind],
      payload,
      rewardDomain,
      correlationId,
    });
  }

  submit(
    kind: SelfImprovementProposal['kind'],
    payload: Record<string, unknown>,
    rewardDomain: RewardDomain,
    correlationId = makeId()
  ): SelfImprovementProposal {
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
