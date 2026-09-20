import type { CognitiveDispatcher } from './types.js';
import type { Term } from '../../terms';
import type { Task, Budget, TruthType } from '../../types';
import { createTimestamp } from '../../types/core.js';
import { termParser } from '../../terms';

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

      const budget: import('@senars/kernel/schemas').ReasoningBudget = {
        maxCycles: 100,
        maxDepth: 10,
        maxMemoryOps: 1000,
        maxLMCalls: 5,
        consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
      };

      const peaResult = await this.#dispatcher.proposeAndJudge(cognitiveContext, synthesisQuery, judgmentQueries, budget);

      const tasks: Task[] = [];
      for (const admitted of peaResult.admitted) {
        const parsed = termParser.parse(admitted.candidate);
        if (parsed) {
          const taskBudget: Budget = { priority: admitted.truth.c, durability: 0.8, quality: 0.9, cycles: 10, depth: 5 };
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

      this.#logger?.debug?.('System One translation', { candidates: peaResult.candidates.length, admitted: tasks.length });
      return tasks;
    } catch (e) {
      this.#logger?.warn?.('System One translation failed', { error: e });
      return [];
    }
  }
}

export function createSystemOneLMRuleAdapter(config: SystemOneLMRuleAdapterConfig): SystemOneLMRuleAdapter {
  return new SystemOneLMRuleAdapter(config);
}