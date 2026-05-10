export {NAR} from './nar/index.js';
export type {NARConfig} from './nar/index.js';
export {Agent} from './agent/index.js';
export type {Embodiment, Command, InputProcessor, AgentProfile, AgentCapabilities} from './agent/index.js';
export {loadConfig, loadConfigFromEnv, ConfigLoader} from './config/loader.js';
export type {AppConfig, ValidatedConfig, LMConfig, MemoryConfig, InferenceConfig, IRCConfig} from './config/loader.js';

export const VERSION = '1.0.0';
export const NAME = 'senars12';

export default {
    VERSION,
    NAME
};