/** System One status / subcommands: heads|dispatcher|cortex|reflexes|eval-set */

import { attempted, cmd, type SubHandler, dispatchSub } from '../cli';
import type { BotRuntime } from '../context';
import {
  formatSystemOneCortex,
  formatSystemOneDispatcher,
  formatSystemOneHeads,
  formatSystemOneReflexes,
  formatSystemOneStatus,
} from '@senars/cli/systemone-format';
import {
  createFrozenEvalSet,
  evalMetrics,
  headMetrics,
  loadEvalSet,
  writeEvalSet,
  JudgmentDataset,
} from '@senars/lm/system-one';
import { EVAL_SET_PATH, datasetPathOf } from './constants';

const statusHandlers: Record<string, SubHandler> = {
  status: (rt: BotRuntime) => formatSystemOneStatus(rt.wired.nar, rt.conversationGame),
  heads: (rt: BotRuntime) => formatSystemOneHeads(rt.wired.nar),
  dispatcher: (rt: BotRuntime) => formatSystemOneDispatcher(rt.wired.nar),
  cortex: (rt: BotRuntime) => formatSystemOneCortex(rt.wired.nar),
  reflexes: (rt: BotRuntime) => formatSystemOneReflexes(rt.wired.nar),
  'eval-set': async (rt: BotRuntime, [action]) => {
    if (action === 'create' || action === 'regenerate') {
      const set = createFrozenEvalSet(await JudgmentDataset.load(datasetPathOf(rt)));
      await writeEvalSet(set, EVAL_SET_PATH);
      const m = evalMetrics(set.rows);
      return `Eval set frozen: ${set.rows.length} rows (conversation-captured excluded) → ${EVAL_SET_PATH}\ndigest=${set.digest}\nbrier=${m.brier.toFixed(4)} ece=${m.ece.toFixed(4)}`;
    }
    if (action === 'show') {
      return attempted(
        'eval-set load failed (run .systemone eval-set create)',
        async () => {
          const set = await loadEvalSet(EVAL_SET_PATH);
          const lines = [
            `Eval set: ${set.rows.length} rows, digest=${set.digest}`,
            `frozen at ${new Date(set.createdAt).toISOString()}`,
            ...Object.entries(headMetrics(set.rows)).map(
              ([head, m]) =>
                `  ${head}: n=${m.count} brier=${m.brier.toFixed(4)} ece=${m.ece.toFixed(4)}`
            ),
          ];
          return lines.join('\n');
        }
      );
    }
    return 'Usage: .systemone eval-set create|show|regenerate (regenerate is explicit + logged)';
  },
};

export const systemoneCommand = cmd(
  'systemone',
  'System One status / subcommands: heads|dispatcher|cortex|reflexes|eval-set',
  (rt: BotRuntime) => {
    const { nar } = rt.wired;
    if (!nar.isSystemOneEnabled?.()) {
      return () => 'System One: disabled (enable via config systemOne.enabled + restart)';
    }
    return (args = '') => {
      const { nar } = rt.wired;
      if (!nar.isSystemOneEnabled?.()) {
        return 'System One: disabled (enable via config systemOne.enabled + restart)';
      }
      return dispatchSub(
        args,
        statusHandlers,
        {
          defaults: ['status'],
          usage: 'Usage: .systemone heads|dispatcher|cortex|reflexes|eval-set',
        }
      );
    };
  }
);