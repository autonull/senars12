/**
 * Unified environment variable configuration for all bins.
 * Single source of truth for all `process.env` reads in bin entry points.
 */

export interface EpisodicConfig {
  memoryPath: string;
  retentionDays: number;
}

export interface AuthConfig {
  secret: string | undefined;
  connectionIds: string[];
}

export interface IRCConfig {
  server: string;
  channels: string[];
  nick: string;
  port: number;
  authSecret: string | undefined;
}

export interface WSConfig {
  enabled: boolean;
  port: number;
}

export interface HTTPConfig {
  enabled: boolean;
  port: number;
}

export interface MCPConfig {
  enabled: boolean;
  transport: string;
}

export interface LMEnvConfig {
  provider: string;
  model: string | undefined;
  ollamaHost: string;
  ollamaModel: string | undefined;
}

export interface AppEnvConfig {
  enableWebUI: boolean;
  histfile: string;
}

export interface BinEnvConfig {
  episodic: EpisodicConfig;
  auth: AuthConfig;
  irc: IRCConfig;
  ws: WSConfig;
  http: HTTPConfig;
  mcp: MCPConfig;
  lm: LMEnvConfig;
  app: AppEnvConfig;
}

export function readEpisodicConfig(): EpisodicConfig {
  return {
    memoryPath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
    retentionDays: Number.parseInt(process.env.EPISODIC_RETENTION_DAYS || '30', 10),
  };
}

export function readAuthConfig(): AuthConfig {
  return {
    secret: process.env.AUTH_SECRET,
    connectionIds: (process.env.AUTH_CONNECTION_IDS ?? 'irc-main,http-main,ws-main')
      .split(',')
      .map((s) => s.trim()),
  };
}

export function readIRCConfig(): IRCConfig {
  return {
    server: process.env.IRC_SERVER ?? process.env.SENARS_IRC_SERVER ?? 'irc.libera.chat',
    channels: (process.env.IRC_CHANNELS ?? process.env.SENARS_IRC_CHANNELS ?? '#senars')
      .split(',')
      .map((s) => s.trim()),
    nick: process.env.SENARS_IRC_NICK ?? 'senars-bot',
    port: Number.parseInt(process.env.SENARS_IRC_PORT || '6697', 10),
    authSecret: process.env.SENARS_IRC_AUTH_SECRET,
  };
}

export function readWSConfig(): WSConfig {
  return {
    enabled: (process.env.ENABLE_WS ?? 'true') !== 'false',
    port: Number.parseInt((process.env.WS_PORT ?? process.env.SENARS_WS_PORT) || '8765', 10),
  };
}

export function readHTTPConfig(): HTTPConfig {
  return {
    enabled: (process.env.ENABLE_HTTP ?? 'false') === 'true',
    port: Number.parseInt((process.env.HTTP_PORT ?? process.env.SENARS_HTTP_PORT) || '3000', 10),
  };
}

export function readMCPConfig(): MCPConfig {
  return {
    enabled: (process.env.ENABLE_MCP ?? 'false') === 'true',
    transport: process.env.MCP_TRANSPORT ?? process.env.SENARS_MCP_TRANSPORT ?? 'stdio',
  };
}

export function readLMEnvConfig(): LMEnvConfig {
  return {
    provider: process.env.LM_PROVIDER ?? process.env.SENARS_LM_PROVIDER ?? 'transformers',
    model: process.env.LM_MODEL ?? process.env.SENARS_LM_MODEL,
    ollamaHost: process.env.OLLAMA_HOST ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL,
  };
}

export function readAppEnvConfig(): AppEnvConfig {
  return {
    enableWebUI: process.env.ENABLE_WEB_UI === 'true',
    histfile: process.env.SENARS_HISTFILE || '/tmp/senars_history',
  };
}

export function readAllEnvConfig(): BinEnvConfig {
  return {
    episodic: readEpisodicConfig(),
    auth: readAuthConfig(),
    irc: readIRCConfig(),
    ws: readWSConfig(),
    http: readHTTPConfig(),
    mcp: readMCPConfig(),
    lm: readLMEnvConfig(),
    app: readAppEnvConfig(),
  };
}
