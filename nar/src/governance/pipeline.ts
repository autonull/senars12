import type {
  AutonomyMode,
  GovernanceDecision,
  GovernanceEvent,
  PatchProposal,
  RiskAssessment,
  SelfImprovementProposal,
} from '@senars/kernel/schemas';
import { v4 as uuidv4 } from 'uuid';
import { findKnobSpec } from '../rlfp/knobs.js';
import type { FocusStepReport } from '../focus/Focus.js';
import type { SelfMetaGameImpl } from '../game/SelfMetaGame.js';

const GUARDRAIL_FRAGMENTS = [
  'ApprovalManager',
  'PolicyEngine',
  'nar/src/kernel/',
  'nar/src/gates/',
  'nar/src/capability/',
  'capability/wasi',
  'nar/src/rlfp/RewardModel',
  'nar/src/rlfp/PolicyOptimizer',
  'rlfp/',
  'kernel/src/schemas',
  'util/src/types/cognitive',
  'nar/src/config/budget',
];

const CRITICAL_COMPONENTS = [
  'approval-logic',
  'sandbox-config',
  'reward-functions',
  'autonomy-mode',
  'kernel-gates',
] as const;

export class PatchRiskClassifier {
  classify(patch: PatchProposal): RiskAssessment {
    const factors: RiskAssessment['factors'] = [];
    let score = 0;
    for (const file of patch.affectedFiles) {
      if (GUARDRAIL_FRAGMENTS.some((f) => file.includes(f))) {
        factors.push({ factor: 'critical-path', file, severity: 'HIGH' });
        score += 50;
      }
    }
    for (const component of patch.affectedComponents) {
      if (CRITICAL_COMPONENTS.includes(component as (typeof CRITICAL_COMPONENTS)[number])) {
        factors.push({ factor: 'critical-component', component, severity: 'HIGH' });
        score += 40;
      }
    }
    const churn = patch.linesAdded + patch.linesRemoved;
    if (churn > 500) {
      factors.push({ factor: 'large-churn', severity: 'LOW' });
      score += 10;
    }
    if ((patch.coverageDelta ?? 0) < -5) {
      factors.push({ factor: 'coverage-drop', severity: 'MEDIUM' });
      score += 15;
    }
    return { risk: score >= 40 ? 'HIGH' : score >= 20 ? 'MEDIUM' : 'LOW', score, factors };
  }
}

/** SelfMetaGame evidence for governance resolution. */
export interface SelfMetaGameEvidence {
  readonly focusReports: FocusStepReport[];
  readonly contradictionCount: number;
  readonly governanceQueues: { validation: number; approval: number };
  readonly knobValues: Map<string, number>;
  readonly proposalBagPressure?: number;
}

/** Adaptation record for audit trail. */
export interface AdaptationRecord {
  readonly adaptationId: string;
  readonly timestamp: number;
  readonly proposal: SelfImprovementProposal;
  readonly decision: GovernanceDecision;
  readonly evidence: SelfMetaGameEvidence;
  readonly applied: boolean;
  readonly restoredFrom?: string; // adaptationId if this is a restore
}

/** Governance resolver integrating SelfMetaGame evidence with proposal routing. */
export class GovernanceResolver {
  private readonly router: ProposalRouter;
  private readonly policyEngine: GovernancePolicyEngine;
  private readonly riskClassifier: PatchRiskClassifier;
  private readonly validator: SandboxValidator;
  private readonly adaptations: AdaptationRecord[] = [];
  private readonly metaGame?: SelfMetaGameImpl;

  constructor(metaGame?: SelfMetaGameImpl) {
    this.router = new ProposalRouter();
    this.policyEngine = new GovernancePolicyEngine();
    this.riskClassifier = new PatchRiskClassifier();
    this.validator = new SandboxValidator();
    this.metaGame = metaGame;
  }

  /** Resolve a proposal using SelfMetaGame evidence. */
  resolve(
    proposal: SelfImprovementProposal,
    mode: AutonomyMode,
    actuators: ProposalActuators = {}
  ): { decision: GovernanceDecision; route: ProposalRoute; applied: boolean; reason: string; adaptationId: string } {
    const evidence = this.gatherEvidence();
    const risk = this.assessRisk(proposal);
    const decision = this.policyEngine.decide(risk, mode);
    const routing = this.router.route(proposal, mode, actuators, this.validator);

    const adaptationId = uuidv4();
    const adaptation: AdaptationRecord = {
      adaptationId,
      timestamp: Date.now(),
      proposal,
      decision,
      evidence,
      applied: routing.applied,
    };
    this.adaptations.push(adaptation);

    return { decision, route: routing.route, applied: routing.applied, reason: routing.reason, adaptationId };
  }

  /** Assess risk of a self-improvement proposal. */
  private assessRisk(proposal: SelfImprovementProposal): RiskAssessment {
    // Convert SelfImprovementProposal to PatchProposal-like for risk classification
    const mockPatch: PatchProposal = {
      proposalId: proposal.proposalId,
      patchRef: '',
      baseCommit: '',
      patchDiff: '',
      ciResults: { test: true, typecheck: true, lint: true, durationMs: 0 },
      riskSelfAssessment: proposal.riskTier === 'high' ? 'HIGH' : proposal.riskTier === 'medium' ? 'MEDIUM' : 'LOW',
      affectedComponents: ['cognitive-params'],
      affectedFiles: [],
      linesAdded: 0,
      linesRemoved: 0,
      rationale: `Self-improvement: ${proposal.kind}`,
      timestamp: Date.now(),
      agentSignature: 'self-meta-game',
    };
    return this.riskClassifier.classify(mockPatch);
  }

  /** Gather evidence from SelfMetaGame. */
  private gatherEvidence(): SelfMetaGameEvidence {
    if (!this.metaGame) {
      return {
        focusReports: [],
        contradictionCount: 0,
        governanceQueues: { validation: 0, approval: 0 },
        knobValues: new Map(),
      };
    }
    return {
      focusReports: [], // Would be populated from actual reports
      contradictionCount: this.metaGame.contradictionCount,
      governanceQueues: this.metaGame.getGovernanceQueues(),
      knobValues: this.metaGame.getAllKnobs(),
    };
  }

  /** Get all adaptations (audit trail). */
  getAdaptations(): ReadonlyArray<AdaptationRecord> {
    return this.adaptations;
  }

  /** Restore to a previous adaptation (undo). */
  restore(adaptationId: string): AdaptationRecord | null {
    const idx = this.adaptations.findIndex((a) => a.adaptationId === adaptationId);
    if (idx === -1) return null;

    const original = this.adaptations[idx]!;
    // Create a reverse adaptation
    const restoreAdaptation: AdaptationRecord = {
      adaptationId: uuidv4(),
      timestamp: Date.now(),
      proposal: { ...original.proposal, proposalId: uuidv4() },
      decision: { action: 'REJECT', reason: `Restored from ${adaptationId}` },
      evidence: original.evidence,
      applied: true,
      restoredFrom: adaptationId,
    };
    this.adaptations.push(restoreAdaptation);
    return restoreAdaptation;
  }

  /** Get pending proposals from router. */
  getAwaitingValidation(): ReadonlyArray<SelfImprovementProposal> {
    return this.router.getAwaitingValidation();
  }

  getAwaitingApproval(): ReadonlyArray<SelfImprovementProposal> {
    return this.router.getAwaitingApproval();
  }

  drainAwaitingValidation(
    actuators: ProposalActuators = {}
  ): Array<{ proposal: SelfImprovementProposal; route: ProposalRoute; applied: boolean; reason: string }> {
    return this.router.drainAwaitingValidation(actuators, this.validator);
  }

  drainAwaitingApproval(): SelfImprovementProposal[] {
    return this.router.drainAwaitingApproval();
  }
}

export type ProposalRoute = 'auto-apply' | 'sandbox-validate' | 'human-approval';

export interface ProposalActuators {
  applyFocusWeight?: (focusId: string, weight: number) => void;
  applyKnob?: (knob: string, value: number) => void;
}

export interface ValidationVerdict {
  approved: boolean;
  reason: string;
}

export class SandboxValidator {
  validate(proposal: SelfImprovementProposal): ValidationVerdict {
    if (proposal.kind !== 'knob-tune')
      return {
        approved: false,
        reason: `No automated checks for ${proposal.kind}; requires human review`,
      };
    const { knob, value } = proposal.payload;
    const knobName = String(knob);

    const spec = findKnobSpec(knobName);
    if (!spec)
      return {
        approved: false,
        reason: `Unknown ${knobName.startsWith('systemOne.') ? 'systemOne ' : ''}knob '${knobName}'`,
      };
    if (typeof value !== 'number' || Number.isNaN(value))
      return { approved: false, reason: `Non-numeric value for '${spec.name}'` };
    if (value < spec.min || value > spec.max)
      return {
        approved: false,
        reason: `'${spec.name}'=${value} outside [${spec.min}, ${spec.max}]`,
      };
    return { approved: true, reason: `'${spec.name}'=${value} within [${spec.min}, ${spec.max}]` };
  }
}

export class ProposalRouter {
  private awaitingValidation: SelfImprovementProposal[] = [];
  private awaitingApproval: SelfImprovementProposal[] = [];

  route(
    proposal: SelfImprovementProposal,
    mode: AutonomyMode,
    actuators: ProposalActuators = {},
    validator?: SandboxValidator
  ): { route: ProposalRoute; applied: boolean; reason: string } {
    if (proposal.riskTier === 'high') {
      this.awaitingApproval.push(proposal);
      return {
        route: 'human-approval',
        applied: false,
        reason: `High-risk ${proposal.kind} requires human/external approval`,
      };
    }
    if (proposal.riskTier === 'medium') {
      const verdict = validator?.validate(proposal);
      const executable = mode !== 'observe-only' && mode !== 'propose-only';
      if (
        verdict?.approved &&
        executable &&
        proposal.kind === 'knob-tune' &&
        actuators.applyKnob &&
        typeof proposal.payload['knob'] === 'string' &&
        typeof proposal.payload['value'] === 'number'
      ) {
        actuators.applyKnob(
          proposal.payload['knob'] as string,
          proposal.payload['value'] as number
        );
        return {
          route: 'auto-apply',
          applied: true,
          reason: `Sandbox-validated: ${verdict.reason}`,
        };
      }
      this.awaitingValidation.push(proposal);
      return {
        route: 'sandbox-validate',
        applied: false,
        reason: verdict
          ? `Held: ${verdict.reason}`
          : `Medium-risk ${proposal.kind} requires sandbox validation`,
      };
    }
    if (mode === 'observe-only' || mode === 'propose-only') {
      this.awaitingApproval.push(proposal);
      return {
        route: 'human-approval',
        applied: false,
        reason: `Mode ${mode} prohibits auto-apply`,
      };
    }
    const { kind, payload } = proposal;
    if (
      kind === 'focus-weight' &&
      actuators.applyFocusWeight &&
      typeof payload['focusId'] === 'string' &&
      typeof payload['weight'] === 'number'
    ) {
      actuators.applyFocusWeight(payload['focusId'] as string, payload['weight'] as number);
      return { route: 'auto-apply', applied: true, reason: 'Low-risk focus-weight auto-applied' };
    }
    if (kind === 'strategy-switch' && mode !== 'sandbox-execute') {
      return {
        route: 'auto-apply',
        applied: false,
        reason: 'No actuator registered for strategy-switch; held as approved-pending',
      };
    }
    this.awaitingApproval.push(proposal);
    return {
      route: 'human-approval',
      applied: false,
      reason: `No actuator for low-risk ${kind}; queued for review`,
    };
  }

  getAwaitingValidation(): ReadonlyArray<SelfImprovementProposal> {
    return this.awaitingValidation;
  }

  getAwaitingApproval(): ReadonlyArray<SelfImprovementProposal> {
    return this.awaitingApproval;
  }

  /** D14: consume held validation proposals — nothing queues forever. Each is
   *  re-routed (with the supplied validator/actuators) and removed from the queue. */
  drainAwaitingValidation(
    actuators: ProposalActuators = {},
    validator?: SandboxValidator
  ): Array<{ proposal: SelfImprovementProposal; route: ProposalRoute; applied: boolean; reason: string }> {
    const held = this.awaitingValidation.splice(0);
    return held.map((proposal) => ({
      proposal,
      ...this.route(proposal, 'low-risk-auto-merge', actuators, validator),
    }));
  }

  /** D14: consume held approval proposals (callers apply their own human-review flow). */
  drainAwaitingApproval(): SelfImprovementProposal[] {
    return this.awaitingApproval.splice(0);
  }
}

export class GovernancePolicyEngine {
  decide(risk: RiskAssessment, mode: AutonomyMode): GovernanceDecision {
    if (risk.risk === 'HIGH')
      return {
        action: 'REQUIRE_HUMAN_REVIEW',
        reason: 'HIGH risk requires human review',
        reviewers: 2,
      };
    switch (mode) {
      case 'observe-only':
      case 'propose-only':
      case 'sandbox-execute':
        return {
          action: 'REQUIRE_HUMAN_REVIEW',
          reason: `Mode ${mode} prohibits auto-merge`,
          reviewers: 1,
        };
      case 'low-risk-auto-merge':
        return risk.risk === 'LOW'
          ? { action: 'AUTO_MERGE', reason: 'LOW risk + auto-merge mode' }
          : { action: 'CREATE_PR', reason: 'MEDIUM risk requires review', reviewers: 1 };
      case 'human-approved-production':
        return {
          action: 'REQUIRE_HUMAN_REVIEW',
          reason: 'Production mode requires human approval',
          reviewers: 1,
        };
    }
  }

  record(
    proposal: PatchProposal,
    assessment: RiskAssessment,
    decision: GovernanceDecision,
    mode: AutonomyMode
  ): GovernanceEvent {
    return {
      eventId: uuidv4(),
      proposalId: proposal.proposalId,
      decision:
        decision.action === 'AUTO_MERGE'
          ? 'AUTO_MERGED'
          : decision.action === 'CREATE_PR'
            ? 'PR_CREATED'
            : 'HUMAN_REVIEW_REQUIRED',
      riskLevel: assessment.risk,
      autonomyMode: mode,
      decidedAt: Date.now(),
      decidedBy: 'governance-runner',
    };
  }
}
