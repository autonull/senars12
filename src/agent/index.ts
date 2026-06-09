export {createAgent} from './agent.js';
export type {Agent, AgentOptions} from './agent.js';
export {ModelRunner} from './model/ModelRunner.js';
export type {ComposedRequest, ModelEvent, ModelRunResult, ModelRunnerDeps, ReasoningArtifact} from './model/ModelRunner.js';
export {dispatchToolCalls} from './model/ToolDispatcher.js';
export type {ToolCall, ToolDispatchResult, ToolError} from './model/ToolDispatcher.js';

export type {SessionMessage, ConversationSession} from './ConversationSession.js';
export {
    createSession,
    appendTurn,
    trimHistory,
    getRecentHistory,
    DEFAULT_SESSION_HISTORY_LIMIT,
} from './ConversationSession.js';
export type {SessionManager} from './SessionManager.js';
export {InMemorySessionManager, JsonlSessionManager} from './SessionManager.js';
export {formatHistoryAsMessages, truncateForBudget} from './chat-history.js';
export type {HistoryMessage} from './chat-history.js';

export type {NlBridge, NlBridgeDeps, NlTranslation, DerivationResult, TranslationResult} from './nl-bridge.js';
export {createNlBridge} from './nl-bridge.js';

export {bindAgentToConnection} from './io-bridge.js';
export type {BridgeOptions} from './io-bridge.js';
export type {BridgeContext} from './io-middleware.js';
export {
    originExtractor,
    createAuthMiddleware,
    createCommandInterceptor,
    createRateLimiter,
    createSessionBinder,
    createAgentDispatch,
    createNarsTraceAnnotator,
    createNlInputTranslation,
    createNarseseOutputHumanization,
} from './io-middleware.js';

export {createConnectionConfigsFromEnv, DEFAULT_PORTS} from './io-config.js';

export {registerAllCommands} from './register-commands.js';
export type {CommandDeps} from './register-commands.js';
