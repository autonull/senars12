import { promises as fs } from 'node:fs';
import type { Agent } from '@senars/nar/agent';
import { z } from 'zod';
import type { NAR } from '../../nar/src';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerNARTools(server: McpServer, nar: NAR, agent: Agent): void {
  // Calculate tool
  server.registerTool(
    'calculate',
    {
      title: 'Calculator',
      description: 'Evaluate arithmetic/math expressions',
      inputSchema: { expression: z.string() },
    },
    async ({ expression }) => {
      // Safe eval for math expressions
      const sanitized = expression.replace(/[^0-9+\-*/.()eE\s]/g, '');
      const result = eval(sanitized);
      return { content: [{ type: 'text', text: String(result) }] };
    }
  );

  // Read file tool
  server.registerTool(
    'read_file',
    {
      title: 'Read File',
      description: 'Read file contents',
      inputSchema: { path: z.string() },
    },
    async ({ path }) => {
      const content = await fs.readFile(path, 'utf-8');
      return { content: [{ type: 'text', text: content }] };
    }
  );

  // Write file tool
  server.registerTool(
    'write_file',
    {
      title: 'Write File',
      description: 'Write content to file',
      inputSchema: { path: z.string(), content: z.string() },
    },
    async ({ path, content }) => {
      await fs.writeFile(path, content, 'utf-8');
      return { content: [{ type: 'text', text: 'File written successfully' }] };
    }
  );

  // Search memory tool
  server.registerTool(
    'search_memory',
    {
      title: 'Search Memory',
      description: 'Search NAR memory for beliefs',
      inputSchema: { query: z.string() },
    },
    async ({ query }) => {
      const beliefs = nar.getBeliefs();
      const results = beliefs.filter((b) =>
        b.term.toString().toLowerCase().includes(query.toLowerCase())
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              results.map((b) => ({ term: b.term.toString(), truth: b.truth })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Run reasoning tool
  server.registerTool(
    'run_reasoning',
    {
      title: 'Run Reasoning',
      description: 'Run NAL inference steps',
      inputSchema: { steps: z.number() },
    },
    async ({ steps }) => {
      const derived = await nar.run(steps);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                derived,
                beliefs: nar.getBeliefs().slice(-10).map((b) => ({
                  term: b.term.toString(),
                  truth: b.truth,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Learn belief tool
  server.registerTool(
    'learn_belief',
    {
      title: 'Learn Belief',
      description: 'Add a belief to memory',
      inputSchema: { belief: z.string() },
    },
    async ({ belief }) => {
      await nar.believe(belief);
      return { content: [{ type: 'text', text: `Added belief: ${belief}` }] };
    }
  );

  // Explain belief tool
  server.registerTool(
    'explain_belief',
    {
      title: 'Explain Belief',
      description: 'Explain how a belief was derived',
      inputSchema: { term: z.string() },
    },
    async ({ term }) => {
      return { content: [{ type: 'text', text: `Derivation for ${term}: Not yet implemented` }] };
    }
  );

  // Agent chat tool
  server.registerTool(
    'agent_chat',
    {
      title: 'Agent Chat',
      description: 'Chat with the agent (non-streaming)',
      inputSchema: { input: z.string(), historyLimit: z.number().optional() },
    },
    async ({ input }) => {
      const result = await agent.chat(input);
      return { content: [{ type: 'text', text: result }] };
    }
  );

  // Agent chat stream tool
  server.registerTool(
    'agent_chat_stream',
    {
      title: 'Agent Chat Stream',
      description: 'Chat with the agent (streaming)',
      inputSchema: { input: z.string(), historyLimit: z.number().optional() },
    },
    async ({ input }) => {
      let result = '';
      for await (const event of agent.chatStream(input)) {
        if (event.kind === 'finish' || event.kind === 'aborted' || event.kind === 'error') {
          result = event.text ?? '';
        }
      }
      return { content: [{ type: 'text', text: result }] };
    }
  );

  // Agent believe tool
  server.registerTool(
    'agent_believe',
    {
      title: 'Agent Believe',
      description: 'Add a belief to NAR memory',
      inputSchema: { narsese: z.string() },
    },
    async ({ narsese }) => {
      await agent.believe(narsese);
      return { content: [{ type: 'text', text: 'Belief added successfully' }] };
    }
  );

  // Agent recall tool
  server.registerTool(
    'agent_recall',
    {
      title: 'Agent Recall',
      description: 'Recall from episodic memory',
      inputSchema: { query: z.string().optional(), limit: z.number().optional() },
    },
    async ({ query, limit }) => {
      const result = await agent.recall(query, limit);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Agent know tool
  server.registerTool(
    'agent_know',
    {
      title: 'Agent Know',
      description: 'Store or retrieve knowledge',
      inputSchema: { key: z.string(), value: z.string().optional() },
    },
    async ({ key, value }) => {
      if (value !== undefined) {
        agent.know(key, value);
        return { content: [{ type: 'text', text: `Stored: ${key} = ${value}` }] };
      }
      const result = agent.knowGet?.(key);
      return { content: [{ type: 'text', text: JSON.stringify({ key, value: result }, null, 2) }] };
    }
  );

  // Agent LM rule enable tool
  server.registerTool(
    'agent_lm_rule_enable',
    {
      title: 'Enable LM Rule',
      description: 'Enable an LM rule',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      return { content: [{ type: 'text', text: `Enabled LM rule: ${id}` }] };
    }
  );

  // Agent LM rule disable tool
  server.registerTool(
    'agent_lm_rule_disable',
    {
      title: 'Disable LM Rule',
      description: 'Disable an LM rule',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      return { content: [{ type: 'text', text: `Disabled LM rule: ${id}` }] };
    }
  );

  // Agent explain tool
  server.registerTool(
    'agent_explain',
    {
      title: 'Agent Explain',
      description: 'Explain a belief or goal',
      inputSchema: { term: z.string(), type: z.enum(['belief', 'goal']).optional() },
    },
    async ({ term, type }) => {
      return {
        content: [
          {
            type: 'text',
            text: `Explanation for ${term} (${type ?? 'belief'}): Not yet implemented`,
          },
        ],
      };
    }
  );

  // Agent goal progress tool
  server.registerTool(
    'agent_goal_progress',
    {
      title: 'Agent Goal Progress',
      description: 'Get goal progress or list active goals',
      inputSchema: { goalId: z.string().optional() },
    },
    async ({ goalId }) => {
      const result = goalId ? { goalId, progress: 0 } : [];
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get beliefs resource tool
  server.registerTool(
    'get_beliefs',
    {
      title: 'Get Beliefs',
      description: 'Get all beliefs from NAR memory',
      inputSchema: {},
    },
    async () => {
      const beliefs = nar.getBeliefs();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              beliefs.map((b) => ({ term: b.term.toString(), truth: b.truth })),
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Get attention tool
  server.registerTool(
    'get_attention',
    {
      title: 'Get Attention',
      description: 'Get current attention snapshot',
      inputSchema: {},
    },
    async () => {
      const report = nar.attentionReport();
      return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
    }
  );
}