/** Run manifold heads on a proposition: .judge <proposition> [--head <rubric>] [--explain] */

import { asRubricId } from '@senars/decision';
import { createSystemOneBudget, evaluateQuery } from '@senars/lm/system-one';
import { attempted, cmd } from '@senars/cli';
import { flagsOf } from '../args';
import type { BotRuntime } from '../context';

export const judgeCommand = cmd(
  'judge',
  'Run manifold heads on a proposition: .judge <proposition> [--head <rubric>] [--explain]',
  (rt: BotRuntime) => async (args = '') => {
    const decider = rt.wired.nar.getSystemOneDecider?.();
    if (!decider) return 'System One decider not available';
    const { positional, str, has } = flagsOf(args);
    const proposition = positional.join(' ');
    if (!proposition) return 'Usage: .judge <proposition> [--head <rubric>] [--explain]';
    const named = str('--head', '');
    const rubric = named ? asRubricId(named) : undefined;
    if (named && !rubric) return `Unknown head: ${named}`;
    const queries = rubric
      ? [evaluateQuery(rubric)]
      : (['groundedness', 'plausibility', 'assertion'] as const).map((id) => evaluateQuery(id));
    return attempted('judge', async () => {
      const result = await decider.decide({
        context: proposition,
        queries,
        budget: createSystemOneBudget(),
      });
      const lines = result.verdicts.map((v) => {
        const r = v.proposition;
        if (!r || r.kind === 'classify') {
          const top = r && r.kind === 'classify' ? r.top : undefined;
          return `${v.query.rubric}: top=${top?.option ?? '—'} p=${top?.p.toFixed(3) ?? '—'} abstained=${v.abstained} band=${v.band}${v.skipped ? ' skipped' : ''}`;
        }
        return `${v.query.rubric}: score=${r.score.toFixed(3)} abstained=${r.abstained} latency=${r.latencyMs}ms band=${v.band}${v.skipped ? ' skipped' : ''}`;
      });
      lines.push(
        `band=${result.band} composite=${result.composite?.score.toFixed(3) ?? '—'} contrastive=${result.contrastive.score?.toFixed(3) ?? '—'}`
      );
      if (has('--explain')) {
        const p = result.provenance;
        lines.push(
          `provenance: model=${p.modelDigest ?? '—'} calibration=${p.calibrationDigest ?? '—'} input=${p.inputDigest.slice(0, 12)} fitted=${p.fitted} abstained=${p.abstained} at=${new Date(p.timestamp).toISOString()}`
        );
      }
      return lines.join('\n');
    });
  }
);