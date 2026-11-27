import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { deepMerge } from '@senars/util/object';
import { envStrOr } from '@senars/util/config';
import { readEnvOverrides } from './index';
import { CURRENT_CONFIG_VERSION, migrateConfigFile, } from '@senars/util/config-migrate';
import { appConfigSchema } from './schema';
import { createLogger } from '../util/logger';
const logger = createLogger({ scope: 'config:loader' });
const KNOWN_CONFIG_MAJOR = 2;
const validateConfigVersion = (version) => {
    if (typeof version !== 'string') {
        return {
            fromVersion: 'unknown (missing configVersion)',
            toVersion: CURRENT_CONFIG_VERSION,
            message: `Config file is missing "configVersion" field. Current version is ${CURRENT_CONFIG_VERSION}. ` +
                `Add "configVersion": "${CURRENT_CONFIG_VERSION}" to your config.`,
        };
    }
    const major = Number.parseInt(version.split('.')[0] ?? '', 10);
    if (major > KNOWN_CONFIG_MAJOR) {
        return {
            fromVersion: version,
            toVersion: CURRENT_CONFIG_VERSION,
            message: `Config version "${version}" is newer than supported (${CURRENT_CONFIG_VERSION}). ` +
                `Some features may not work correctly.`,
        };
    }
    return null;
};
export const loadConfig = async (path) => {
    let raw_config = {};
    const filePath = path ?? envStrOr('senars.config.json', 'SENARS_CONFIG');
    let outcome = null;
    try {
        const absolutePath = resolve(process.cwd(), filePath);
        outcome = await migrateConfigFile(absolutePath, fs.readFile.bind(fs), fs.writeFile.bind(fs));
        if (outcome.applied.length > 0) {
            logger.warn(`[config] migrated ${filePath}: ${outcome.applied.join(', ')} (now configVersion ${outcome.config.configVersion})`);
        }
        raw_config = outcome.config;
    }
    catch (e) {
        const err = e;
        if (err.code !== 'ENOENT') {
            logger.warn(`Failed to load config from ${filePath}: ${err.message}\nUsing default configuration`);
        }
    }
    const warning = validateConfigVersion(raw_config.configVersion);
    if (warning) {
        logger.warn(`[config] ${warning.message}`);
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
export const loadConfigFromEnv = async () => {
    return appConfigSchema.parse(readEnvOverrides());
};
export { CURRENT_CONFIG_VERSION };
