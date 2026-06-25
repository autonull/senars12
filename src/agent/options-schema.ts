import {z} from 'zod';

const contextOptsSchema = z.object({
    attention: z.union([z.boolean(), z.array(z.string())]).optional(),
    beliefs: z.union([z.boolean(), z.array(z.string())]).optional(),
    goals: z.union([z.boolean(), z.array(z.string())]).optional(),
    questions: z.union([z.boolean(), z.array(z.string())]).optional(),
    concepts: z.union([z.boolean(), z.array(z.string())]).optional(),
    maxItems: z.number().int().positive().optional(),
    recency: z.number().int().min(0).optional(),
}).strict().partial();

export const agentOptionsSchema = z.object({
    nar: z.unknown().optional(),
    lmClient: z.unknown().optional(),
    episodicMemory: z.unknown().optional(),
    systemInstructions: z.string().min(1).max(16_000).optional(),
    context: contextOptsSchema.optional(),
    maxLoops: z.number().int().min(0).max(50).default(5),
    logger: z.unknown().optional(),
    persistKnowledge: z.boolean().default(false),
    knowledgePath: z.string().default('.cache/agent-knowledge.json'),
    workspaceRoot: z.string().optional(),
    externalTools: z.any().optional(),
    approvalManager: z.any().optional(),
    autonomyEngine: z.any().optional(),
    reasoningIntervalMs: z.number().int().min(0).optional(),
    sessionHistoryLimit: z.number().int().min(0).optional(),
    rateLimitPerMinute: z.number().int().min(0).optional(),
    enableNlTranslation: z.boolean().optional(),
    enableNarseseHumanization: z.boolean().optional(),
}).strict();

export type ValidatedAgentOptions = z.infer<typeof agentOptionsSchema>;

export class AgentOptionsValidationError extends Error {
    override name = 'AgentOptionsValidationError' as const;
    constructor(message: string, readonly issues: z.ZodIssue[]) {
        super(message);
    }
}

export const validateAgentOptions = (opts: unknown): ValidatedAgentOptions => {
    const result = agentOptionsSchema.safeParse(opts);
    if (!result.success) {
        throw new AgentOptionsValidationError(
            `Invalid AgentOptions: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
            result.error.issues,
        );
    }
    return result.data;
};

import type {AgentOptions} from './agent.js';
import type {AgentSectionConfig} from '../config/schema.js';
import type {ConnectionConfig} from '../io/types.js';

export const agentConfigToOptions = (config: AgentSectionConfig): Partial<AgentOptions> => {
    const out: Partial<AgentOptions> = {
        maxLoops: config.maxLoops,
        reasoningIntervalMs: config.reasoningIntervalMs,
        sessionHistoryLimit: config.sessionHistoryLimit,
        rateLimitPerMinute: config.rateLimitPerMinute,
        enableNlTranslation: config.enableNlTranslation,
        enableNarseseHumanization: config.enableNarseseHumanization,
    };
    if (config.systemInstructions) out.systemInstructions = config.systemInstructions;
    return out;
};

const DEFAULT_IRC_SERVER = 'irc.libera.chat';
const DEFAULT_IRC_PORT = 6697;
const DEFAULT_IRC_NICK = 'senars-bot';
const DEFAULT_IRC_CHANNELS = ['#senars'];
const DEFAULT_WS_PORT = 8765;
const DEFAULT_HTTP_PORT = 8080;
const DEFAULT_MCP_PORT = 8082;

const envFlag = (name: string, fallback: boolean): boolean => {
    const v = process.env[name];
    if (v === undefined || v === '') return fallback;
    return v.toLowerCase() !== 'false' && v !== '0';
};

const envInt = (name: string, fallback: number): number => {
    const v = process.env[name];
    if (!v) return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
};

export function createConnectionConfigsFromEnv(): ConnectionConfig[] {
    const configs: ConnectionConfig[] = [];

    if (envFlag('ENABLE_IRC', true)) {
        configs.push({
            id: 'irc-main',
            enabled: true,
            type: 'irc',
            config: {
                server: process.env.IRC_SERVER ?? DEFAULT_IRC_SERVER,
                port: envInt('IRC_PORT', DEFAULT_IRC_PORT),
                nick: process.env.IRC_NICK ?? DEFAULT_IRC_NICK,
                channels: (process.env.IRC_CHANNELS ?? DEFAULT_IRC_CHANNELS.join(','))
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean),
                tls: envFlag('IRC_TLS', true),
                sasl: envFlag('IRC_SASL', false),
                password: process.env.IRC_PASSWORD,
                username: process.env.IRC_USERNAME,
                realname: process.env.IRC_REALNAME,
            },
        });
    }

    if (envFlag('ENABLE_WS', true)) {
        configs.push({
            id: 'ws-main',
            enabled: true,
            type: 'websocket',
            config: {
                port: envInt('WS_PORT', DEFAULT_WS_PORT),
            },
        });
    }

    if (envFlag('ENABLE_HTTP', false)) {
        configs.push({
            id: 'http-main',
            enabled: true,
            type: 'http',
            config: {
                port: envInt('HTTP_PORT', DEFAULT_HTTP_PORT),
                apiKey: process.env.HTTP_API_KEY,
            },
        });
    }

    if (envFlag('ENABLE_MCP', false)) {
        configs.push({
            id: 'mcp-main',
            enabled: true,
            type: 'mcp',
            config: {
                port: envInt('MCP_PORT', DEFAULT_MCP_PORT),
            },
        });
    }

    return configs;
}

export const DEFAULT_PORTS = {
    irc: DEFAULT_IRC_PORT,
    ws: DEFAULT_WS_PORT,
    http: DEFAULT_HTTP_PORT,
    mcp: DEFAULT_MCP_PORT,
} as const;
