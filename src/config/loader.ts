import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { readEnvOverrides } from '@senars/util/config';
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

const CURRENT_CONFIG_VERSION = '2.0';
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
  if (major !== KNOWN_CONFIG_MAJOR) {
    if (major < KNOWN_CONFIG_MAJOR) {
      return {
        fromVersion: version,
        toVersion: CURRENT_CONFIG_VERSION,
        message:
          `Config version "${version}" is outdated (current is ${CURRENT_CONFIG_VERSION}). ` +
          `Run with --migrate to attempt automatic migration (stub). ` +
          `See docs for migration guide.`,
      };
    }
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
  const warning = validateConfigVersion(raw.configVersion);
  if (warning) {
    console.warn(`[config] ${warning.message}`);
    if (warning.fromVersion !== 'unknown (missing configVersion)' && warning.fromVersion < CURRENT_CONFIG_VERSION) {
      console.warn('[config] Migration stub: run with SENARS_CONFIG_MIGRATE=1 to attempt migration (not implemented)');
    }
  }
  const merged = { ...raw, ...readEnvOverrides() };
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
