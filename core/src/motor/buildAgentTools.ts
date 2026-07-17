import { z } from 'zod';
import type { AgentToolDeps } from '../memory/types.js';

export function buildAgentTools(deps: AgentToolDeps): Record<string, unknown> {
  return {
    know: {
      inputSchema: z.object({ key: z.string(), value: z.string() }),
      execute: (args: { key: string; value: string }) => {
        deps.know(args.key, args.value);
        return { stored: true, key: args.key };
      },
    },
    know_get: {
      inputSchema: z.object({ key: z.string() }),
      execute: (args: { key: string }) => {
        const value = deps.knowGet(args.key);
        return value !== undefined ? { found: true, value } : { found: false };
      },
    },
    know_list: {
      inputSchema: z.object({}),
      execute: () => {
        const entries = deps.knowList();
        return { entries };
      },
    },
    recall: {
      inputSchema: z.object({ query: z.string().optional(), limit: z.number().optional() }),
      execute: async (args: { query?: string; limit?: number }): Promise<unknown[]> => {
        return deps.recall(args.query, args.limit);
      },
    },
    agent_instruct: {
      inputSchema: z.object({ mode: z.enum(['append', 'replace']), instructions: z.string() }),
      execute: async (args: { mode: 'append' | 'replace'; instructions: string }) => {
        if (deps.setInstructions) deps.setInstructions(args.mode, args.instructions);
        return { ok: true, mode: args.mode };
      },
    },
    get_session_info: {
      inputSchema: z.object({}),
      execute: async () => {
        if (deps.getSessionInfo) return deps.getSessionInfo();
        return { messageCount: 0, createdAt: 0, pinnedBeliefs: [] };
      },
    },
  };
}
