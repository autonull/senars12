/**
 * ProposalRouter — routes self-improvement proposals through validation/approval.
 * Extracted to break SelfMetaGame.ts <-> governance/pipeline.ts cycle.
 */

import type {
  AutonomyMode,
  GovernanceDecision,
  GovernanceEvent,
  PatchProposal,
  RiskAssessment,
  SelfImprovementProposal,
} from '@senars/schemas';
import { permitsExecution, riskLevelOf } from '@senars/schemas';
import { makeId } from '@senars/util/id';

export interface ProposalActuators {
  applyFocusWeight?: (focusId: string, weight: number) => void;
  applyKnob?: (name: string, value: number) => void;
  applySchemaPatch?: (patch: string) => void;
}

export interface SandboxValidator {
  validate(proposal: SelfImprovementProposal): { approved: boolean; reason: string } | null;
}

export type ProposalRoute = 'auto-apply' | 'sandbox-validate' | 'human-approval';

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
      const executable = permitsExecution(mode);
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
    if (!permitsExecution(mode)) {
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
    if (kind === 'metta-rule-adoption' && actuators.applySchemaPatch) {
      actuators.applySchemaPatch(payload['mettaProgram'] as string);
      return { route: 'auto-apply', applied: true, reason: 'Low-risk metta-rule-adoption auto-applied' };
    }
    return {
      route: 'auto-apply',
      applied: false,
      reason: `No actuator for ${kind}; held as approved-pending`,
    };
  }

  getAwaitingValidation(): ReadonlyArray<SelfImprovementProposal> {
    return this.awaitingValidation;
  }

  getAwaitingApproval(): ReadonlyArray<SelfImprovementProposal> {
    return this.awaitingApproval;
  }

  clear(): void {
    this.awaitingValidation = [];
    this.awaitingApproval = [];
  }
}