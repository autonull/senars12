export {AIAgent} from './AIAgent.js';
export {AutonomousScheduler} from './AutonomousScheduler.js';
export {ConversationState} from './ConversationState.js';
export {channelBehavior, CHANNEL_DEFAULTS, type ChannelType, type ResponseMode, type ChannelBehaviorConfig} from './ChannelBehavior.js';
export {IdentityResolver} from './IdentityResolver.js';
export {SkillCatalog} from './SkillCatalog.js';

export type {
    AIAgentConfig, AgentResult, ProcessContext,
    SystemPromptBuilder, ConversationContext,
    BotConfig, BotProfile, Capabilities,
    Belief, BotContext, BotResponse, ConnectionInfo, Message, ReasoningArtifact,
    IOMessage, StreamChunk, TurnAction, TurnState, TurnMetrics,
    DerivationResult, LMDirective, DirectiveResult, ToolResult,
    InputClassification, ClassificationSignal, Intent, BotMode,
    DirectiveDef, NLParserDef, ClassificationSignalDef,
    LMRuleConfigEntry, LMRuleDef, ContextFragment,
    AgentMetrics, CognitiveSnapshot, AttentionReport, ContextOptions,
} from './types.js';

export {DEFAULT_PROFILE, makeDefaultBotConfig, DEFAULT_BOT_CONFIG} from '../config/defaults.js';

export {NarService, ObserverService, SelfAnalyzerService,
        MetacognitiveMonitor, CognitiveController} from './services/index.js';
export type {ObserverReport, SelfAnalyzerConfig, MetaCognitiveResult,
             CognitiveState, CognitiveAction} from './services/index.js';

export {ScenarioRunner, ScoringEngine, RegressionTracker, defineScenario, Scenarios} from './scenarios/index.js';
export type {Scenario, ScenarioStep, ScenarioResult, AssertionResult,
             ScenarioExpectation, ScenarioVariant, ScenarioType, ScenarioCategory} from './scenarios/index.js';

export {BenchmarkRunner} from './benchmarks/BenchmarkRunner.js';
export {ExperimentRunner} from './experiments/ExperimentRunner.js';
export {RLFPBridge} from './rlfp/RLFPBridge.js';
export {AIAgentConnectionManager, createConnectionConfigsFromEnv} from './connections/ConnectionManager.js';

export {StatusBarComponent, VISUAL, DEFAULT_TUI_CONFIG, buildStatusBar} from './tui/index.js';
export type {TUIConfig, StatusBarData} from './tui/index.js';
