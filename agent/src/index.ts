export {createAgent} from './agent.js';
export type {Agent, AgentOptions, ChatOptions, ChatStreamEvent, AgentStats} from './agent.js';
export {ModelRunner} from './model/ModelRunner.js';
export type {
    ComposedRequest,
    ModelEvent,
    ModelRunResult,
    ModelRunnerDeps,
} from './model/ModelRunner.js';
export {dispatchToolCalls} from './model/ToolDispatcher.js';
export type {
    ToolCall,
    ToolDispatchResult,
    ToolError,
    ReasoningArtifact,
} from './model/ToolDispatcher.js';
export {EventBus} from './EventBus.js';
export type {EventKey, EventMap} from './EventBus.js';
export {AutonomyEngine, createAutonomyEngine} from './AutonomyEngine.js';
export type {AutonomyEngineConfig, ReasoningJob} from './AutonomyEngine.js';
export {AutonomousLoop, createAutonomousLoop} from './AutonomousLoop.js';
export type {
    LoopState,
    LoopConfig,
    PerceptionEvent,
    ReasoningEvent,
    ActionEvent,
    ReflectionEvent,
    ToolResult,
    SystemState,
} from './AutonomousLoop.js';
export {ContextBuilder, createDefaultContextBuilder} from './ContextBuilder.js';
export type {ContextSection, ContextData, DriveState} from './ContextBuilder.js';
export {ActionParser, createActionParser} from './ActionParser.js';
export type {ToolSchema, ToolPattern} from './ActionParser.js';
export {ReflectionEngine, createReflectionEngine} from './ReflectionEngine.js';
export type {Evaluation, DriveImpact} from './ReflectionEngine.js';
export {WakeScheduler, createWakeScheduler} from './WakeScheduler.js';
export type {WakeSchedulerConfig} from './WakeScheduler.js';

export {
    agentOptionsSchema,
    validateAgentOptions,
    AgentOptionsValidationError,
} from './options-schema.js';
export type {ValidatedAgentOptions} from './options-schema.js';

export {createAgentPreset} from './presets.js';
export type {AgentPresetName, AgentPresetDeps, AgentPresetResult} from './presets.js';

export {
    agentConfigToOptions,
    createConnectionConfigsFromEnv,
    DEFAULT_PORTS,
} from './options-schema.js';

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
    createNarseseOutputHumanization,
} from './io-middleware.js';

export {registerAllCommands} from './register-commands.js';

export {buildAgentTools} from './tools.js';
export type {AgentToolDeps} from './tools.js';

// New services
export {LifecycleManager, type LifecycleManagerConfig} from './services/LifecycleManager.js';
export {ToolBuilder, type ToolBuilderConfig} from './services/ToolBuilder.js';
export {
    SelfReasoningService,
    type SelfReasoningServiceConfig,
    type SelfReasoningState,
    type QualityMetrics,
} from './services/SelfReasoningService.js';
export {
    ApprovalService,
    type ApprovalServiceConfig,
    type PendingApproval,
} from './services/ApprovalService.js';
export {LMChatService} from './services/LMChatService.js';
export {NarQueryService} from './services/NarQueryService.js';

export {ApprovalManager} from '../../nar/src/tools/adapters/external-tools.js';
export type {
    ApprovalRequest,
    ApprovalResult,
} from '../../nar/src/tools/adapters/external-tools.js';

export {
    createWebSearchTools,
    createHTTPFetchTools,
    createCodeExecTools,
    createFileSystemTools,
    createRagQueryTools,
    createHumanApprovalTool,
} from '../../nar/src/tools/adapters/external-tools.js';
