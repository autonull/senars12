/**
 * Configuration Module
 * Provides unified configuration loading and validation
 */

export {
    loadConfig,
    loadConfigFromEnv,
    ConfigLoader
} from './loader.js';

export {
    DEFAULT_NAR_CONFIG,
    DEFAULT_NAR_CORE_CONFIG,
} from './defaults.js';

export type {
    AppConfig,
    ValidatedConfig,
    LMConfig,
    MemoryConfig,
    InferenceConfig,
    IRCConfig
} from './loader.js';
