import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { withinWorkspace } from '@senars/core';
import type { NAR } from '@senars/nar';
import type { ExtendedAgent as Agent } from '@senars/nar/agent';
import {
  getModelChain,
  getRoutingStatus,
  type LMTask,
  resetDemotions,
  resolveOfflineTier,
} from '@senars/nar/lm';
import { z } from 'zod';
import type { JobManager } from './job-manager.js';
import { registerNARRegistryTools } from './mcp-bridge.js';
import { createMCPResponse, formatBeliefsForMCP, stringifyMCP } from './mcp-response.js';

export interface NARToolsOptions {
  jobs?: JobManager;
  /** Require approval for mutating tools (write_file). */
  approval?: boolean;
}

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

/** Drives the agent chat generator to completion, returning the final text. */
const chatToCompletion = async (agent: Agent, input: string): Promise<string> => {
  let result = '';
  for await (const event of agent.chat(input)) {
    if (event.kind === 'finish' || event.kind === 'aborted' || event.kind === 'error') {
      result = event.text ?? '';
    }
  }
  return result;
};

export function registerNARTools(
  server: McpServer,
  nar: NAR,
  agent: Agent,
  options?: NARToolsOptions
): void {
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
      return createMCPResponse(String(result), { result });
    }
  );

  // read_file and write_file are registered via registerNARRegistryTools from nar's tool registry
  // This avoids duplicate registration conflicts

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
      const structuredResults = formatBeliefsForMCP(results);
      return createMCPResponse(stringifyMCP(structuredResults), { results: structuredResults });
    }
  );

  server.registerTool(
    'run_reasoning',
    {
      title: 'Run Reasoning',
      description: 'Run NAL inference steps',
      inputSchema: { steps: z.number() },
      outputSchema: {
        derived: z.number(),
        beliefs: z.array(z.object({ term: z.string(), truth: z.any() })),
      },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ steps }) => {
      const derived = await nar.run(steps);
      const recentBeliefs = formatBeliefsForMCP(nar.getBeliefs().slice(-10));
      return createMCPResponse(stringifyMCP({ derived, beliefs: recentBeliefs }), {
        derived,
        beliefs: recentBeliefs,
      });
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
      return createMCPResponse(`Added belief: ${belief}`, { added: belief });
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
      const result = await nar.tools.execute('explain', { term });
      const derivation = result.success
        ? stringifyMCP(result.content)
        : (result.error ?? 'Explain failed');
      return createMCPResponse(`Derivation for ${term}: ${derivation}`, { term, derivation });
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
      const result = await chatToCompletion(agent, input);
      return createMCPResponse(result, { response: result });
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
      const result = await chatToCompletion(agent, input);
      return createMCPResponse(result, { response: result });
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
      return createMCPResponse('Belief added successfully', { success: true });
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
      return createMCPResponse(stringifyMCP(result), result as unknown as Record<string, unknown>);
    }
  );

  server.registerTool(
    'agent_know',
    {
      title: 'Agent Know',
      description: 'Store or retrieve knowledge',
      inputSchema: { key: z.string(), value: z.string().optional() },
      outputSchema: {
        key: z.string(),
        value: z.string().optional(),
        stored: z.boolean().optional(),
      },
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
        return createMCPResponse(`Stored: ${key} = ${value}`, { key, value, stored: true });
      }
      const result = agent.knowGet?.(key);
      return createMCPResponse(stringifyMCP({ key, value: result }), {
        key,
        value: result,
        stored: false,
      });
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
      const rule = nar.getProcessor().getLMRule(id);
      if (!rule) {
        return createMCPResponse(`LM rule not found: ${id}`, { enabled: false, id });
      }
      rule.enable();
      return createMCPResponse(`Enabled LM rule: ${id}`, { enabled: true, id });
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
      const rule = nar.getProcessor().getLMRule(id);
      if (!rule) {
        return createMCPResponse(`LM rule not found: ${id}`, { disabled: false, id });
      }
      rule.disable();
      return createMCPResponse(`Disabled LM rule: ${id}`, { disabled: true, id });
    }
  );

  server.registerTool(
    'list_lm_rules',
    {
      title: 'List LM Rules',
      description: 'List LM rules with their enablement state and stats',
      inputSchema: {},
      outputSchema: { rules: z.array(z.any()) },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const rules = nar.getProcessor().getLmRuleStats();
      return createMCPResponse(stringifyMCP({ rules }), { rules });
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
      const result = await nar.tools.execute('explain', {
        term,
        includeDerivations: type !== 'goal',
      });
      const explanation = result.success
        ? stringifyMCP(result.content)
        : (result.error ?? 'Explain failed');
      return createMCPResponse(`Explanation for ${term} (${type ?? 'belief'}): ${explanation}`, {
        term,
        type: type ?? 'belief',
        explanation,
      } as Record<string, unknown>);
    }
  );

  server.registerTool(
    'agent_goal_progress',
    {
      title: 'Agent Goal Progress',
      description: 'Get goal progress or list active goals',
      inputSchema: { goalId: z.string().optional() },
      outputSchema: { goals: z.array(z.object({ goalId: z.string(), progress: z.number() })) },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ goalId }) => {
      const goalsList = nar.getGoals();
      // progress = best matching belief truth (f·c): a goal is "achieved" when
      // symbolic inference has admitted a belief with the same term.
      const estimate = (term: string): number => {
        let best = 0;
        for (const b of nar.getBeliefs()) {
          if (String(b.term) === term) {
            const f = b.truth?.f ?? 0;
            const c = b.truth?.c ?? 0;
            best = Math.max(best, f * c);
          }
        }
        return best;
      };
      if (goalId) {
        const goal = goalsList.find((g) => String(g.term) === goalId);
        if (!goal) return createMCPResponse(`Unknown goal: ${goalId}`, { goalId, progress: 0 });
        const goals = [{ goalId, progress: estimate(goalId) }];
        return createMCPResponse(stringifyMCP({ goals }), { goals });
      }
      const goals = goalsList.map((g) => ({
        goalId: String(g.term),
        progress: estimate(String(g.term)),
      }));
      return createMCPResponse(stringifyMCP({ goals }), { goals });
    }
  );

  server.registerTool(
    'routing_reset',
    {
      title: 'Reset Routing Demotions',
      description: 'Clear session-level routing demotions so all candidates rank normally again',
      inputSchema: {},
      outputSchema: { reset: z.boolean() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      resetDemotions();
      return createMCPResponse('Routing demotions cleared', { reset: true });
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
      const beliefs = formatBeliefsForMCP(nar.getBeliefs());
      return createMCPResponse(stringifyMCP(beliefs), { beliefs });
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
      return createMCPResponse(stringifyMCP(report), report);
    }
  );

  server.registerTool(
    'run_job',
    {
      title: 'Run Job',
      description:
        'Start a fire-and-forget background job. Kinds: nar-cycles (run NAR inference steps), belief (add a belief), question (queue a question)',
      inputSchema: {
        kind: z.enum(['nar-cycles', 'belief', 'question']),
        steps: z.number().int().positive().max(10_000).optional(),
        content: z.string().optional(),
      },
      outputSchema: { jobId: z.string() },
      annotations: {
        readOnlyHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ kind, steps, content }) => {
      const jobs = options?.jobs;
      if (!jobs)
        return createMCPResponse('Job manager unavailable', { error: 'jobs not available' });
      const runFn = (): Promise<unknown> | unknown => {
        switch (kind) {
          case 'nar-cycles':
            return nar.run(steps ?? 10);
          case 'question':
            if (!content) throw new Error('run_job kind=question requires content');
            return nar.question(content);
          default:
            if (!content) throw new Error('run_job kind=belief requires content');
            return nar.believe(content);
        }
      };
      const id = jobs.submit(kind, runFn);
      return createMCPResponse(`Job ${id} started (${kind})`, { jobId: id });
    }
  );

  server.registerTool(
    'job_status',
    {
      title: 'Job Status',
      description: 'Get the status/result of a background job (or all jobs)',
      inputSchema: { jobId: z.string().optional() },
      outputSchema: z.any(),
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ jobId }) => {
      const jobs = options?.jobs;
      if (!jobs)
        return createMCPResponse('Job tracking not available', { error: 'jobs not available' });
      if (jobId) {
        const job = jobs.get(jobId);
        if (!job) return createMCPResponse(`Unknown job: ${jobId}`, { error: 'unknown job id' });
        return createMCPResponse(stringifyMCP(job), job as unknown as Record<string, unknown>);
      }
      return createMCPResponse(stringifyMCP({ jobs: jobs.list() }), {
        jobs: jobs.list() as unknown as Record<string, unknown>,
      });
    }
  );

  registerNARRegistryTools(server, nar);
}
