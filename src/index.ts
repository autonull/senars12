export {NAR} from './nar/index.js';
export type {NARConfig} from './nar/index.js';
export {AIAgent} from './agent/index.js';
export {loadConfig, loadConfigFromEnv, ConfigLoader} from './config/loader.js';
export type {AppConfig, ValidatedConfig, LMConfig, MemoryConfig, InferenceConfig, IRCConfig} from './config/loader.js';
export * from './io/index.js';

export const VERSION = '1.0.0';
export const NAME = 'senars12';

export default {
    VERSION,
    NAME
};