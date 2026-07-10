import type { AgentSectionConfig } from '../../../src/config';
import type { ConnectionConfig } from '@senars/io';
import type { AgentOptions } from './agent.js';

// Re-export schema + validation from @senars/core
export {
  agentOptionsSchema,
  validateAgentOptions,
  AgentOptionsValidationError,
  contextOptsSchema,
} from '@senars/core/options';
export type { ValidatedAgentOptions } from '@senars/core/options';

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
  const n = Number.parseInt(v, 10);
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
          .map((s) => s.trim())
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
