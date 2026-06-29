export {NAR} from '../nar/src/index.js';
export type {NARConfig} from '../nar/src/index.js';
export {
    createAgent,
    createAgentPreset,
    agentConfigToOptions,
    validateAgentOptions,
    buildAgentTools,
} from '../agent/src/index.js';
export type {
    Agent,
    AgentOptions,
    AgentPresetName,
    AgentPresetDeps,
    AgentPresetResult,
    ValidatedAgentOptions,
    AgentToolDeps,
    BridgeOptions,
    BridgeContext,
} from '../agent/src/index.js';
export {
    loadConfig,
    loadConfigFromEnv,
    makeDefaultBotConfig,
    DEFAULT_BOT_CONFIG,
    DEFAULT_PROFILE,
} from './config/index.js';
export type {AppConfig, BotProfile, AgentSectionConfig} from './config/index.js';
export * from './io/index.js';

export const VERSION = '1.0.0';
export const NAME = 'senars12';

export default {VERSION, NAME};
