import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import type { AppConfig } from './schema.js';
import { appConfigSchema } from './schema.js';

export type { AppConfig, BotConfig, BotProfile, NarCoreConfig, LmConfig } from './schema.js';

const envConfig = {
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

function parseEnvValue(key: string, value: string): unknown {
  if (value.toLowerCase() === 'true' || value === '1') return true;
  if (value.toLowerCase() === 'false' || value === '0') return false;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return value;
}

function applyEnvOverrides(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };

  for (const [envKey, configPath] of Object.entries(envConfig)) {
    const envValue = process.env[envKey];
    if (envValue !== undefined) {
      setNested(out, configPath, parseEnvValue(envKey, envValue));
    }
  }

  return out;
}

const deepMerge = <T>(defaults: T, overrides: Partial<T> | undefined): T => {
  if (!overrides) return defaults;
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [k, v] of Object.entries(overrides as Record<string, unknown>)) {
    const cur = out[k];
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      cur &&
      typeof cur === 'object' &&
      !Array.isArray(cur)
    ) {
      out[k] = deepMerge(cur, v as Record<string, unknown>);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
};

export const loadConfig = async (path?: string): Promise<AppConfig> => {
  let raw: Record<string, unknown> = {};
  const filePath = path ?? process.env.SENARS_CONFIG ?? 'senars.config.json';
  try {
    const absolutePath = resolve(process.cwd(), filePath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    raw = JSON.parse(content);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      console.warn(
        `Failed to load config from ${filePath}: ${err.message}\nUsing default configuration`
      );
    }
  }
  const merged = applyEnvOverrides(raw);
  return appConfigSchema.parse(merged);
};

export const loadConfigFromEnv = async (): Promise<AppConfig> => {
  return appConfigSchema.parse(applyEnvOverrides({}));
};

export const deepMergeConfig = deepMerge;
