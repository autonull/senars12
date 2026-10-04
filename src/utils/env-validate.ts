import { createLogger } from '@senars/util';
import { isBooleanSpelling } from '@senars/util/config';

const logger = createLogger({ scope: 'env:validate' });

type EnvKind = 'string' | 'int' | 'number' | 'bool';

/**
 * The declared env grammar. One table answers both questions the validator asks —
 * "do we know this var" and "what shape must it have" — so a var cannot be known
 * without a kind, nor given a kind without being known. `int` additionally rejects
 * a fractional value, which the previous `parseInt` check floored into a pass.
 */
const ENV_VAR_KINDS: Record<string, EnvKind> = {
  LM_PROVIDER: 'string',
  LM_MODEL: 'string',
  LM_FAST_MODEL: 'string',
  LM_STRUCTURED_MODEL: 'string',
  LM_BASE_URL: 'string',
  LM_API_KEY_ENV: 'string',
  LM_LLAMACPP_MODEL: 'string',
  LM_LLAMACPP_GPU: 'string',
  LM_LLAMACPP_HOST: 'string',
  LM_LOCAL_MODEL: 'string',
  MCP_TRANSPORT: 'string',
  SHELL_ALLOWLIST: 'string',
  AUTH_SECRET: 'string',
  TAVILY_API_KEY: 'string',
  OLLAMA_HOST: 'string',
  OLLAMA_MODEL: 'string',
  EPISODIC_MEMORY_PATH: 'string',
  AGENT_INSTRUCTIONS: 'string',
  SENARS_MCP_TRANSPORT: 'string',
  SENARS_IRC_SERVER: 'string',
  SENARS_IRC_NICK: 'string',
  SENARS_IRC_CHANNELS: 'string',
  SENARS_IRC_AUTH_SECRET: 'string',
  SENARS_HISTFILE: 'string',
  SENARS_CONFIG: 'string',
  SENARS_LM_PROVIDER: 'string',
  SENARS_LM_MODEL: 'string',
  DEBUG: 'string',
  ANTHROPIC_API_KEY: 'string',
  OPENAI_API_KEY: 'string',
  LM_API_KEY: 'string',
  LM_PROFILE: 'string',

  EPISODIC_RETENTION_DAYS: 'int',
  REASONING_COOLDOWN: 'int',
  MAX_REASONING_STEPS: 'int',
  SENARS_IRC_PORT: 'int',
  SENARS_WS_PORT: 'int',
  SENARS_HTTP_PORT: 'int',
  LM_LLAMACPP_GPU_LAYERS: 'int',
  LM_LLAMACPP_CTX: 'int',
  LM_LLAMACPP_BATCH: 'int',
  LM_LLAMACPP_SEQS: 'int',

  REASONING_THRESHOLD: 'number',
  LM_MAX_SPEND_USD: 'number',
  SENARS_REASONING_TRIGGER_THRESHOLD: 'number',

  AUTO_TRIGGER_REASONING: 'bool',
  SENARS_AUTONOMY_BROADCAST: 'bool',
  SENARS_MCP_ENABLED: 'bool',
  SENARS_IRC_ENABLED: 'bool',
  SENARS_WS_ENABLED: 'bool',
  SENARS_HTTP_ENABLED: 'bool',
  SENARS_LM_ENABLED: 'bool',
  SENARS_SENARS_ENABLED: 'bool',
  SENARS_REASONING_AUTO_TRIGGER: 'bool',
  SENARS_STREAMING_ENABLED: 'bool',
  SENARS_TUI_COLORS: 'bool',
  SENARS_TUI_TYPING_INDICATOR: 'bool',
  SENARS_CLI_ENABLED: 'bool',
  LM_LLAMACPP_FLASH_ATTN: 'bool',
  LM_LLAMACPP_DEBUG: 'bool',
  SENARS_GAME_TRACE: 'bool',
  LM_OFFLINE: 'bool',
  BOT_CLI_ONLY: 'bool',
  ENABLE_IRC: 'bool',
  ENABLE_WS: 'bool',
  ENABLE_HTTP: 'bool',
  ENABLE_MCP: 'bool',
  ENABLE_WEB_UI: 'bool',
};

/** Only vars under these prefixes are ours to judge; the rest belong to the host. A
 *  prefix here claims the table below can answer for every var under it, which is
 *  why `ENABLE_` is listed: the transport gates are declared, so they are checked. */
const SCOPED_PREFIXES = [
  'SENARS_',
  'LM_',
  'OLLAMA_',
  'EPISODIC_',
  'AGENT_',
  'AUTO_',
  'REASONING_',
  'MAX_',
  'ENABLE_',
] as const;

const inScope = (name: string): boolean =>
  name === 'DEBUG' || SCOPED_PREFIXES.some((prefix) => name.startsWith(prefix));

const isNumeric = (kind: 'int' | 'number', value: string): boolean => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && (kind === 'number' || Number.isInteger(parsed));
};

export interface ValidationResult {
  readonly unknown: ReadonlyArray<string>;
  readonly mistyped: ReadonlyArray<{ name: string; reason: string }>;
}

/** Names sorted: the iteration source is the env table, whose order is whoever
 *  populated it — a shell, `--env-file`, a test that deletes and re-sets. A report
 *  that reorders between runs of the same config cannot be diffed. */
export const validateEnv = (): ValidationResult => {
  const unknown: string[] = [];
  const mistyped: { name: string; reason: string }[] = [];

  for (const [name, value] of Object.entries(process.env)) {
    if (value === undefined || !inScope(name)) continue;
    const kind = ENV_VAR_KINDS[name];
    if (kind === undefined) {
      unknown.push(name);
    } else if (kind === 'bool' && !isBooleanSpelling(value)) {
      mistyped.push({
        name,
        reason: `expected boolean (true/false/1/0/yes/no/on/off), got "${value}"`,
      });
    } else if ((kind === 'int' || kind === 'number') && !isNumeric(kind, value)) {
      mistyped.push({ name, reason: `expected ${kind}, got "${value}"` });
    }
  }

  return { unknown: unknown.sort(), mistyped: mistyped.sort((a, b) => a.name.localeCompare(b.name)) };
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
