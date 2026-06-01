export {NAR} from './nar/index.js';
export type {NARConfig} from './nar/index.js';
export {AIAgent, ConversationState, AIAgentConnectionManager} from './agent/index.js';
export type {AIAgentConfig, ProcessContext, AgentResult, CognitiveState, BotConfig} from './agent/index.js';
export {loadConfig, loadConfigFromEnv, makeDefaultBotConfig, DEFAULT_BOT_CONFIG, DEFAULT_PROFILE} from './config/index.js';
export type {AppConfig, BotProfile} from './config/index.js';
export * from './io/index.js';

export const VERSION = '1.0.0';
export const NAME = 'senars12';

export default {VERSION, NAME};
