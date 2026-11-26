/** Show dispatcher routing decision for a task: .route <task> [--verbose] */

import { createSystemOneBudget, specToQuery, HEAD_SPECS, rubricOf, type ScoreDistribution } from '@senars/lm/system-one';
import { attempted, cmd } from '@senars/cli';
import { flagsOf } from '../args';
import type { BotRuntime } from '../context';

export const routeCommand = cmd(
  'route',
  'Show dispatcher routing decision for a task: .route <task> [--verbose]',
  (rt: BotRuntime) => async (args = '') => {
    const dispatcher = rt.wired.nar.getSystemOneDispatcher?.();
    const embeddingCache = rt.wired.nar.getSystemOneEmbeddingCache?.();
    if (!dispatcher || !embeddingCache) return 'System One dispatcher not available';
    const { positional, has } = flagsOf(args);
    const verbose = has('--verbose');
    const task = positional.join(' ');
    if (!task) return 'Usage: .route <task> [--verbose]';
    const budget = createSystemOneBudget();
    // From the specs, not beside them: the injection query the ingress gate fails
    // closed on is the spec's, and the hand-written copy left off the `critical`
    // criticality that makes it a safety-floor query at all.
    const queries = [
      specToQuery({ ...HEAD_SPECS.task_type, space: ['question', 'belief', 'goal', 'tool'] }),
      specToQuery(HEAD_SPECS.injection),
      specToQuery(HEAD_SPECS.ambiguity),
    ];
    return attempted('route', async () => {
      const results = await dispatcher.judge(await embeddingCache.write(task), queries, budget);
      const lines = ['Routing decision for:', `  "${task}"`, ''];
      for (const [i, r] of results.entries()) {
        const q = queries[i];
        if (!q) continue;
        if (r.kind === 'classify') {
          const cp = r as {
            kind: 'classify';
            top: ScoreDistribution;
            entropy: number;
            tier: number;
          };
          lines.push(
            `  ${rubricOf(q)}: ${cp.top.option} (p=${cp.top.p.toFixed(3)})${verbose ? ` entropy=${cp.entropy.toFixed(3)} tier=${cp.tier}` : ''}`
          );
        } else {
          const ep = r as {
            kind: 'evaluate';
            score: number;
            abstained: boolean;
            tier: number;
            latencyMs: number;
          };
          lines.push(
            `  ${rubricOf(q)}: score=${ep.score.toFixed(3)} abstained=${ep.abstained}${verbose ? ` tier=${ep.tier} latency=${ep.latencyMs}ms` : ''}`
          );
        }
      }
      lines.push(
        '',
        `Path: ${results.some((r) => r.tier === 1) ? 'tier1 (manifold)' : 'tier0 (deterministic)'}`
      );
      return lines.join('\n');
    });
  }
);