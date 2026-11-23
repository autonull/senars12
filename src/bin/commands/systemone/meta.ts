/** Self-meta-game: .meta status|drives|proposals|propose <type> [args...] */

import { cmd, dispatchSub } from '../cli';
import type { SelfMetaView } from './types';
import type { BotRuntime } from '../context';

export const metaCommand = cmd(
  'meta',
  'Self-meta-game: .meta status|drives|proposals|propose <type> [args...]',
  (rt: BotRuntime) => (args = '') => {
    const metaGame = rt.wired.nar.getSelfMetaGame?.() as unknown as SelfMetaView | undefined;
    if (!metaGame)
      return 'Self-meta-game not available (requires System One with self enabled)';
    const usage = 'Usage: .meta status|drives|proposals|propose <type> [args...]';
    return dispatchSub(
      args,
      {
        status: () => {
          const queues = metaGame.getGovernanceQueues?.() ?? { validation: 0, approval: 0 };
          const observes = metaGame.observesFocuses ?? [];
          const knobs = metaGame.getAllKnobs?.() ?? new Map<string, unknown>();
          return [
            'Self-Meta-Game:',
            `  ID: ${metaGame.id}`,
            `  Cycle: ${metaGame.cycle ?? 0}`,
            `  Observed focuses: ${observes.length ? observes.join(', ') : '(none)'}`,
            `  Governance queues: validation=${queues.validation} approval=${queues.approval}`,
            `  Knobs: ${knobs.size ? [...knobs.entries()].map(([k, v]) => `${k}=${v}`).join(', ') : '(none)'}`,
          ].join('\n');
        },
        drives: () =>
          metaGame.scheduler
            ? 'Drives: test_failed, contradiction_detected, low_coverage (use .drive stimulate <name>)'
            : 'No scheduler attached (drives require scheduler)',
        proposals: () => {
          // The proposal router is private; queue depths already surface the depth.
          const queues = metaGame.getGovernanceQueues?.() ?? { validation: 0, approval: 0 };
          const total = queues.validation + queues.approval;
          return total === 0
            ? 'No pending proposals'
            : `${total} pending proposal(s): validation=${queues.validation} approval=${queues.approval}`;
        },
        propose: ([type, ...rest]) => {
          if (!type) return 'Usage: .meta propose <type> [args...]';
          const result = metaGame.applyProposal?.({
            kind: type,
            riskTier: 'low',
            payload: { args: rest },
            correlationId: `manual-${Date.now()}`,
          }) ?? { applied: false, reason: 'applyProposal not available' };
          return result.applied
            ? `Proposal applied: ${result.reason}`
            : `Proposal rejected: ${result.reason}`;
        },
      },
      { defaults: ['status'], usage }
    );
  }
);