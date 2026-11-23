/** Shared types for System One commands. */

import type { ReflexView } from '@senars/cli/conversation-game';

/** The self-meta-game surface the `.meta` and `.drive` commands read. */
export interface SelfMetaView {
  readonly id: string;
  readonly cycle?: number;
  readonly observesFocuses?: string[];
  readonly scheduler?: DriveScheduler;
  getGovernanceQueues?(): { validation: number; approval: number };
  getAllKnobs?(): Map<string, unknown>;
  applyProposal?(p: { kind: string; riskTier: string; payload: unknown; correlationId?: string }): {
    applied: boolean;
    reason: string;
  };
}

/** Drive stimulation is routed through the reward gate, never applied directly. */
export interface DriveScheduler {
  readonly rewardGate: {
    process(event: Record<string, unknown>): { accepted: boolean; rejectionReason?: string };
  };
}

/** One toggle verb over one bound reflex, with per-verb missing-attachment messages. */
export type ToggleReflexSpec = {
  id: string;
  label: string;
  verb: string;
  onMissing: string;
  offMissing: string;
};

import type { SubHandler } from '../args';

export const makeToggleReflex = (
  reflexes: readonly ReflexView[],
  disable: (id: string) => void,
  spec: ToggleReflexSpec
): SubHandler =>
  ([state]) => {
    const attached = reflexes.some((r) => r.id === spec.id);
    if (state === 'on') return attached ? `${spec.label} already active` : spec.onMissing;
    if (state === 'off') {
      if (!attached) return spec.offMissing;
      disable(spec.id);
      return `${spec.label} disabled`;
    }
    return `Usage: .reflex ${spec.verb} on|off`;
  };