/** Show captured dialogue turns */

import { cmd } from '@senars/cli';
import { tokenize } from '../args';
import { finiteOr } from '@senars/util/numeric';
import { unique } from '@senars/util/collections';
import type { BotRuntime } from '../context';

export const turnsCommand = cmd(
  'turns',
  'Show captured dialogue turns: [session-id] [n]',
  (rt: BotRuntime) => async (args = '') => {
    const [sid, nRaw] = tokenize(args);
    const limit = finiteOr(nRaw, 10);
    const episodes = await rt.wired.episodicMemory.getEpisodes({ type: 'dialogue', limit: 500 });
    const sessionIds = new Set(
      episodes.map((e) => (e.metadata as { sessionId?: string }).sessionId)
    );
    const target = sid ?? unique(sessionIds).at(-1);
    const rows = episodes
      .filter((e) => (e.metadata as { sessionId?: string }).sessionId === target)
      .slice(-limit);
    if (rows.length === 0) {
      return target ? `No turns for session ${target}` : 'No captured turns.';
    }
    return rows
      .map((e) => {
        const d = JSON.parse(e.content) as {
          turnId: string;
          seq: number;
          grounding?: { score: number };
          responseDigest?: string;
        };
        const ground = d.grounding ? ` ground=${d.grounding.score.toFixed(2)}` : '';
        return `  ${d.turnId} seq=${d.seq}${ground} resp=${d.responseDigest?.slice(0, 19) ?? '—'}`;
      })
      .join('\n');
  }
);