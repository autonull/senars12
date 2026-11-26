/** List past retrospectives */

import { cmd } from '@senars/cli';
import { finiteOr } from '@senars/util/numeric';
import type { BotRuntime } from '../context';

export const retrospectivesCommand = cmd(
  'retrospectives',
  'List past retrospectives: [n]',
  (rt: BotRuntime) => async (args = '') => {
    const { loadRetrospectives } = await import('../../dialogue/index');
    const limit = finiteOr(args.trim(), 10);
    const rs = await loadRetrospectives(limit);
    if (rs.length === 0) return 'No retrospectives.';
    return rs
      .map(
        (r) =>
          `  ${r.sessionId} turns=${r.turnCount} reactions=${r.reactionCount} digest=${r.digest.slice(0, 19)}`
      )
      .join('\n');
  }
);