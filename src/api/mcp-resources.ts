import type { Agent } from '@senars/nar/agent';
import type { NAR } from '../../nar/src';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface MCPResourceContext {
  nar: NAR;
  agent?: Agent;
}

export function registerMCPResources(server: McpServer, context: MCPResourceContext): void {
  const { nar, agent } = context;

  // Static resources
  server.registerResource(
    'beliefs',
    'nar://beliefs',
    {
      title: 'Beliefs',
      description: 'All stored beliefs with truth values',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'nar://beliefs',
          mimeType: 'application/json',
          text: JSON.stringify(
            nar.getBeliefs().map((b) => ({ term: b.term.toString(), truth: b.truth })),
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerResource(
    'concepts',
    'nar://concepts',
    {
      title: 'Concepts',
      description: 'Active concepts with attention priorities',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'nar://concepts',
          mimeType: 'application/json',
          text: JSON.stringify(nar.attentionReport(), null, 2),
        },
      ],
    })
  );

  server.registerResource(
    'attention',
    'nar://attention',
    {
      title: 'Attention',
      description: 'Current attention snapshot',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'nar://attention',
          mimeType: 'application/json',
          text: JSON.stringify(nar.attentionReport(), null, 2),
        },
      ],
    })
  );

  server.registerResource(
    'state',
    'nar://state',
    {
      title: 'State',
      description: 'NAR state summary (beliefs/goals/questions/attention/drives)',
      mimeType: 'application/json',
    },
    async () => {
      const beliefs = nar.getBeliefs().map((b) => ({ term: b.term.toString(), truth: b.truth }));
      const goals = nar.getGoals?.().map((g) => ({ term: g.term.toString(), truth: g.truth })) ?? [];
      const questions =
        nar.getQuestions?.().map((q) => ({ term: q.term.toString(), truth: q.truth })) ?? [];
      const attention = nar.attentionReport();
      const drives = nar.getDriveManager?.()?.getAllStates?.() ?? [];

      return {
        contents: [
          {
            uri: 'nar://state',
            mimeType: 'application/json',
            text: JSON.stringify({ beliefs, goals, questions, attention, drives }, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    'episodes',
    'nar://episodes',
    {
      title: 'Episodes',
      description: 'Recent episodic memory entries',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'nar://episodes',
          mimeType: 'application/json',
          text: JSON.stringify({ episodes: [] }, null, 2),
        },
      ],
    })
  );

  server.registerResource(
    'benchmarks',
    'nar://benchmarks',
    {
      title: 'Benchmarks',
      description: 'Benchmark history and scores',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'nar://benchmarks',
          mimeType: 'application/json',
          text: JSON.stringify({ history: [] }, null, 2),
        },
      ],
    })
  );

  server.registerResource(
    'config',
    'nar://config',
    {
      title: 'Config',
      description: 'Current configuration',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'nar://config',
          mimeType: 'application/json',
          text: JSON.stringify(nar.getConfig(), null, 2),
        },
      ],
    })
  );

  server.registerResource(
    'tools',
    'nar://tools',
    {
      title: 'Tools',
      description: 'Available tools with schemas',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'nar://tools',
          mimeType: 'application/json',
          text: JSON.stringify(
            nar.tools.list().map((t) => ({ name: t.name, description: t.description })),
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerResource(
    'sessions_list',
    'sessions://list',
    {
      title: 'Sessions',
      description: 'List all available sessions',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'sessions://list',
          mimeType: 'application/json',
          text: JSON.stringify([], null, 2),
        },
      ],
    })
  );

  server.registerResource(
    'knowledge_list',
    'knowledge://list',
    {
      title: 'Knowledge',
      description: 'List all knowledge entries',
      mimeType: 'application/json',
    },
    async () => {
      const knowledge = agent?.knowList?.() ?? [];
      return {
        contents: [
          {
            uri: 'knowledge://list',
            mimeType: 'application/json',
            text: JSON.stringify(knowledge, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    'lm_rule_stats',
    'lm-rules://stats',
    {
      title: 'LM Rule Stats',
      description: 'LM Rule statistics (calls, successes, failures, circuit state)',
      mimeType: 'application/json',
    },
    async () => {
      const stats = nar.getProcessor()?.getLmRuleStats?.() ?? [];
      return {
        contents: [
          {
            uri: 'lm-rules://stats',
            mimeType: 'application/json',
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    'lm_rule_log',
    'lm-rules://execution-log',
    {
      title: 'LM Rule Log',
      description: 'Recent LM Rule execution log',
      mimeType: 'application/json',
    },
    async () => {
      const log = nar.getProcessor()?.getLMRuleExecutionLog?.() ?? [];
      return {
        contents: [
          {
            uri: 'lm-rules://execution-log',
            mimeType: 'application/json',
            text: JSON.stringify(log, null, 2),
          },
        ],
      };
    }
  );

  server.registerResource(
    'rlfp_state',
    'rlfp://state',
    {
      title: 'RLFP State',
      description: 'RLFP learner state (policy, exploration rate, rewards)',
      mimeType: 'application/json',
    },
    async () => {
      const rlfp = nar.getRLFP?.();
      if (!rlfp) {
        return {
          contents: [
            {
              uri: 'rlfp://state',
              mimeType: 'application/json',
              text: JSON.stringify({ enabled: false }, null, 2),
            },
          ],
        };
      }
      const policyOptimizer = rlfp.policyOptimizerPublic;
      return {
        contents: [
          {
            uri: 'rlfp://state',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                enabled: true,
                policy: Object.fromEntries(
                  policyOptimizer
                    ?.getAllStrategies?.()
                    .map((s: string) => [s, policyOptimizer.getStrategyStats(s)?.priority ?? 1]) ??
                    []
                ),
                explorationRate: policyOptimizer?.getConfig?.().explorationRate ?? 0.1,
                totalRewards: rlfp.trajectoryCount ?? 0,
                totalSteps: rlfp.trajectoryCount ?? 0,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerResource(
    'self_reasoning_quality',
    'self-reasoning://quality',
    {
      title: 'Self-Reasoning Quality',
      description: 'Self-reasoning quality metrics',
      mimeType: 'application/json',
    },
    async () => {
      const self = nar.getSelfAnalyzer?.();
      if (!self) {
        return {
          contents: [
            {
              uri: 'self-reasoning://quality',
              mimeType: 'application/json',
              text: JSON.stringify({ available: false }, null, 2),
            },
          ],
        };
      }
      return {
        contents: [
          {
            uri: 'self-reasoning://quality',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                available: true,
                overall: 0,
                coherence: 0,
                relevance: 0,
                completeness: 0,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Parameterized resource templates
  server.registerResource(
    'session_by_key',
    new ResourceTemplate('sessions://{key}', {
      list: undefined,
    }),
    {
      title: 'Session by Key',
      description: 'Get session history by key',
      mimeType: 'application/json',
    },
    async (uri, { key }) => ({
      contents: [
        {
          uri: `sessions://${key}`,
          mimeType: 'application/json',
          text: `Session: ${key}`,
        },
      ],
    })
  );

  server.registerResource(
    'knowledge_by_key',
    new ResourceTemplate('knowledge://{key}', {
      list: undefined,
    }),
    {
      title: 'Knowledge by Key',
      description: 'Get knowledge entry by key',
      mimeType: 'application/json',
    },
    async (uri, { key }) => {
      const value = agent?.knowGet?.(key);
      if (value !== undefined) {
        return {
          contents: [
            {
              uri: `knowledge://${key}`,
              mimeType: 'application/json',
              text: JSON.stringify({ key, value }, null, 2),
            },
          ],
        };
      }
      return {
        contents: [
          {
            uri: `knowledge://${key}`,
            mimeType: 'application/json',
            text: `Unknown knowledge key: ${key}`,
          },
        ],
      };
    }
  );
}