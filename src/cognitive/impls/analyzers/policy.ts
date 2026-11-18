import type { ModelRuleStats } from '../../../lm';
import { flooredRatio, incrementCount, pushCapped } from '@senars/util';
/**
 * Policy management - extracted from SelfAnalyzerService
 */
import type { AgentPolicy } from '../../types.js';
import { averageRuleDuration } from './performance.js';

export interface PolicyManager {
  recordRoute(kind: string): void;

  recordTool(name: string): void;

  recomputePolicy(ruleStats?: readonly ModelRuleStats[] | null): AgentPolicy;

  getPolicy(): AgentPolicy;

  getRecency(): { routes: string[]; tools: string[] };
}

export const createPolicyManager = (recencyEpisodes: number): PolicyManager => {
  const recentRoutes: string[] = [];
  const recentTools: string[] = [];
  let policy: AgentPolicy = {
    routingWeights: {
      narsese: 1,
      nl: 1,
      reason: 1,
      command: 1,
      narsese_belief: 1,
      narsese_question: 1,
    },
    toolSelectionBias: {},
    promptBudget: 2048,
    recencyEpisodes,
    updatedAt: 0,
  };

  return {
    recordRoute(kind: string) {
      pushCapped(recentRoutes, kind, recencyEpisodes);
    },

    recordTool(name: string) {
      pushCapped(recentTools, name, recencyEpisodes);
    },

    recomputePolicy(ruleStats: readonly ModelRuleStats[] | null = null): AgentPolicy {
      const routeCounts = new Map<string, number>();
      for (const r of recentRoutes) incrementCount(routeCounts, r);
      const routingWeights: Record<string, number> = {};
      for (const [kind, count] of routeCounts)
        routingWeights[kind] = Math.max(0.1, flooredRatio(count, recentRoutes.length));
      for (const k of ['narsese-belief', 'narsese-question', 'command', 'nl', 'reason']) {
        if (!(k in routingWeights)) routingWeights[k] = 0.1;
      }

      const toolCounts = new Map<string, number>();
      for (const t of recentTools) incrementCount(toolCounts, t);
      const toolSelectionBias: Record<string, number> = {};
      for (const [name, count] of toolCounts)
        toolSelectionBias[name] = Math.max(0.1, flooredRatio(count, recentTools.length));

      const avgDuration = averageRuleDuration(ruleStats);
      const budget = avgDuration > 50 ? 1024 : 2048;

      policy = {
        routingWeights,
        toolSelectionBias,
        promptBudget: budget,
        recencyEpisodes,
        updatedAt: Date.now(),
      };
      return policy;
    },

    getPolicy(): AgentPolicy {
      return policy;
    },

    getRecency() {
      return { routes: recentRoutes, tools: recentTools };
    },
  };
};
