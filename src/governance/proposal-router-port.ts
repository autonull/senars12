/**
 * ProposalRouter port — the subset of ProposalRouter that SelfMetaGameImpl needs.
 * Extracted to break SelfMetaGame.ts <-> governance/pipeline.ts cycle.
 */

import type { AutonomyMode } from '@senars/core/schemas';

export interface ProposalActuators {
  applyFocusWeight?: (focusId: string, weight: number) => void;
  applyKnob?: (knob: string, value: number) => void;
}

export type ProposalRoute = 'auto-apply' | 'sandbox-validate' | 'human-approval';

export interface ProposalRouterPort {
  route(
    proposal: {
      kind: string;
      riskTier: string;
      payload: Record<string, unknown>;
    },
    mode: AutonomyMode,
    actuators?: ProposalActuators
  ): { route: ProposalRoute; applied: boolean; reason: string };

  getAwaitingValidation(): ReadonlyArray<{
    kind: string;
    riskTier: string;
    payload: Record<string, unknown>;
  }>;

  getAwaitingApproval(): ReadonlyArray<{
    kind: string;
    riskTier: string;
    payload: Record<string, unknown>;
  }>;
}

/** Default no-op implementation for when governance is not wired. */
export class NoopProposalRouter implements ProposalRouterPort {
  route(): { route: ProposalRoute; applied: boolean; reason: string } {
    return { route: 'human-approval', applied: false, reason: 'Governance not configured' };
  }
  getAwaitingValidation(): ReadonlyArray<never> { return []; }
  getAwaitingApproval(): ReadonlyArray<never> { return []; }
}