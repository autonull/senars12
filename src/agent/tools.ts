import {z} from 'zod';
import {tool} from 'ai';

export interface AgentToolDeps {
    know: (key: string, value: string) => void;
    knowGet: (key: string) => string | undefined;
    knowList: () => Array<{key: string; value: string}>;
    recall: (query?: string, limit?: number) => Promise<Array<{timestamp: number; type: string; content: string}>>;
}

export function buildAgentTools(deps: AgentToolDeps): Record<string, unknown> {
    return {
        know: tool({
            description: 'Store a key-value pair in persistent knowledge. Use for explicit facts the user wants remembered.',
            inputSchema: z.object({
                key: z.string().describe('A short, descriptive key (e.g., "project-goals", "user-preferences")'),
                value: z.string().describe('The knowledge to store'),
            }),
            execute: ({key, value}) => {
                deps.know(key, value);
                return {stored: true, key};
            },
        }),

        know_get: tool({
            description: 'Retrieve a value by key from the knowledge store.',
            inputSchema: z.object({
                key: z.string().describe('The key to look up'),
            }),
            execute: ({key}) => {
                const value = deps.knowGet(key);
                return value !== undefined ? {found: true, key, value} : {found: false, key};
            },
        }),

        know_list: tool({
            description: 'List all stored knowledge entries.',
            inputSchema: z.object({}),
            execute: () => ({entries: deps.knowList()}),
        }),

        recall: tool({
            description: 'Search episodic memory for past interactions. Returns matching episodes with timestamps.',
            inputSchema: z.object({
                query: z.string().optional().describe('Search query to filter episodes (case-insensitive substring match)'),
                limit: z.number().optional().default(10).describe('Maximum number of episodes to return'),
            }),
            execute: ({query, limit}) => deps.recall(query, limit),
        }),
    };
}
