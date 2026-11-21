/**
 * Config migration utility (TODO20 C2).
 *
 * Registry of versioned transforms applied to `senars.config.json` when its
 * `configVersion` predates the current one. `migrateConfig` walks the chain;
 * `loadConfig` applies it automatically on start and writes the migrated file
 * back (best-effort) so the on-disk format stays current.
 */

import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

export const CURRENT_CONFIG_VERSION = '2.0';

type ConfigTransform = (config: Record<string, unknown>) => Record<string, unknown>;

/** Ordered migration chain: source major version → transform producing the next. */
export const MIGRATIONS: Readonly<Record<string, ConfigTransform>> = {
  // v1 → v2: flat `model`/`provider` moved under `lm`; configVersion stamped.
  '1': (config) => {
    const { model, provider, ...rest } = config;
    const lm: Record<string, unknown> = {
      ...(typeof config.lm === 'object' && config.lm !== null ? config.lm : {}),
    };
    if (typeof model === 'string' && lm.model === undefined) lm.model = model;
    if (typeof provider === 'string' && lm.provider === undefined) lm.provider = provider;
    return { ...rest, ...(Object.keys(lm).length > 0 ? { lm } : {}) };
  },
};

export interface MigrationOutcome {
  config: Record<string, unknown>;
  /** Applied migration steps, e.g. ['1→2']. Empty when already current. */
  applied: string[];
  /** Human-readable reason when the version could not be migrated (newer/unknown). */
  blocked?: string;
}

const majorOf = (version: unknown): number | null => {
  if (typeof version !== 'string') return null;
  const major = Number.parseInt(version.split('.')[0] ?? '', 10);
  return Number.isNaN(major) ? null : major;
};

const CURRENT_MAJOR = majorOf(CURRENT_CONFIG_VERSION)!;

/** Apply the migration chain until the config reaches the current major version. */
export const migrateConfig = (
  raw: Record<string, unknown>,
  currentVersion = CURRENT_CONFIG_VERSION
): MigrationOutcome => {
  const config = { ...raw };
  const applied: string[] = [];
  let major = majorOf(config.configVersion);

  if (major === null) {
    // Missing/unparseable version: stamp and validate against current schema.
    config.configVersion = currentVersion;
    return { config, applied };
  }
  if (major > CURRENT_MAJOR) {
    return {
      config,
      applied,
      blocked: `configVersion "${config.configVersion}" is newer than supported (${currentVersion})`,
    };
  }

  while (major !== null && major < CURRENT_MAJOR) {
    const transform = MIGRATIONS[String(major)];
    if (!transform) {
      return { config, applied, blocked: `no migration path from config version ${major}` };
    }
    major += 1;
    const next = transform(config);
    next.configVersion = `${major}.0`;
    Object.assign(config, next);
    applied.push(`${major - 1}→${major}`);
  }
  return { config, applied };
};

/**
 * Read + migrate a config file in place (best-effort write-back).
 * Returns the migrated raw config for schema parsing.
 */
export const migrateConfigFile = async (
  filePath: string,
  readFile: typeof fs.readFile = fs.readFile.bind(fs),
  writeFile: typeof fs.writeFile = fs.writeFile.bind(fs)
): Promise<MigrationOutcome> => {
  const raw = JSON.parse(await readFile(resolve(filePath), 'utf-8')) as Record<string, unknown>;
  const outcome = migrateConfig(raw);
  if (outcome.applied.length > 0) {
    try {
      await writeFile(resolve(filePath), `${JSON.stringify(outcome.config, null, 2)}\n`, 'utf-8');
    } catch {
      // Read-only filesystem / permissions: migration stays in-memory for this run.
    }
  }
  return outcome;
};
