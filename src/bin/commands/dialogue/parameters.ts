/** Show the parameter change ledger */

import { cmd } from '@senars/cli';
import { OutcomeLinker } from '@senars/config';
import { episodeQualitySurface } from '@senars/query';
import type { BotRuntime } from '../context';

export const parametersCommand = cmd(
  'parameters',
  'Show the parameter change ledger: [improved]',
  (rt: BotRuntime) => async (args = '') => {
    const { memoryQuery, wired } = rt;
    const { parameterLedger } = rt;
    if (!parameterLedger) return 'Parameter ledger not attached.';
    if (args.trim() === 'improved') {
      const [turnResults, reactions] = await Promise.all([
        memoryQuery.search({ episodeType: 'dialogue', limit: 500 }).catch(() => []),
        wired.episodicMemory.getEpisodes({ type: 'reaction', limit: 500 }),
      ]);
      const samples = episodeQualitySurface([
        ...turnResults.flatMap((r) => (r.episode ? [r.episode] : [])),
        ...reactions,
      ]);
      const improved = await new OutcomeLinker(parameterLedger, () => samples).improvedOnly({
        windowMs: 120_000,
      });
      if (improved.length === 0) return 'No improvement-evidenced parameter changes.';
      return improved
        .map(
          (i) =>
            `  ${i.parameter} ${i.oldValue}→${i.newValue} quality ${i.before.toFixed(2)}→${i.after.toFixed(2)}`
        )
        .join('\n');
    }
    const records = parameterLedger.query().slice(-20);
    if (records.length === 0) return 'No parameter changes recorded.';
    return records
      .map(
        (r) =>
          `  [${new Date(r.at).toLocaleTimeString()}] ${r.writer}/${r.scope} ${r.parameter} ${r.oldValue}→${r.newValue}${r.trigger ? ` (${r.trigger.slice(0, 12)})` : ''}`
      )
      .join('\n');
  }
);