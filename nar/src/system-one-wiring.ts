/**
 * System One wiring — the perception half of NAR construction.
 *
 * It is here rather than in the constructor because it is the one subsystem
 * with a genuine seam: System One is optional, and when it is off the perception
 * config is `undefined`, which is a different shape rather than a smaller one.
 * Building it and deciding whether the gate registry gets a judge are the same
 * question, and they belong in one function.
 *
 * `reputation` and `provider` are lazy ports: both are attached after
 * construction (`setSourceReputation`) or may never be, and the judge must read
 * whatever is current when it runs rather than what existed at build time.
 */

import { systemOneDefaults } from '@senars/util/config';
import { createSystemOneBudget } from './lm/system-one/types.js';
import { SystemOneIngressJudge } from './lm/system-one/ingress-judge.js';
import type { JudgmentProposition, JudgmentQuery } from './lm/system-one/types.js';
import { SystemOneRuntime } from './facade/system-one.js';
import type { NARConfig } from './facade/config.js';
import type { SourceReputation } from './kernel/source-reputation.js';
import type { LMService } from './lm/lm-service.js';

export interface SystemOneWiringDeps {
  readonly config: NARConfig;
  readonly lmService: LMService | undefined;
  readonly onJudgmentResolved: (proposition: JudgmentProposition, query: JudgmentQuery) => void;
  /** Read at judge time, not at build time — attached after construction. */
  readonly reputation: () => SourceReputation | undefined;
}

export interface SystemOneWiring {
  readonly systemOne: SystemOneRuntime;
  /** `undefined` when System One is off: the gate registry then has no judge. */
  readonly perceptionConfig: ReturnType<typeof buildPerceptionConfig> | undefined;
}

export function wireSystemOne(deps: SystemOneWiringDeps): SystemOneWiring {
  const { config, lmService, onJudgmentResolved, reputation } = deps;

  const systemOne = new SystemOneRuntime(config, { lmService, onJudgmentResolved });

  if (!config.systemOne?.enabled) return { systemOne, perceptionConfig: undefined };

  const manifold = systemOne.manifold;
  const embeddingCache = systemOne.embeddingCache;
  return {
    systemOne,
    perceptionConfig: {
      systemOne: {
        enabled: true,
        judgeTimeoutMs: config.systemOne.judgeTimeoutMs ?? systemOneDefaults.judgeTimeoutMs,
        judge: new SystemOneIngressJudge({
          manifold: manifold as NonNullable<typeof manifold>,
          embeddingCache: embeddingCache as NonNullable<typeof embeddingCache>,
          budget: config.systemOne.reasoningBudget ?? createSystemOneBudget(),
          reputation,
          provider: () => lmService?.provider,
        }),
      },
    },
  };
}

function buildPerceptionConfig(judge: SystemOneIngressJudge, judgeTimeoutMs: number) {
  return { systemOne: { enabled: true as const, judge, judgeTimeoutMs } };
}
