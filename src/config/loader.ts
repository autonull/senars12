import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import type { AppConfig } from './schema.js';
import { appConfigSchema } from './schema.js';
import { readEnvOverrides } from '@senars/util/config';

export type { AppConfig, BotConfig, BotProfile, NarCoreConfig, LmConfig } from './schema.js';

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
  const merged = { ...raw, ...readEnvOverrides() };
  return appConfigSchema.parse(merged);
};

export const loadConfigFromEnv = async (): Promise<AppConfig> => {
  return appConfigSchema.parse(readEnvOverrides());
};

export const deepMergeConfig = deepMerge;
