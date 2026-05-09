/**
 * Configuration Module
 * Provides unified configuration loading and validation
 */

export {
    loadConfig,
    loadConfigFromEnv,
    ConfigLoader
} from './loader.js';

export type {
    AppConfig,
    ValidatedConfig,
    LMConfig,
    MemoryConfig,
    InferenceConfig,
    IRCConfig
} from './loader.js';
