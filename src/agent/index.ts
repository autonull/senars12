export {createAgent} from './agent.js';
export type {Agent, AgentOptions, ChatOptions, ChatStreamEvent, AgentStats} from './agent.js';
export {ModelRunner, truncateArtifact} from './model/ModelRunner.js';
export type {ComposedRequest, ModelEvent, ModelRunResult, ModelRunnerDeps, ReasoningArtifact} from './model/ModelRunner.js';
export {dispatchToolCalls} from './model/ToolDispatcher.js';
export type {ToolCall, ToolDispatchResult, ToolError} from './model/ToolDispatcher.js';
export {AgentEventBus} from './AgentEventBus.js';
export type {AgentEventKind, AgentEventPayloads} from './AgentEventBus.js';

export {agentOptionsSchema, validateAgentOptions, AgentOptionsValidationError} from './options-schema.js';
export type {ValidatedAgentOptions} from './options-schema.js';

export {createAgentPreset} from './presets.js';
export type {AgentPresetName, AgentPresetDeps, AgentPresetResult} from './presets.js';

export {agentConfigToOptions} from './config-bridge.js';

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
    resolveSessionKey,
    createErrorBoundary,
    originExtractor,
    createAuthMiddleware,
    createCommandInterceptor,
    createRateLimiter,
    createSessionBinder,
    createAgentDispatch,
    createStreamingAgentDispatch,
    abortSession,
    clearSessionState,
    createNarsTraceAnnotator,
    createNlInputTranslation,
    createNarseseOutputHumanization,
} from './io-middleware.js';

export {createConnectionConfigsFromEnv, DEFAULT_PORTS} from './io-config.js';

export {registerAllCommands} from './register-commands.js';

export {buildAgentTools} from './tools.js';
export type {AgentToolDeps} from './tools.js';

export {ApprovalManager} from '../nar/tools/adapters/external-tools.js';
export type {ApprovalRequest, ApprovalResult} from '../nar/tools/adapters/external-tools.js';

export {
    createWebSearchTools,
    createHTTPFetchTools,
    createCodeExecTools,
    createFileSystemTools,
    createRagQueryTools,
    createHumanApprovalTool,
} from '../nar/tools/adapters/external-tools.js';
