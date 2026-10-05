import type {
  GateOutcome,
  PolicyViolationEvent,
  RewardDomain,
  RewardGateInput,
  RewardGateOutput,
  SelfImprovementProposal,
} from '@senars/core/schemas';
import { proposalRisk, SelfImprovementProposalSchema } from '@senars/core/schemas';
import { makeId } from '@senars/util';
import { KernelGate, projectOutcome } from './gate-base.js';

/** The targets a reward signal may mutate — trust and scheduling, never a belief's
 *  frequency or confidence. The firewall message reads this list, so a configured
 *  gate cannot report targets it no longer allows. */
const DEFAULT_ALLOWED_TARGETS = new Set(['attention-priority', 'policy-weights']);

export class EpistemicFirewallViolation extends Error {
  public readonly targetType: string;
  public readonly targetId: string;
  public readonly correlationId: string;

  constructor(
    targetType: string,
    targetId: string,
    correlationId: string,
    allowedTargets: Iterable<string> = DEFAULT_ALLOWED_TARGETS
  ) {
    super(
      `Epistemic firewall violation: Reward signal cannot mutate ${targetType} (target: ${targetId}). Allowed targets: ${[...allowedTargets].join(', ')}`
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

export class KernelRewardGate extends KernelGate<PolicyViolationEvent> {
  private allowedTargets: ReadonlySet<string>;

  constructor(config?: Partial<KernelRewardGateConfig>) {
    super();
    this.allowedTargets = config?.allowedTargets ?? DEFAULT_ALLOWED_TARGETS;
  }

  protected override outcomeOf(output: unknown): GateOutcome {
    return projectOutcome<RewardGateOutput>(
      output,
      // A proposal requirement is a restriction, not a grant: nothing was mutated.
      (o) => o.accepted && !o.requiresProposal,
      (o) => (o.requiresProposal ? 'requires-proposal' : o.rejectionReason)
    );
  }

  process(input: RewardGateInput): RewardGateOutput {
    return this.decideAndRecord(
      'reward',
      input.targetType,
      input,
      (inp, correlation) => this.decideReward(inp, correlation),
      (inp) => inp.correlationId
    );
  }

  private decideReward(input: RewardGateInput, correlation: () => string): RewardGateOutput {
    const domain: RewardDomain = input.domain ?? 'external-reflex';

    if (!this.allowedTargets.has(input.targetType)) {
      const violation = new EpistemicFirewallViolation(
        input.targetType,
        input.targetId,
        correlation(),
        this.allowedTargets
      );

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
      riskTier: proposalRisk(kind),
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
