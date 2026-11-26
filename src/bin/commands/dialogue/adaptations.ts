/** Show retrospective-driven strategy adaptations */

import { cmd } from '@senars/cli';
import type { BotRuntime } from '../context';

export const adaptationsCommand = cmd(
  'adaptations',
  'Show retrospective-driven strategy adaptations: [.restore]',
  (rt: BotRuntime) => async (args = '') => {
    const { strategyAdapter } = rt;
    if (!strategyAdapter) return 'Strategy adaptation unavailable (no kernel controller).';
    if (args.trim() === 'restore') {
      return strategyAdapter.restore()
        ? 'Restored pre-adaptation strategies.'
        : 'Nothing to restore.';
    }
    const ledger = strategyAdapter.ledger;
    if (ledger.length === 0) {
      return 'No adaptations yet (correction-dominated retrospectives drive them).';
    }
    return ledger
      .map(
        (a) =>
          `  ${a.at ? new Date(a.at).toISOString() : ''} ${a.retrospectiveDigest.slice(0, 19)} ${Object.entries(
            a.to
          )
            .map(([k, v]) => `${k}→${v}`)
            .join(', ')}`
      )
      .join('\n');
  }
);