import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { readEnvOverrides } from '@senars/util/config';
import {
  CURRENT_CONFIG_VERSION,
  type MigrationOutcome,
  migrateConfig,
} from '../utils/config-migrate.js';
import type { AppConfig } from './schema.js';
import { appConfigSchema } from './schema.js';

export type { AppConfig, BotConfig, BotProfile, LmConfig, NarCoreConfig } from './schema.js';

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

const KNOWN_CONFIG_MAJOR = 2;

interface MigrationWarning {
  fromVersion: string;
  toVersion: string;
  message: string;
}

const validateConfigVersion = (version: unknown): MigrationWarning | null => {
  if (typeof version !== 'string') {
    return {
      fromVersion: 'unknown (missing configVersion)',
      toVersion: CURRENT_CONFIG_VERSION,
      message:
        `Config file is missing "configVersion" field. Current version is ${CURRENT_CONFIG_VERSION}. ` +
        `Add "configVersion": "${CURRENT_CONFIG_VERSION}" to your config.`,
    };
  }
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  if (major > KNOWN_CONFIG_MAJOR) {
    return {
      fromVersion: version,
      toVersion: CURRENT_CONFIG_VERSION,
      message:
        `Config version "${version}" is newer than supported (${CURRENT_CONFIG_VERSION}). ` +
        `Some features may not work correctly.`,
    };
  }
  return null;
};

export const loadConfig = async (path?: string): Promise<AppConfig> => {
  let raw_config: Record<string, unknown> = {};
  const filePath = path ?? process.env.SENARS_CONFIG ?? 'senars.config.json';
  let outcome: MigrationOutcome | null = null;
  try {
    const absolutePath = resolve(process.cwd(), filePath);
    const content = await fs.readFile(absolutePath, 'utf-8');
    const raw = JSON.parse(content) as Record<string, unknown>;
    outcome = migrateConfig(raw);
    if (outcome.applied.length > 0) {
      console.warn(
        `[config] migrated ${filePath}: ${outcome.applied.join(', ')} (now configVersion ${outcome.config.configVersion})`
      );
      // Best-effort write-back so the on-disk format stays current.
      try {
        await fs.writeFile(absolutePath, `${JSON.stringify(outcome.config, null, 2)}\n`, 'utf-8');
      } catch {
        // Read-only location: migration stays in-memory for this run.
      }
    }
    raw_config = outcome.config;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      console.warn(
        `Failed to load config from ${filePath}: ${err.message}\nUsing default configuration`
      );
    }
  }
  const warning = validateConfigVersion(raw_config.configVersion);
  if (warning) {
    console.warn(`[config] ${warning.message}`);
  }
  const merged = { ...raw_config, ...readEnvOverrides() };
  // Ensure configVersion is set in the parsed result
  if (!merged.configVersion) {
    merged.configVersion = CURRENT_CONFIG_VERSION;
  }
  return appConfigSchema.parse(merged);
};

export const loadConfigFromEnv = async (): Promise<AppConfig> => {
  return appConfigSchema.parse(readEnvOverrides());
};

export const deepMergeConfig = deepMerge;

export { CURRENT_CONFIG_VERSION };
