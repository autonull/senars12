import { tool } from 'ai';
import { z } from 'zod';

export interface AgentToolDeps {
  know: (key: string, value: string) => void;
  knowGet: (key: string) => string | undefined;
  knowList: () => Array<{ key: string; value: string }>;
  recall: (
    query?: string,
    limit?: number
  ) => Promise<Array<{ timestamp: number; type: string; content: string }>>;
  setInstructions?: (mode: 'append' | 'replace', instructions: string) => void;
  getSessionInfo?: () => {
    messageCount: number;
    createdAt: number;
    pinnedBeliefs: string[];
  };
}

export function buildAgentTools(deps: AgentToolDeps): Record<string, unknown> {
  return {
    know: tool({
      description:
        'Store a key-value pair in persistent knowledge. Use for explicit facts the user wants remembered.',
      inputSchema: z.object({
        key: z
          .string()
          .describe('A short, descriptive key (e.g., "project-goals", "user-preferences")'),
        value: z.string().describe('The knowledge to store'),
      }),
      execute: ({ key, value }) => {
        deps.know(key, value);
        return { stored: true, key };
      },
    }),

    know_get: tool({
      description: 'Retrieve a value by key from the knowledge store.',
      inputSchema: z.object({
        key: z.string().describe('The key to look up'),
      }),
      execute: ({ key }) => {
        const value = deps.knowGet(key);
        return value !== undefined ? { found: true, key, value } : { found: false, key };
      },
    }),

    know_list: tool({
      description: 'List all stored knowledge entries.',
      inputSchema: z.object({}),
      execute: () => ({ entries: deps.knowList() }),
    }),

    recall: tool({
      description:
        'Search episodic memory for past interactions. Returns matching episodes with timestamps.',
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe('Search query to filter episodes (case-insensitive substring match)'),
        limit: z.number().optional().default(10).describe('Maximum number of episodes to return'),
      }),
      execute: ({ query, limit }) => deps.recall(query, limit),
    }),

    agent_instruct: tool({
      description:
        "Update the agent's system instructions for the remainder of this session. Use when the user establishes a new persistent rule for how to respond.",
      inputSchema: z.object({
        instructions: z.string().describe('New or additional instructions to apply.'),
        mode: z
          .enum(['append', 'replace'])
          .optional()
          .default('append')
          .describe('Whether to append to or replace the existing instructions.'),
      }),
      execute: ({ instructions, mode }) => {
        if (!deps.setInstructions)
          return { error: 'setInstructions hook not available in this context' };
        deps.setInstructions(mode, instructions);
        return { applied: true, mode, length: instructions.length };
      },
    }),

    get_session_info: tool({
      description: 'Get the current session metadata: message count, age, pinned beliefs.',
      inputSchema: z.object({}),
      execute: () => {
        if (!deps.getSessionInfo) return { error: 'session info not available' };
        const info = deps.getSessionInfo();
        return {
          messageCount: info.messageCount,
          createdAt: info.createdAt,
          ageMs: Date.now() - info.createdAt,
          pinnedBeliefs: info.pinnedBeliefs,
        };
      },
    }),
  };
}
