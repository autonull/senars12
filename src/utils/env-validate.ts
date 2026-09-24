import { createLogger } from '../../nar/src/logger';

const logger = createLogger({ scope: 'env:validate' });

const KNOWN_ENV_VARS = new Set([
  'LM_PROVIDER',
  'LM_MODEL',
  'LM_FAST_MODEL',
  'LM_STRUCTURED_MODEL',
  'LM_BASE_URL',
  'LM_API_KEY_ENV',
  'LM_LLAMACPP_MODEL',
  'LM_LLAMACPP_GPU',
  'LM_LLAMACPP_GPU_LAYERS',
  'LM_LLAMACPP_CTX',
  'LM_LLAMACPP_BATCH',
  'LM_LLAMACPP_SEQS',
  'LM_LLAMACPP_FLASH_ATTN',
  'OLLAMA_HOST',
  'OLLAMA_MODEL',
  'EPISODIC_MEMORY_PATH',
  'EPISODIC_RETENTION_DAYS',
  'AGENT_INSTRUCTIONS',
  'AUTO_TRIGGER_REASONING',
  'REASONING_THRESHOLD',
  'REASONING_COOLDOWN',
  'MAX_REASONING_STEPS',
  'SENARS_AUTONOMY_BROADCAST',
  'SENARS_MCP_ENABLED',
  'SENARS_MCP_TRANSPORT',
  'SENARS_IRC_ENABLED',
  'SENARS_IRC_SERVER',
  'SENARS_IRC_PORT',
  'SENARS_IRC_NICK',
  'SENARS_IRC_CHANNELS',
  'SENARS_IRC_AUTH_SECRET',
  'SENARS_WS_ENABLED',
  'SENARS_WS_PORT',
  'SENARS_HTTP_ENABLED',
  'SENARS_HTTP_PORT',
  'SENARS_HISTFILE',
  'SENARS_CONFIG',
  'SENARS_CLI_ENABLED',
  'SENARS_LM_ENABLED',
  'SENARS_LM_PROVIDER',
  'SENARS_LM_MODEL',
  'SENARS_SENARS_ENABLED',
  'SENARS_REASONING_AUTO_TRIGGER',
  'SENARS_REASONING_TRIGGER_THRESHOLD',
  'SENARS_STREAMING_ENABLED',
  'SENARS_TUI_COLORS',
  'SENARS_TUI_TYPING_INDICATOR',
  'DEBUG',
  'NODE_ENV',
  'NODE_NO_WARNINGS',
  'NODE_OPTIONS',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'LM_API_KEY',
  'LM_OFFLINE',
  'LM_PROFILE',
  'BOT_CLI_ONLY',
  'ENABLE_IRC',
  'ENABLE_WS',
  'ENABLE_HTTP',
  'ENABLE_MCP',
  'ENABLE_WEB_UI',
]);

const NUMERIC_ENV_VARS: Record<string, (v: string) => number> = {
  EPISODIC_RETENTION_DAYS: (v) => Number.parseInt(v, 10),
  REASONING_THRESHOLD: (v) => Number.parseFloat(v),
  REASONING_COOLDOWN: (v) => Number.parseInt(v, 10),
  MAX_REASONING_STEPS: (v) => Number.parseInt(v, 10),
  SENARS_IRC_PORT: (v) => Number.parseInt(v, 10),
  SENARS_WS_PORT: (v) => Number.parseInt(v, 10),
  SENARS_HTTP_PORT: (v) => Number.parseInt(v, 10),
  SENARS_REASONING_TRIGGER_THRESHOLD: (v) => Number.parseFloat(v),
  LM_LLAMACPP_GPU_LAYERS: (v) => Number.parseInt(v, 10),
  LM_LLAMACPP_CTX: (v) => Number.parseInt(v, 10),
  LM_LLAMACPP_BATCH: (v) => Number.parseInt(v, 10),
  LM_LLAMACPP_SEQS: (v) => Number.parseInt(v, 10),
};

const BOOLEAN_ENV_VARS = new Set([
  'AUTO_TRIGGER_REASONING',
  'SENARS_AUTONOMY_BROADCAST',
  'SENARS_MCP_ENABLED',
  'SENARS_IRC_ENABLED',
  'SENARS_WS_ENABLED',
  'SENARS_HTTP_ENABLED',
  'SENARS_LM_ENABLED',
  'SENARS_SENARS_ENABLED',
  'SENARS_REASONING_AUTO_TRIGGER',
  'SENARS_STREAMING_ENABLED',
  'SENARS_TUI_COLORS',
  'SENARS_TUI_TYPING_INDICATOR',
  'LM_LLAMACPP_FLASH_ATTN',
  'LM_OFFLINE',
  'BOT_CLI_ONLY',
  'ENABLE_IRC',
  'ENABLE_WS',
  'ENABLE_HTTP',
  'ENABLE_MCP',
  'ENABLE_WEB_UI',
]);

export interface ValidationResult {
  readonly unknown: ReadonlyArray<string>;
  readonly mistyped: ReadonlyArray<{ name: string; reason: string }>;
}

export const validateEnv = (): ValidationResult => {
  const unknown: string[] = [];
  const mistyped: { name: string; reason: string }[] = [];

  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (
      !name.startsWith('SENARS_') &&
      !name.startsWith('LM_') &&
      !name.startsWith('OLLAMA_') &&
      !name.startsWith('EPISODIC_') &&
      !name.startsWith('AGENT_') &&
      !name.startsWith('AUTO_') &&
      !name.startsWith('REASONING_') &&
      !name.startsWith('MAX_') &&
      name !== 'DEBUG'
    ) {
      continue;
    }
    if (!KNOWN_ENV_VARS.has(name)) {
      unknown.push(name);
      continue;
    }
    if (NUMERIC_ENV_VARS[name]) {
      const parsed = NUMERIC_ENV_VARS[name](value);
      if (Number.isNaN(parsed)) {
        mistyped.push({ name, reason: `expected number, got "${value}"` });
      }
    } else if (BOOLEAN_ENV_VARS.has(name)) {
      if (value !== 'true' && value !== 'false' && value !== '1' && value !== '0') {
        mistyped.push({ name, reason: `expected boolean (true/false/1/0), got "${value}"` });
      }
    }
  }

  return { unknown, mistyped };
};

export const assertValidEnv = (): void => {
  const { unknown, mistyped } = validateEnv();
  for (const name of unknown) {
    logger.warn(`Unknown env var: ${name}`);
  }
  for (const { name, reason } of mistyped) {
    logger.error(`Mis-typed env var: ${name} — ${reason}`);
  }
  if (mistyped.length > 0) {
    process.exit(1);
  }
};
