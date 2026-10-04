import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { deepMerge, envStrOr } from '@senars/util';
import { readEnvOverrides } from '@senars/util/config';
import {
  CURRENT_CONFIG_VERSION,
  type MigrationOutcome,
  migrateConfigFile,
} from '../utils/config-migrate.js';
import type { AppConfig } from './schema.js';
import { appConfigSchema } from './schema.js';

export type { AppConfig, BotConfig, BotProfile, LmConfig, NarCoreConfig } from './schema.js';

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
  const filePath = path ?? envStrOr('senars.config.json', 'SENARS_CONFIG');
  let outcome: MigrationOutcome | null = null;
  try {
    const absolutePath = resolve(process.cwd(), filePath);
    outcome = await migrateConfigFile(absolutePath, fs.readFile.bind(fs), fs.writeFile.bind(fs));
    if (outcome.applied.length > 0) {
      console.warn(
        `[config] migrated ${filePath}: ${outcome.applied.join(', ')} (now configVersion ${outcome.config.configVersion})`
      );
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
  // Env overrides arrive as nested objects (SENARS_ENV_MAP targets dotted paths),
  // so this must merge rather than replace: a flat spread would drop every
  // sibling of `capabilities.lm.*` that the file had configured.
  const merged = deepMerge(raw_config, readEnvOverrides());
  // Ensure configVersion is set in the parsed result
  if (!merged.configVersion) {
    merged.configVersion = CURRENT_CONFIG_VERSION;
  }
  return appConfigSchema.parse(merged);
};

export const loadConfigFromEnv = async (): Promise<AppConfig> => {
  return appConfigSchema.parse(readEnvOverrides());
};

export { CURRENT_CONFIG_VERSION };
