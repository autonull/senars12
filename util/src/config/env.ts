/**
 * Standardized `SENARS_*` environment variable → config path mapping.
 * Single source of truth for env-driven configuration overrides.
 * @public
 */

export const SENARS_ENV_MAP: Readonly<Record<string, string>> = {
  SENARS_LM_ENABLED: 'capabilities.lm.enabled',
  SENARS_LM_PROVIDER: 'capabilities.lm.provider',
  SENARS_LM_MODEL: 'capabilities.lm.model',
  SENARS_SENARS_ENABLED: 'capabilities.senars.enabled',
  SENARS_REASONING_AUTO_TRIGGER: 'bot.reasoning.autoTrigger',
  SENARS_REASONING_TRIGGER_THRESHOLD: 'bot.reasoning.triggerThreshold',
  SENARS_STREAMING_ENABLED: 'bot.streaming.enabled',
  SENARS_TUI_COLORS: 'bot.tui.colors',
  SENARS_TUI_TYPING_INDICATOR: 'bot.tui.typingIndicator',
} as const;

export function parseEnvValue(value: string): unknown {
  if (value.toLowerCase() === 'true' || value === '1') return true;
  if (value.toLowerCase() === 'false' || value === '0') return false;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return value;
}

export function readEnvOverrides(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [envKey, configPath] of Object.entries(SENARS_ENV_MAP)) {
    const envValue = env[envKey];
    if (envValue !== undefined) {
      setNested(out, configPath, parseEnvValue(envValue));
    }
  }
  return out;
}

function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (key === undefined) continue;
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1];
  if (lastKey !== undefined) {
    current[lastKey] = value;
  }
}
