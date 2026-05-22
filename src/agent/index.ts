// Core Agent (New Architecture)
export {AIAgent} from './AIAgent.js';
export type {AIAgentConfig, ConversationContext, SystemPromptBuilder} from './types.js';
export {CognitiveContextBuilder} from './CognitiveContext.js';

// Self-Analysis (Phase 3)
export {SelfAnalysisManager} from './SelfAnalysisManager.js';
export type {SelfAnalysisConfig, SelfAnalysisState, AnalysisReport} from './SelfAnalysisManager.js';

// Benchmarking (Phase 3)
export {BenchmarkRunner} from './benchmarks/BenchmarkRunner.js';
export type {BenchmarkConfig, BenchmarkResult, ScenarioResult} from './benchmarks/BenchmarkRunner.js';

// Scenarios & Experiments
export {ScenarioRunner} from './scenarios/ScenarioRunner.js';
export {ScoringEngine} from './scenarios/ScoringEngine.js';
export {RegressionTracker} from './scenarios/RegressionTracker.js';
export {ExperimentRunner} from './experiments/ExperimentRunner.js';
export * from './scenarios/types.js';

// Self-Analysis Core
export {SelfAnalyzer} from './SelfAnalyzer.js';

// State & Context
export {ConversationState} from './ConversationState.js';
export {BotProfile} from './BotProfile.js';
export {ChannelBehavior} from './ChannelBehavior.js';
export {IdentityResolver} from './IdentityResolver.js';
export {DegradationManager} from './DegradationManager.js';
export {ResponseFormatter} from './ResponseFormatter.js';

// Tools
export * from './tools/nars-tools.js';
export * from './tools/general-tools.js';

// Configuration
export {loadConfig, saveConfig, DEFAULT_CONFIG} from './config.js';
export type {BotFullConfig, BotProfile as ProfileConfig, CapabilitiesConfig} from './config.js';

// BotContext Types (still needed for type compatibility)
export type {
  BotConfig, BotContext, BotResponse, Capabilities, ConnectionInfo,
  TurnState, TurnMetrics, DerivationResult, Belief,
  LMDirective, DirectiveResult, TurnAction, ToolResult,
  InputClassification, ClassificationSignal, Intent, BotMode,
  Message, ReasoningArtifact, IOMessage, StreamChunk,
  NLParserDef, DirectiveDef, ClassificationSignalDef,
  LMRuleConfigEntry, LMRuleDef, ContextFragment,
} from './BotContext.js';
export {contextFragments, detectCapabilities, PipelineEventEmitter} from './BotContext.js';

// Exports from submodules
export * from './benchmarks/index.js';
export * from './streaming/index.js';
export * from './tui/index.js';
export {SkillCatalog} from './SkillCatalog.js';
export {LastResults} from './LastResults.js';
export {RLFPBridge} from './rlfp/RLFPBridge.js';
