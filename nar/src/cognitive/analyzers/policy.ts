import type { MetricsCollector } from '../../metrics';
/**
 * Policy management - extracted from SelfAnalyzerService
 */
import type { AgentPolicy } from '../types.js';

export interface PolicyManager {
  recordRoute(kind: string): void;
  recordTool(name: string): void;
  recomputePolicy(metrics: MetricsCollector | null): AgentPolicy;
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
      const cap = recencyEpisodes;
      recentRoutes.push(kind);
      if (recentRoutes.length > cap) recentRoutes.splice(0, recentRoutes.length - cap);
    },

    recordTool(name: string) {
      const cap = recencyEpisodes;
      recentTools.push(name);
      if (recentTools.length > cap) recentTools.splice(0, recentTools.length - cap);
    },

    recomputePolicy(metrics: MetricsCollector | null): AgentPolicy {
      const routeCounts = new Map<string, number>();
      for (const r of recentRoutes) routeCounts.set(r, (routeCounts.get(r) ?? 0) + 1);
      const totalRoutes = Math.max(1, recentRoutes.length);
      const routingWeights: Record<string, number> = {};
      for (const [kind, count] of routeCounts)
        routingWeights[kind] = Math.max(0.1, count / totalRoutes);
      for (const k of ['narsese-belief', 'narsese-question', 'command', 'nl', 'reason']) {
        if (!(k in routingWeights)) routingWeights[k] = 0.1;
      }

      const toolCounts = new Map<string, number>();
      for (const t of recentTools) toolCounts.set(t, (toolCounts.get(t) ?? 0) + 1);
      const toolSelectionBias: Record<string, number> = {};
      for (const [name, count] of toolCounts)
        toolSelectionBias[name] = Math.max(0.1, count / Math.max(1, recentTools.length));

      const ruleStats = metrics?.getRuleStats?.();
      const avgDuration = Array.isArray(ruleStats)
        ? ruleStats.reduce((a, b) => a + b.averageDuration, 0) / ruleStats.length
        : 0;
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
