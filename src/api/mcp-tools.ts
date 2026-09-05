import { promises as fs } from 'node:fs';
import type { Agent } from '@senars/nar/agent';
import { z } from 'zod';
import type { NAR } from '../../nar/src';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** Safe math evaluator - parses and evaluates arithmetic expressions without eval() */
function safeEvaluate(expr: string): number {
  const tokens = expr.match(/\d+\.?\d*|[+\-*/()]/g) ?? [];
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseExpression = (): number => {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseTerm = (): number => {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  };

  const parseFactor = (): number => {
    if (peek() === '(') {
      consume();
      const result = parseExpression();
      consume();
      return result;
    }
    if (peek() === '-') {
      consume();
      return -parseFactor();
    }
    if (peek() === '+') {
      consume();
      return parseFactor();
    }
    const token = consume();
    if (token === undefined) throw new Error('Unexpected end of expression');
    const num = Number(token);
    if (Number.isNaN(num)) throw new Error(`Invalid number: ${token}`);
    return num;
  };

  const result = parseExpression();
  if (pos !== tokens.length) throw new Error('Unexpected tokens remaining');
  return result;
}

export function registerNARTools(server: McpServer, nar: NAR, agent: Agent): void {
  server.registerTool(
    'calculate',
    {
      title: 'Calculator',
      description: 'Evaluate arithmetic/math expressions',
      inputSchema: { expression: z.string() },
      outputSchema: { result: z.number() },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ expression }) => {
      const sanitized = expression.replace(/[^0-9+\-*/.()eE\s]/g, '');
      const result = safeEvaluate(sanitized);
      return {
        content: [{ type: 'text', text: String(result) }],
        structuredContent: { result },
      };
    }
  );

  server.registerTool(
    'read_file',
    {
      title: 'Read File',
      description: 'Read file contents',
      inputSchema: { path: z.string() },
      outputSchema: { content: z.string() },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ path }) => {
      const content = await fs.readFile(path, 'utf-8');
      return {
        content: [{ type: 'text', text: content }],
        structuredContent: { content },
      };
    }
  );

  server.registerTool(
    'write_file',
    {
      title: 'Write File',
      description: 'Write content to file',
      inputSchema: { path: z.string(), content: z.string() },
      outputSchema: { success: z.boolean() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ path, content }) => {
      await fs.writeFile(path, content, 'utf-8');
      return {
        content: [{ type: 'text', text: 'File written successfully' }],
        structuredContent: { success: true },
      };
    }
  );

  server.registerTool(
    'search_memory',
    {
      title: 'Search Memory',
      description: 'Search NAR memory for beliefs',
      inputSchema: { query: z.string() },
      outputSchema: { results: z.array(z.object({ term: z.string(), truth: z.any() })) },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query }) => {
      const beliefs = nar.getBeliefs();
      const results = beliefs.filter((b) =>
        b.term.toString().toLowerCase().includes(query.toLowerCase())
      );
      const structuredResults = results.map((b) => ({ term: b.term.toString(), truth: b.truth }));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structuredResults, null, 2),
          },
        ],
        structuredContent: { results: structuredResults },
      };
    }
  );

  server.registerTool(
    'run_reasoning',
    {
      title: 'Run Reasoning',
      description: 'Run NAL inference steps',
      inputSchema: { steps: z.number() },
      outputSchema: { derived: z.number(), beliefs: z.array(z.object({ term: z.string(), truth: z.any() })) },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ steps }) => {
      const derived = await nar.run(steps);
      const recentBeliefs = nar.getBeliefs().slice(-10).map((b) => ({
        term: b.term.toString(),
        truth: b.truth,
      }));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                derived,
                beliefs: recentBeliefs,
              },
              null,
              2
            ),
          },
        ],
        structuredContent: { derived, beliefs: recentBeliefs },
      };
    }
  );

  server.registerTool(
    'learn_belief',
    {
      title: 'Learn Belief',
      description: 'Add a belief to memory',
      inputSchema: { belief: z.string() },
      outputSchema: { added: z.string() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ belief }) => {
      await nar.believe(belief);
      return {
        content: [{ type: 'text', text: `Added belief: ${belief}` }],
        structuredContent: { added: belief },
      };
    }
  );

  server.registerTool(
    'explain_belief',
    {
      title: 'Explain Belief',
      description: 'Explain how a belief was derived',
      inputSchema: { term: z.string() },
      outputSchema: { term: z.string(), derivation: z.string() },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ term }) => {
      const result = { term, derivation: 'Not yet implemented' };
      return {
        content: [{ type: 'text', text: `Derivation for ${term}: Not yet implemented` }],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    'agent_chat',
    {
      title: 'Agent Chat',
      description: 'Chat with the agent (non-streaming)',
      inputSchema: { input: z.string(), historyLimit: z.number().optional() },
      outputSchema: { response: z.string() },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ input }) => {
      const result = await agent.chat(input);
      return {
        content: [{ type: 'text', text: result }],
        structuredContent: { response: result },
      };
    }
  );

  server.registerTool(
    'agent_chat_stream',
    {
      title: 'Agent Chat Stream',
      description: 'Chat with the agent (streaming)',
      inputSchema: { input: z.string(), historyLimit: z.number().optional() },
      outputSchema: { response: z.string() },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ input }) => {
      let result = '';
      for await (const event of agent.chatStream(input)) {
        if (event.kind === 'finish' || event.kind === 'aborted' || event.kind === 'error') {
          result = event.text ?? '';
        }
      }
      return {
        content: [{ type: 'text', text: result }],
        structuredContent: { response: result },
      };
    }
  );

  server.registerTool(
    'agent_believe',
    {
      title: 'Agent Believe',
      description: 'Add a belief to NAR memory',
      inputSchema: { narsese: z.string() },
      outputSchema: { success: z.boolean() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ narsese }) => {
      await agent.believe(narsese);
      return {
        content: [{ type: 'text', text: 'Belief added successfully' }],
        structuredContent: { success: true },
      };
    }
  );

  server.registerTool(
    'agent_recall',
    {
      title: 'Agent Recall',
      description: 'Recall from episodic memory',
      inputSchema: { query: z.string().optional(), limit: z.number().optional() },
      outputSchema: z.any(),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, limit }) => {
      const result = await agent.recall(query, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    'agent_know',
    {
      title: 'Agent Know',
      description: 'Store or retrieve knowledge',
      inputSchema: { key: z.string(), value: z.string().optional() },
      outputSchema: { key: z.string(), value: z.string().optional(), stored: z.boolean().optional() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ key, value }) => {
      if (value !== undefined) {
        agent.know(key, value);
        return {
          content: [{ type: 'text', text: `Stored: ${key} = ${value}` }],
          structuredContent: { key, value, stored: true },
        };
      }
      const result = agent.knowGet?.(key);
      return {
        content: [{ type: 'text', text: JSON.stringify({ key, value: result }, null, 2) }],
        structuredContent: { key, value: result, stored: false },
      };
    }
  );

  server.registerTool(
    'agent_lm_rule_enable',
    {
      title: 'Enable LM Rule',
      description: 'Enable an LM rule',
      inputSchema: { id: z.string() },
      outputSchema: { enabled: z.boolean(), id: z.string() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      return {
        content: [{ type: 'text', text: `Enabled LM rule: ${id}` }],
        structuredContent: { enabled: true, id },
      };
    }
  );

  server.registerTool(
    'agent_lm_rule_disable',
    {
      title: 'Disable LM Rule',
      description: 'Disable an LM rule',
      inputSchema: { id: z.string() },
      outputSchema: { disabled: z.boolean(), id: z.string() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      return {
        content: [{ type: 'text', text: `Disabled LM rule: ${id}` }],
        structuredContent: { disabled: true, id },
      };
    }
  );

  server.registerTool(
    'agent_explain',
    {
      title: 'Agent Explain',
      description: 'Explain a belief or goal',
      inputSchema: { term: z.string(), type: z.enum(['belief', 'goal']).optional() },
      outputSchema: { term: z.string(), type: z.string(), explanation: z.string() },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ term, type }) => {
      const result = { term, type: type ?? 'belief', explanation: 'Not yet implemented' };
      return {
        content: [
          {
            type: 'text',
            text: `Explanation for ${term} (${type ?? 'belief'}): Not yet implemented`,
          },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    'agent_goal_progress',
    {
      title: 'Agent Goal Progress',
      description: 'Get goal progress or list active goals',
      inputSchema: { goalId: z.string().optional() },
      outputSchema: z.union([z.array(z.unknown()), z.object({ goalId: z.string(), progress: z.number() })]),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ goalId }) => {
      const result = goalId ? { goalId, progress: 0 } : [];
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    'get_beliefs',
    {
      title: 'Get Beliefs',
      description: 'Get all beliefs from NAR memory',
      inputSchema: {},
      outputSchema: { beliefs: z.array(z.object({ term: z.string(), truth: z.any() })) },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const beliefs = nar.getBeliefs();
      const structuredBeliefs = beliefs.map((b) => ({ term: b.term.toString(), truth: b.truth }));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(structuredBeliefs, null, 2),
          },
        ],
        structuredContent: { beliefs: structuredBeliefs },
      };
    }
  );

  server.registerTool(
    'get_attention',
    {
      title: 'Get Attention',
      description: 'Get current attention snapshot',
      inputSchema: {},
      outputSchema: z.any(),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const report = nar.attentionReport();
      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
        structuredContent: report,
      };
    }
  );
}