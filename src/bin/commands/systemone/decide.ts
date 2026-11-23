/** Unified decision (heads + contrastive + router): .decide <input> [--rubrics a,b,c] */

import { asRubricId, DEFAULT_DECIDE_RUBRICS } from './constants';
import { createSystemOneBudget, evaluateQuery } from '@senars/lm/system-one';
import { attempted, cmd, flagsOf } from '../cli';
import type { BotRuntime } from '../context';

export const decideCommand = cmd(
  'decide',
  'Unified decision (heads + contrastive + router): .decide <input> [--rubrics a,b,c]',
  (rt: BotRuntime) => async (args = '') => {
    const decider = rt.wired.nar.getSystemOneDecider?.();
    if (!decider) return 'System One decider not available';
    const { positional, list } = flagsOf(args);
    const input = positional.join(' ');
    if (!input) return 'Usage: .decide <input> [--rubrics a,b,c]';
    const named = flagsOf(args).has('--rubrics') ? list('--rubrics', []) : [];
    const rubrics = (named.length > 0 ? named : DEFAULT_DECIDE_RUBRICS).map((name) =>
      asRubricId(name)
    );
    const unknown = rubrics.filter((id) => id === undefined).map((_, i) => named[i]);
    if (unknown.length > 0) return `Unknown head(s): ${unknown.join(', ')}`;
    return attempted('decide', async () => {
      const result = await decider.decide({
        context: input,
        queries: rubrics.map((rubric) => evaluateQuery(rubric!)),
        budget: createSystemOneBudget(),
      });
      const lines = result.verdicts.map(
        (v) =>
          `  ${v.query.rubric}: ${(v.proposition as { score?: number })?.score?.toFixed(3) ?? '—'} band=${v.band} abstained=${v.abstained}${v.skipped ? ' skipped' : ''}`
      );
      lines.push(
        `  band=${result.band} composite=${result.composite?.score.toFixed(3) ?? '—'} contrastive=${result.contrastive.score?.toFixed(3) ?? '—'} penalty=${result.contrastive.penalty?.toFixed(3) ?? '—'}`
      );
      const p = result.provenance;
      lines.push(
        `  provenance: model=${p.modelDigest ?? '—'} calibration=${p.calibrationDigest ?? '—'} input=${p.inputDigest.slice(0, 12)} at=${new Date(p.timestamp).toISOString()}`
      );
      return `Decision for: "${input}"\n${lines.join('\n')}`;
    });
  }
);