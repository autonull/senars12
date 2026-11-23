/** Show curriculum probes selected from flywheel-graded data */

import { cmd } from '../cli';
import { systemOneOf } from '../context';
import type { BotRuntime } from '../context';

export const probesCommand = cmd(
  'probes',
  'Show curriculum probes selected from flywheel-graded data (corrections + low grades)',
  (rt: BotRuntime) => async () => {
    const { selectProbes } = await import('../../dialogue/index');
    const probes = await selectProbes(
      {
        reactions: () => rt.wired.episodicMemory.getEpisodes({ type: 'reaction', limit: 1000 }),
        grades: () => systemOneOf(rt)?.traceGradeHistory ?? new Map<string, number>(),
      },
      // The curriculum trains on the least-reliable sources first.
      {
        sourceReputation: {
          multiplier: (key) => rt.wired.nar.getSourceReputation?.()?.multiplier(key) ?? 1,
        },
      }
    );
    if (probes.length === 0) return 'No probes yet (requires corrected or low-graded turns).';
    return probes.map((p) => `  ${p.kind} ${p.id} score=${p.score.toFixed(2)}`).join('\n');
  }
);