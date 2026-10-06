import { objectSpec, toolAttempt, toolError, toolOk } from '@senars/util';
import type { AgentToolDeps } from '../memory/types.js';
import type { ToolRegistry, ToolSpec } from './ToolRegistry.js';

const AGENT_TOOL_SPECS = (deps: AgentToolDeps): ToolSpec[] => [
  {
    name: 'know',
    description: 'Store a key-value fact in agent memory',
    parameters: objectSpec({ key: { type: 'string' }, value: { type: 'string' } }, 'key', 'value'),
    execute: async (args) => {
      const { key, value } = args as { key: string; value: string };
      deps.know(key, value);
      return toolOk({ stored: true, key });
    },
  },
  {
    name: 'know_get',
    description: 'Retrieve a value from agent memory by key',
    parameters: objectSpec({ key: { type: 'string' } }, 'key'),
    execute: async (args) => {
      const value = deps.knowGet((args as { key: string }).key);
      return toolOk(value !== undefined ? { found: true, value } : { found: false });
    },
  },
  {
    name: 'know_list',
    description: 'List all entries in agent memory',
    parameters: objectSpec({}),
    execute: async () => toolOk({ entries: deps.knowList() }),
  },
  {
    name: 'recall',
    description: 'Recall episodic memories matching an optional query',
    parameters: objectSpec({ query: { type: 'string' }, limit: { type: 'number' } }),
    execute: async (args) => {
      const { query, limit } = args as { query?: string; limit?: number };
      return toolOk(await deps.recall(query, limit));
    },
  },
  {
    name: 'agent_instruct',
    description: 'Append or replace agent instructions',
    parameters: objectSpec(
      {
        mode: { type: 'string', enum: ['append', 'replace'] },
        instructions: { type: 'string' },
      },
      'mode',
      'instructions'
    ),
    execute: async (args) => {
      const { mode, instructions } = args as { mode: 'append' | 'replace'; instructions: string };
      deps.setInstructions?.(mode, instructions);
      return toolOk({ ok: true, mode });
    },
  },
  {
    name: 'get_session_info',
    description: 'Get current session info',
    parameters: objectSpec({}),
    execute: async () =>
      toolOk(deps.getSessionInfo?.() ?? { messageCount: 0, createdAt: 0, pinnedBeliefs: [] }),
  },
  {
    name: 'delegate',
    description: 'Delegate a self-contained task to a short-lived sub-agent and return its result',
    parameters: objectSpec({ prompt: { type: 'string' } }, 'prompt'),
    execute: async (args) => {
      const { prompt } = args as { prompt: string };
      if (!deps.delegate) {
        return toolError('delegation not available in this context');
      }
      return toolAttempt(
        'Delegation failed',
        () => deps.delegate!(prompt),
        (result) => ({ result })
      );
    },
  },
];

export function registerAgentTools(motor: ToolRegistry, deps: AgentToolDeps): void {
  for (const spec of AGENT_TOOL_SPECS(deps)) {
    if (!motor.get(spec.name)) motor.register(spec);
  }
}
