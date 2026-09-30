import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NAR } from '@senars/nar';
import type { ExtendedAgent as Agent } from '@senars/nar/agent';
import { cloudApiKey, getRoutingStatus } from '@senars/nar/lm';
import type { JobManager } from './job-manager.js';
import {
  formatBeliefsForMCP,
  jsonContents,
  registerJsonResource,
  textContents,
} from './mcp-response.js';

export interface MCPResourceContext {
  nar: NAR;
  agent?: Agent;
  jobs?: JobManager;
}

/** "Which model am I actually using?" — active provider, per-task model, credentials, stats. */
const lmStatus = (nar: NAR) => {
  const lm = nar.getLMClient?.();
  const tiers: Record<string, unknown> = {};
  for (const task of ['quality', 'fast', 'structured', 'compact'] as const) {
    const model = lm?.getModel(task as never);
    if (model) {
      tiers[task] = (model as { modelId?: string }).modelId ?? (model as { model?: string }).model;
    }
  }
  return {
    provider: lm?.provider ?? 'none',
    model: lm?.model,
    available: lm?.available ?? false,
    tiers,
    cloudCredentials: Boolean(cloudApiKey()),
    offlineCapable: true,
    stats: lm?.getStats?.() ?? {},
    routing: getRoutingStatus(),
  };
};

/** Derivation cost attribution: slowest LM rules first, with roll-up totals. */
const benchmarks = (nar: NAR) => {
  const costlyDerivations = nar
    .getProcessor()
    .getLmRuleStats()
    .flatMap((lmStat) => {
      const { stats } = lmStat;
      return stats && stats.totalCalls > 0
        ? [
            {
              rule: lmStat.id,
              cpuMs: stats.totalDuration,
              lmCalls: stats.totalCalls,
              lmTokens: stats.totalTokens,
              count: stats.successfulCalls,
              avgCpuMs: stats.averageDuration,
            },
          ]
        : [];
    })
    .sort((a, b) => b.cpuMs - a.cpuMs);
  const sum = (pick: (d: (typeof costlyDerivations)[number]) => number) =>
    costlyDerivations.reduce((total, d) => total + pick(d), 0);

  return {
    history: [],
    costlyDerivations: costlyDerivations.slice(0, 10),
    totals: {
      totalDerivations: sum((d) => d.count),
      totalCpuMs: sum((d) => d.cpuMs),
      totalLmCalls: sum((d) => d.lmCalls),
      totalLmTokens: sum((d) => d.lmTokens),
    },
  };
};

const rlfpState = (nar: NAR) => {
  const rlfp = nar.getRLFP?.();
  if (!rlfp) return { enabled: false };
  const optimizer = rlfp.policyOptimizerPublic;
  return {
    enabled: true,
    policy: Object.fromEntries(
      optimizer
        ?.getAllStrategies?.()
        .map((s: string) => [s, optimizer.getStrategyStats(s)?.priority ?? 1]) ?? []
    ),
    explorationRate: optimizer?.getConfig?.().explorationRate ?? 0.1,
    totalRewards: rlfp.trajectoryCount ?? 0,
    totalSteps: rlfp.trajectoryCount ?? 0,
  };
};

const stateSummary = (nar: NAR) => ({
  beliefs: formatBeliefsForMCP(nar.getBeliefs()),
  goals: nar.getGoals?.().map((g) => ({ term: g.term.toString(), truth: g.truth })) ?? [],
  questions: nar.getQuestions?.().map((q) => ({ term: q.term.toString(), truth: q.truth })) ?? [],
  attention: nar.attentionReport(),
  drives: nar.getDriveManager?.()?.getAllStates?.() ?? [],
});

/** Memory health — episode volume, tool retrieval success, consolidation state. */
const memoryStatus = async (nar: NAR, agent?: Agent) => {
  const episodic = await agent?.getEpisodicMemory?.();
  const episodes = episodic ? await episodic.getEpisodes({ limit: 10_000 }) : [];
  const retrieval = nar.tools.getAllFeedback().reduce(
    (acc: { calls: number; ok: number }, s) => ({
      calls: acc.calls + s.totalCalls,
      ok: acc.ok + s.successfulCalls,
    }),
    { calls: 0, ok: 0 }
  );
  return {
    episodeCount: episodes.length,
    recentEpisodeTypes: episodes.slice(0, 20).map((e: { type: string }) => e.type),
    retrieval: {
      totalCalls: retrieval.calls,
      successfulCalls: retrieval.ok,
      hitRate: retrieval.calls > 0 ? retrieval.ok / retrieval.calls : null,
    },
  };
};

export function registerMCPResources(server: McpServer, context: MCPResourceContext): void {
  const { nar, agent } = context;
  const json = (
    name: string,
    uri: string,
    title: string,
    description: string,
    load: () => unknown | Promise<unknown>
  ) => registerJsonResource(server, { name, uri, title, description, load });

  json(
    'lm-status',
    'nar://lm-status',
    'LM Status',
    'Active LM provider, per-task model resolution, credential presence, and call stats',
    () => lmStatus(nar)
  );

  json('beliefs', 'nar://beliefs', 'Beliefs', 'All stored beliefs with truth values', () =>
    formatBeliefsForMCP(nar.getBeliefs())
  );

  json('concepts', 'nar://concepts', 'Concepts', 'Active concepts with attention priorities', () =>
    nar.attentionReport()
  );

  json('attention', 'nar://attention', 'Attention', 'Current attention snapshot', () =>
    nar.attentionReport()
  );

  json(
    'state',
    'nar://state',
    'State',
    'NAR state summary (beliefs/goals/questions/attention/drives)',
    () => stateSummary(nar)
  );

  json('episodes', 'nar://episodes', 'Episodes', 'Recent episodic memory entries', () => ({
    episodes: [],
  }));

  json(
    'benchmarks',
    'nar://benchmarks',
    'Benchmarks',
    'Benchmark history and scores with derivation cost attribution',
    () => benchmarks(nar)
  );

  json('config', 'nar://config', 'Config', 'Current configuration', () => nar.getConfig());

  json('tools', 'nar://tools', 'Tools', 'Available tools with schemas', () =>
    nar.tools.list().map((t) => ({ name: t.name, description: t.description }))
  );

  json('sessions_list', 'sessions://list', 'Sessions', 'List all available sessions', () => []);

  json(
    'knowledge_list',
    'knowledge://list',
    'Knowledge',
    'List all knowledge entries',
    () => agent?.knowList?.() ?? []
  );

  json(
    'lm_rule_stats',
    'lm-rules://stats',
    'LM Rule Stats',
    'LM Rule statistics (calls, successes, failures, circuit state)',
    () => nar.getProcessor()?.getLmRuleStats?.() ?? []
  );

  json(
    'lm_rule_log',
    'lm-rules://execution-log',
    'LM Rule Log',
    'Recent LM Rule execution log',
    () => nar.getProcessor()?.getLMRuleExecutionLog?.() ?? []
  );

  json(
    'rlfp_state',
    'rlfp://state',
    'RLFP State',
    'RLFP learner state (policy, exploration rate, rewards)',
    () => rlfpState(nar)
  );

  json(
    'self_reasoning_quality',
    'self-reasoning://quality',
    'Self-Reasoning Quality',
    'Self-reasoning quality metrics',
    () =>
      nar.getSelfAnalyzer?.()
        ? { available: true, overall: 0, coherence: 0, relevance: 0, completeness: 0 }
        : { available: false }
  );

  json(
    'memory-status',
    'nar://memory-status',
    'Memory Status',
    'Episode counts, retrieval hit-rate, and memory health',
    () => memoryStatus(nar, agent)
  );

  json('jobs', 'nar://jobs', 'Jobs', 'Background job records (running/done/error)', () => ({
    jobs: context.jobs?.list() ?? [],
  }));

  const templateMeta = (title: string, description: string) => ({
    title,
    description,
    mimeType: 'application/json',
  });

  server.registerResource(
    'session_by_key',
    new ResourceTemplate('sessions://{key}', { list: undefined }),
    templateMeta('Session by Key', 'Get session history by key'),
    async (_uri, { key }) => textContents(`sessions://${key}`, `Session: ${key}`)
  );

  server.registerResource(
    'knowledge_by_key',
    new ResourceTemplate('knowledge://{key}', { list: undefined }),
    templateMeta('Knowledge by Key', 'Get knowledge entry by key'),
    async (_uri, { key }) => {
      const uri = `knowledge://${key}`;
      const keyStr = Array.isArray(key) ? key[0] : key;
      if (!keyStr) return textContents(uri, `Unknown knowledge key: ${key}`);
      const value = agent?.knowGet?.(keyStr);
      return value === undefined
        ? textContents(`knowledge://${keyStr}`, `Unknown knowledge key: ${keyStr}`)
        : jsonContents(`knowledge://${keyStr}`, { key: keyStr, value });
    }
  );
}
