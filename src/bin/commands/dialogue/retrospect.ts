/** Run a retrospective */

import { cmd } from '@senars/cli';
import { unique } from '@senars/util/collections';
import { runSessionRetrospective } from './retrospective';
import type { BotRuntime } from '../context';

export const retrospectCommand = cmd(
  'retrospect',
  'Run a retrospective: [session-id]',
  (rt: BotRuntime) => async (args = '') => {
    const explicit = args.trim();
    const sid =
      explicit ||
      unique(
        (await rt.wired.episodicMemory.getEpisodes({ type: 'dialogue', limit: 500 })).map(
          (e) => (e.metadata as { sessionId?: string }).sessionId
        )
      ).at(-1);
    if (!sid) return 'No captured sessions.';
    return runSessionRetrospective(rt, sid);
  }
);