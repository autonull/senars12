import { errMsg, toolError, toolOk } from '@senars/util';
import type { AgentToolDeps } from '../memory/types.js';
import type { ToolRegistry, ToolSpec } from './ToolRegistry.js';

const AGENT_TOOL_SPECS = (deps: AgentToolDeps): ToolSpec[] => [
  {
    name: 'know',
    description: 'Store a key-value fact in agent memory',
    parameters: {
      type: 'object',
      properties: { key: { type: 'string' }, value: { type: 'string' } },
      required: ['key', 'value'],
    },
    execute: async (args) => {
      const { key, value } = args as { key: string; value: string };
      deps.know(key, value);
      return toolOk({ stored: true, key });
    },
  },
  {
    name: 'know_get',
    description: 'Retrieve a value from agent memory by key',
    parameters: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
    },
    execute: async (args) => {
      const value = deps.knowGet((args as { key: string }).key);
      return toolOk(value !== undefined ? { found: true, value } : { found: false });
    },
  },
  {
    name: 'know_list',
    description: 'List all entries in agent memory',
    parameters: { type: 'object', properties: {} },
    execute: async () => toolOk({ entries: deps.knowList() }),
  },
  {
    name: 'recall',
    description: 'Recall episodic memories matching an optional query',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'number' } },
    },
    execute: async (args) => {
      const { query, limit } = args as { query?: string; limit?: number };
      return toolOk(await deps.recall(query, limit));
    },
  },
  {
    name: 'agent_instruct',
    description: 'Append or replace agent instructions',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['append', 'replace'] },
        instructions: { type: 'string' },
      },
      required: ['mode', 'instructions'],
    },
    execute: async (args) => {
      const { mode, instructions } = args as { mode: 'append' | 'replace'; instructions: string };
      deps.setInstructions?.(mode, instructions);
      return toolOk({ ok: true, mode });
    },
  },
  {
    name: 'get_session_info',
    description: 'Get current session info',
    parameters: { type: 'object', properties: {} },
    execute: async () =>
      toolOk(deps.getSessionInfo?.() ?? { messageCount: 0, createdAt: 0, pinnedBeliefs: [] }),
  },
  {
    name: 'delegate',
    description: 'Delegate a self-contained task to a short-lived sub-agent and return its result',
    parameters: {
      type: 'object',
      properties: { prompt: { type: 'string' } },
      required: ['prompt'],
    },
    execute: async (args) => {
      const { prompt } = args as { prompt: string };
      if (!deps.delegate) {
        return toolError('delegation not available in this context');
      }
      try {
        return toolOk({ result: await deps.delegate(prompt) });
      } catch (e) {
        return toolError(e);
      }
    },
  },
];

export function registerAgentTools(motor: ToolRegistry, deps: AgentToolDeps): void {
  for (const spec of AGENT_TOOL_SPECS(deps)) {
    if (!motor.get(spec.name)) motor.register(spec);
  }
}
