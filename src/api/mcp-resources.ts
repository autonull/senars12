import type { Agent } from '@senars/nar/agent';
import type { NAR } from '../../nar/src';
import type { EnhancedMCPAdapter } from './mcp';
import type { SeNARSMCPServer } from './mcp-server';

export interface MCPResourceContext {
  nar: NAR;
  agent?: Agent;
}

export function registerMCPResources(
  adapter: EnhancedMCPAdapter,
  _context: MCPResourceContext,
  server?: SeNARSMCPServer
): void {
  const resources = [
    { uri: 'nar://beliefs', name: 'Beliefs', description: 'All stored beliefs with truth values' },
    {
      uri: 'nar://concepts',
      name: 'Concepts',
      description: 'Active concepts with attention priorities',
    },
    { uri: 'nar://attention', name: 'Attention', description: 'Current attention snapshot' },
    {
      uri: 'nar://state',
      name: 'State',
      description: 'NAR state summary (beliefs/goals/questions/attention/drives)',
    },
    { uri: 'nar://episodes', name: 'Episodes', description: 'Recent episodic memory entries' },
    { uri: 'nar://benchmarks', name: 'Benchmarks', description: 'Benchmark history and scores' },
    { uri: 'nar://config', name: 'Config', description: 'Current configuration' },
    { uri: 'nar://tools', name: 'Tools', description: 'Available tools with schemas' },
    { uri: 'sessions://list', name: 'Sessions', description: 'List all available sessions' },
    { uri: 'knowledge://list', name: 'Knowledge', description: 'List all knowledge entries' },
    {
      uri: 'lm-rules://stats',
      name: 'LM Rule Stats',
      description: 'LM Rule statistics (calls, successes, failures, circuit state)',
    },
    {
      uri: 'lm-rules://execution-log',
      name: 'LM Rule Log',
      description: 'Recent LM Rule execution log',
    },
    {
      uri: 'rlfp://state',
      name: 'RLFP State',
      description: 'RLFP learner state (policy, exploration rate, rewards)',
    },
    {
      uri: 'self-reasoning://quality',
      name: 'Self-Reasoning Quality',
      description: 'Self-reasoning quality metrics',
    },
  ];

  for (const r of resources) {
    adapter.registerCapability({
      name: r.uri,
      description: r.description,
      inputSchema: { type: 'object', properties: {} },
    });
    if (server) server.registerResource(r);
  }

  // Parameterized resource templates
  if (server) {
    server.registerResource({
      uri: 'sessions://{key}',
      name: 'Session by Key',
      description: 'Get session history by key',
    });
    server.registerResource({
      uri: 'knowledge://{key}',
      name: 'Knowledge by Key',
      description: 'Get knowledge entry by key',
    });
  }
}

export function getResourceContent(
  adapter: EnhancedMCPAdapter,
  context: MCPResourceContext,
  uri: string
): string {
  const { nar, agent } = context;

  if (uri.startsWith('sessions://') && uri !== 'sessions://list') {
    const key = uri.replace('sessions://', '');
    return `Session: ${key}`;
  }

  if (uri.startsWith('knowledge://') && uri !== 'knowledge://list') {
    const key = uri.replace('knowledge://', '');
    if (agent) {
      const value = agent.knowGet?.(key);
      if (value !== undefined) return JSON.stringify({ key, value }, null, 2);
    }
    return `Unknown knowledge key: ${key}`;
  }

  switch (uri) {
    case 'nar://beliefs': {
      const beliefs = nar.getBeliefs();
      return JSON.stringify(
        beliefs.map((b) => ({ term: b.term.toString(), truth: b.truth })),
        null,
        2
      );
    }
    case 'nar://concepts':
    case 'nar://attention': {
      const report = nar.attentionReport();
      return JSON.stringify(report, null, 2);
    }
    case 'nar://state': {
      const beliefs = nar.getBeliefs().map((b) => ({ term: b.term.toString(), truth: b.truth }));
      const goals =
        nar.getGoals?.().map((g) => ({ term: g.term.toString(), truth: g.truth })) ?? [];
      const questions =
        nar.getQuestions?.().map((q) => ({ term: q.term.toString(), truth: q.truth })) ?? [];
      const attention = nar.attentionReport();
      const drives = nar.getDriveManager?.()?.getAllStates?.() ?? [];
      return JSON.stringify({ beliefs, goals, questions, attention, drives }, null, 2);
    }
    case 'nar://episodes':
      return JSON.stringify({ episodes: [] }, null, 2);
    case 'nar://benchmarks':
      return JSON.stringify({ history: [] }, null, 2);
    case 'nar://config':
      return JSON.stringify(nar.getConfig(), null, 2);
    case 'nar://tools': {
      const tools = nar.tools.list();
      return JSON.stringify(
        tools.map((t) => ({ name: t.name, description: t.description })),
        null,
        2
      );
    }
    case 'sessions://list': {
      return JSON.stringify([], null, 2);
    }
    case 'knowledge://list': {
      if (agent) {
        const knowledge = agent.knowList?.() ?? [];
        return JSON.stringify(knowledge, null, 2);
      }
      return JSON.stringify([], null, 2);
    }
    case 'lm-rules://stats': {
      const stats = nar.getProcessor()?.getLmRuleStats?.() ?? [];
      return JSON.stringify(stats, null, 2);
    }
    case 'lm-rules://execution-log': {
      const log = nar.getProcessor()?.getLMRuleExecutionLog?.() ?? [];
      return JSON.stringify(log, null, 2);
    }
    case 'rlfp://state': {
      const rlfp = nar.getRLFP?.();
      if (!rlfp) return JSON.stringify({ enabled: false }, null, 2);
      const policyOptimizer = rlfp.policyOptimizerPublic;
      return JSON.stringify(
        {
          enabled: true,
          policy: Object.fromEntries(
            policyOptimizer
              ?.getAllStrategies?.()
              .map((s: string) => [s, policyOptimizer.getStrategyStats(s)?.priority ?? 1]) ?? []
          ),
          explorationRate: policyOptimizer?.getConfig?.().explorationRate ?? 0.1,
          totalRewards: rlfp.trajectoryCount ?? 0,
          totalSteps: rlfp.trajectoryCount ?? 0,
        },
        null,
        2
      );
    }
    case 'self-reasoning://quality': {
      const self = nar.getSelfAnalyzer?.();
      if (!self) return JSON.stringify({ available: false }, null, 2);
      return JSON.stringify(
        {
          available: true,
          overall: 0,
          coherence: 0,
          relevance: 0,
          completeness: 0,
        },
        null,
        2
      );
    }
    default:
      return `Unknown resource: ${uri}`;
  }
}
