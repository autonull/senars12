import type { Term } from '../../terms';
import { Truth, termParser } from '../../terms';
import type { Budget, Task, TruthType } from '../../types';
import { createTask, createTimestamp } from '../../types/core.js';
import type { CognitiveDispatcher, EvaluateQuery, JudgmentProposition } from './types.js';

export interface SystemOneLMRuleAdapterConfig {
  dispatcher: CognitiveDispatcher;
  nar: {
    getCycleCount: () => number;
    getSystemOneEmbeddingCache: () => any;
    getSystemOneManifold: () => any;
  };
  logger?: { debug?: (msg: string, meta?: any) => void; warn?: (msg: string, meta?: any) => void };
}

export class SystemOneLMRuleAdapter {
  readonly #dispatcher: CognitiveDispatcher;
  readonly #nar: SystemOneLMRuleAdapterConfig['nar'];
  readonly #logger: SystemOneLMRuleAdapterConfig['logger'];

  constructor(config: SystemOneLMRuleAdapterConfig) {
    this.#dispatcher = config.dispatcher;
    this.#nar = config.nar;
    this.#logger = config.logger;
  }

  async translateToNarsese(input: string, context?: Record<string, unknown>): Promise<Task[]> {
    try {
      const cycleCount = this.#nar.getCycleCount();
      const cognitiveContext = {
        tickId: `cycle-${cycleCount}`,
        topBeliefs: [input],
        topGoals: (context?.activeGoals as string[]) ?? [],
        workingMemory: (context?.recentDerivations as string[]) ?? [],
      };

      const synthesisQuery = {
        kind: 'synthesize' as const,
        instruction: `Translate to Narsese: ${input}`,
        grammar: 'narsese-term',
        maxCandidates: 3,
      };

      const judgmentQueries = [
        {
          kind: 'classify' as const,
          instruction: 'Select best Narsese candidate',
          space: [],
          axis: 'teleological' as const,
          criticality: 'standard' as const,
        },
        {
          kind: 'evaluate' as const,
          instruction: 'Evaluate conflict with current beliefs',
          rubric: 'conflict' as const,
          axis: 'epistemic' as const,
          criticality: 'standard' as const,
        },
      ];

      const budget = this.#budget();

      const peaResult = await this.#dispatcher.proposeAndJudge(
        cognitiveContext,
        synthesisQuery,
        judgmentQueries,
        budget
      );

      const tasks: Task[] = [];
      for (const admitted of peaResult.admitted) {
        const parsed = termParser.parse(admitted.candidate);
        if (parsed) {
          const taskBudget: Budget = {
            priority: admitted.truth.c,
            durability: 0.8,
            quality: 0.9,
            cycles: 10,
            depth: 5,
          };
          tasks.push({
            term: parsed,
            type: 'belief',
            truth: admitted.truth as TruthType,
            budget: taskBudget,
            stamp: admitted.stamp,
            occurrenceTime: createTimestamp(),
            derived: false,
          });
        }
      }

      this.#logger?.debug?.('System One translation', {
        candidates: peaResult.candidates.length,
        admitted: tasks.length,
      });
      return tasks;
    } catch (e) {
      this.#logger?.warn?.('System One translation failed', { error: e });
      return [];
    }
  }

  #budget(): import('@senars/kernel/schemas').ReasoningBudget {
    return {
      maxCycles: 100,
      maxDepth: 10,
      maxMemoryOps: 1000,
      maxLMCalls: 5,
      consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
    };
  }

  /**
   * REPLACE disposition (TODO16 §8, lm-meta-reasoning): continuous manifold
   * scoring over derivation traces. The top-ranked traces are re-admitted as
   * guidance beliefs; no generative LM call is made. Returns [] when there are
   * no traces to score (caller degrades silently — the symbolic fallback for
   * this rule is removed).
   */
  async metaReason(_primary: Term, context?: Record<string, unknown>): Promise<Task[]> {
    try {
      const traces = (context?.recentDerivations as string[]) ?? [];
      const manifold = this.#nar.getSystemOneManifold();
      const cache = this.#nar.getSystemOneEmbeddingCache();
      if (traces.length === 0 || !manifold || !cache) return [];

      const scores: { trace: string; score: number }[] = [];
      for (const trace of traces) {
        const pointer = await cache.write(trace);
        const props: JudgmentProposition[] = await manifold.judgeBatch(
          pointer,
          [
            {
              kind: 'evaluate',
              instruction: 'Evaluate conflict of derivation trace with current beliefs',
              rubric: 'conflict',
              axis: 'epistemic',
              criticality: 'standard',
            },
            {
              kind: 'evaluate',
              instruction: 'Evaluate novelty of derivation trace',
              rubric: 'novelty',
              axis: 'epistemic',
              criticality: 'low',
            },
          ],
          this.#budget()
        );
        if (props.some((p) => p.abstained) || props.length < 2) continue;
        const conflictScore = props[0]?.kind === 'evaluate' ? props[0].score : 0.5;
        const noveltyScore = props[1]?.kind === 'evaluate' ? props[1].score : 0.5;
        scores.push({ trace, score: noveltyScore - conflictScore });
      }
      scores.sort((a, b) => b.score - a.score);

      const tasks: Task[] = [];
      for (const { trace, score } of scores.slice(0, 2)) {
        const term = termParser.parse(trace);
        if (!term) continue;
        tasks.push(
          createTask(
            term,
            'belief',
            Truth.create(Math.min(0.9, Math.max(0.5, 0.5 + score / 2)), 0.7),
            {
              priority: Math.min(1, Math.max(0, score)),
              durability: 0.7,
              quality: 0.8,
              cycles: 10,
              depth: 5,
            }
          )
        );
      }
      this.#logger?.debug?.('System One meta-reasoning', {
        traces: traces.length,
        guided: tasks.length,
      });
      return tasks;
    } catch (e) {
      this.#logger?.warn?.('System One meta-reasoning failed', { error: e });
      return [];
    }
  }

  /**
   * REPLACE disposition (TODO16 §8, lm-uncertainty-calibration): recalibrate a
   * belief's confidence through the fitted isotonic calibrators + drift
   * monitor. No generative call — always returns exactly one recalibrated
   * task; identity when no calibrator is fitted (calibration honesty, B5).
   */
  async calibrateUncertainty(primary: Term, context?: Record<string, unknown>): Promise<Task[]> {
    const truth = context?.truth as { f?: number; c?: number } | undefined;
    const f = truth?.f ?? 0.5;
    const c = truth?.c ?? 0.5;
    try {
      const manifold = this.#nar.getSystemOneManifold();
      const fitted = manifold
        ? [...manifold.getCalibrators().values()].filter((cal) => cal.fitted)
        : [];
      const best = fitted.sort((a, b) => a.getECE() - b.getECE())[0];
      let cPrime = best ? best.calibrate(c) : c;
      if (manifold && !manifold.health().ready) cPrime *= 0.8; // drift demotion
      const calibrated = Truth.create(f, Math.min(0.99, Math.max(0.01, cPrime)));
      return [
        createTask(primary, 'belief', calibrated, {
          priority: cPrime,
          durability: 0.7,
          quality: 0.8,
          cycles: 10,
          depth: 5,
        }),
      ];
    } catch (e) {
      this.#logger?.warn?.('System One uncertainty calibration failed', { error: e });
      return [createTask(primary, 'belief', Truth.create(f, c))];
    }
  }

  /** F5: conflict-head verdict on a candidate derivation (ShadowValidator consumer). */
  async conflictScore(
    candidateTerm: string
  ): Promise<{ score: number; fitted: boolean; abstained: boolean } | null> {
    try {
      const manifold = this.#nar.getSystemOneManifold();
      const cache = this.#nar.getSystemOneEmbeddingCache();
      if (!manifold || !cache) return null;
      const sharedContext = await cache.write(candidateTerm);
      const query: EvaluateQuery = {
        kind: 'evaluate',
        instruction: 'Evaluate conflict of candidate with current beliefs',
        rubric: 'conflict',
        axis: 'epistemic',
        criticality: 'standard',
      };
      const propositions = await manifold.judgeBatch(sharedContext, [query], this.#budget());
      const prop = propositions[0];
      if (prop?.kind !== 'evaluate') return null;
      return {
        score: prop.score,
        fitted: prop.calibration.fitted === true,
        abstained: prop.abstained,
      };
    } catch (e) {
      this.#logger?.warn?.('System One conflict evaluation failed', { error: e });
      return null;
    }
  }

  /** F5: novelty-head score for a concept (ProactiveEnricher budget gate). */
  async noveltyScore(
    conceptTerm: string
  ): Promise<{ score: number; fitted: boolean; abstained: boolean } | null> {
    try {
      const manifold = this.#nar.getSystemOneManifold();
      const cache = this.#nar.getSystemOneEmbeddingCache();
      if (!manifold || !cache) return null;
      const sharedContext = await cache.write(conceptTerm);
      const query: EvaluateQuery = {
        kind: 'evaluate',
        instruction: 'Evaluate novelty of concept',
        rubric: 'novelty',
        axis: 'epistemic',
        criticality: 'low',
      };
      const propositions = await manifold.judgeBatch(sharedContext, [query], this.#budget());
      const prop = propositions[0];
      if (prop?.kind !== 'evaluate') return null;
      return {
        score: prop.score,
        fitted: prop.calibration.fitted === true,
        abstained: prop.abstained,
      };
    } catch (e) {
      this.#logger?.warn?.('System One novelty evaluation failed', { error: e });
      return null;
    }
  }
}

export function createSystemOneLMRuleAdapter(
  config: SystemOneLMRuleAdapterConfig
): SystemOneLMRuleAdapter {
  return new SystemOneLMRuleAdapter(config);
}
