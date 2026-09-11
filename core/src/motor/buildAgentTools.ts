import {z} from 'zod';
import type {AgentToolDeps} from '../memory/types.js';
import type {ToolRegistry, ToolSpec} from './ToolRegistry.js';

const AGENT_TOOL_SPECS = (deps: AgentToolDeps): ToolSpec[] => [
    {
        name: 'know',
        description: 'Store a key-value fact in agent memory',
        inputSchema: {
            type: 'object',
            properties: {key: {type: 'string'}, value: {type: 'string'}},
            required: ['key', 'value'],
        },
        execute: async (args) => {
            const {key, value} = args as { key: string; value: string };
            deps.know(key, value);
            return {success: true, content: {stored: true, key}};
        },
    },
    {
        name: 'know_get',
        description: 'Retrieve a value from agent memory by key',
        inputSchema: {
            type: 'object',
            properties: {key: {type: 'string'}},
            required: ['key'],
        },
        execute: async (args) => {
            const value = deps.knowGet((args as { key: string }).key);
            return {success: true, content: value !== undefined ? {found: true, value} : {found: false}};
        },
    },
    {
        name: 'know_list',
        description: 'List all entries in agent memory',
        inputSchema: {type: 'object', properties: {}},
        execute: async () => ({success: true, content: {entries: deps.knowList()}}),
    },
    {
        name: 'recall',
        description: 'Recall episodic memories matching an optional query',
        inputSchema: {
            type: 'object',
            properties: {query: {type: 'string'}, limit: {type: 'number'}},
        },
        execute: async (args) => {
            const {query, limit} = args as { query?: string; limit?: number };
            return {success: true, content: await deps.recall(query, limit)};
        },
    },
    {
        name: 'agent_instruct',
        description: 'Append or replace agent instructions',
        inputSchema: {
            type: 'object',
            properties: {
                mode: {type: 'string', enum: ['append', 'replace']},
                instructions: {type: 'string'},
            },
            required: ['mode', 'instructions'],
        },
        execute: async (args) => {
            const {mode, instructions} = args as { mode: 'append' | 'replace'; instructions: string };
            deps.setInstructions?.(mode, instructions);
            return {success: true, content: {ok: true, mode}};
        },
    },
    {
        name: 'get_session_info',
        description: 'Get current session info',
        inputSchema: {type: 'object', properties: {}},
        execute: async () => ({
            success: true,
            content: deps.getSessionInfo?.() ?? {messageCount: 0, createdAt: 0, pinnedBeliefs: []},
        }),
    },
];

export function registerAgentTools(motor: ToolRegistry, deps: AgentToolDeps): void {
    for (const spec of AGENT_TOOL_SPECS(deps)) {
        if (!motor.get(spec.name)) motor.register(spec);
    }
}

export function buildAgentTools(deps: AgentToolDeps): Record<string, unknown> {
    return {
        know: {
            inputSchema: z.object({key: z.string(), value: z.string()}),
            execute: (args: { key: string; value: string }) => {
                deps.know(args.key, args.value);
                return {stored: true, key: args.key};
            },
        },
        know_get: {
            inputSchema: z.object({key: z.string()}),
            execute: (args: { key: string }) => {
                const value = deps.knowGet(args.key);
                return value !== undefined ? {found: true, value} : {found: false};
            },
        },
        know_list: {
            inputSchema: z.object({}),
            execute: () => {
                const entries = deps.knowList();
                return {entries};
            },
        },
        recall: {
            inputSchema: z.object({query: z.string().optional(), limit: z.number().optional()}),
            execute: async (args: { query?: string; limit?: number }): Promise<unknown[]> => {
                return deps.recall(args.query, args.limit);
            },
        },
        agent_instruct: {
            inputSchema: z.object({mode: z.enum(['append', 'replace']), instructions: z.string()}),
            execute: async (args: { mode: 'append' | 'replace'; instructions: string }) => {
                if (deps.setInstructions) deps.setInstructions(args.mode, args.instructions);
                return {ok: true, mode: args.mode};
            },
        },
        get_session_info: {
            inputSchema: z.object({}),
            execute: async () => {
                if (deps.getSessionInfo) return deps.getSessionInfo();
                return {messageCount: 0, createdAt: 0, pinnedBeliefs: []};
            },
        },
    };
}
