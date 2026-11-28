/**
 * Config migration utility (TODO20 C2).
 *
 * Registry of versioned transforms applied to `senars.config.json` when its
 * `configVersion` predates the current one. `migrateConfig` walks the chain;
 * `loadConfig` applies it automatically on start and writes the migrated file
 * back (best-effort) so the on-disk format stays current.
 */
import { promises as fs } from 'node:fs';
export declare const CURRENT_CONFIG_VERSION = "2.0";
type ConfigTransform = (config: Record<string, unknown>) => Record<string, unknown>;
/** Ordered migration chain: source major version → transform producing the next. */
export declare const MIGRATIONS: Readonly<Record<string, ConfigTransform>>;
export interface MigrationOutcome {
    config: Record<string, unknown>;
    /** Applied migration steps, e.g. ['1→2']. Empty when already current. */
    applied: string[];
    /** Human-readable reason when the version could not be migrated (newer/unknown). */
    blocked?: string;
}
/** Apply the migration chain until the config reaches the current major version. */
export declare const migrateConfig: (raw: Record<string, unknown>, currentVersion?: string) => MigrationOutcome;
/**
 * Read + migrate a config file in place (best-effort write-back).
 * Returns the migrated raw config for schema parsing.
 */
export declare const migrateConfigFile: (filePath: string, readFile?: typeof fs.readFile, writeFile?: typeof fs.writeFile) => Promise<MigrationOutcome>;
export {};
//# sourceMappingURL=config-migrate.d.ts.map