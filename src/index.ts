// Core types - exported first
/** Core NAR term + task type definitions. @public */

export type {
  ComponentContext,
  ComponentState,
} from '@senars/types';
// Capability
/** WASI sandbox, path containment, and timeout utilities. @public */
export {
  assertWasmPathContained,
  containsPath,
  createNodeVMSandbox,
  createWasiSandbox,
  createWasmModuleSandbox,
  DEFAULT_SANDBOX_TIMEOUT_MS,
  SandboxTimeoutError,
  sanitizePreopens,
  withSandboxTimeout,
  type WasiSandboxOptions,
  type WasmModuleOptions,
} from './capability/index.js';
// Game
/** Cognitive games and arcade harness. @public */
export {
  createArithmeticGame,
  ArithmeticGame,
  type ArithmeticGameConfig,
  type ArithmeticState,
  createBanditGame,
  BanditGame,
  type BanditGameConfig,
  type BanditDriftConfig,
  createCatchGame,
  CatchGame,
  type CatchGameConfig,
  type CatchState,
  ConversationGame,
  type ConversationAction,
  type ConversationState,
  createGame2048,
  Game2048,
  type Game2048Config,
  type Game2048State,
  type Move2048,
  createGridWorldGame,
  GridWorldGame,
  type GridWorldConfig,
  type GridAction,
  type GridWorldState,
  createMetaGame,
  MetaGameClass,
  createReasoningGame,
  ReasoningGame,
  REASONING_SPECS,
  type ReasoningGameOptions,
  type ReasoningGameSpec,
  type ReasoningState,
  type ReasoningTask,
  ReasoningMetaGame,
  createRPSGame,
  RPSGame,
  type RPSGameConfig,
  type RPSState,
  createSelfMetaGame,
  SelfMetaGameImpl,
  type KnobConfig,
  type SelfMetaGameConfig,
  createSnakeGame,
  SnakeGame,
  type Cell,
  type Direction,
  type SnakeGameConfig,
  type SnakeState,
  createTetrisGame,
  TetrisGame,
  type TetrisGameConfig,
  type TetrisPlacement,
  type TetrisState,
  createTicTacToeGame,
  TicTacToeGame,
  minimax,
  type Player as TicTacToePlayer,
  type TicTacToeAction,
  type TicTacToeConfig,
  type TicTacToeState,
  ASK_LM,
  actionsForTier,
  CLARIFY,
  CONSOLIDATE,
  CYCLE,
  DEFAULT_ACTIONS,
  REST,
  REVISE,
  SPAWN_SUBGOAL,
  tuneAction,
  type Game,
  type GameOutcome,
  type MetaGame,
  type Perception,
  type SelfMetaGame,
  perceptionKey,
  ActionRegistry,
  ComponentRegistry,
  createCognitionRegistries,
  RewardRegistry,
  SensorRegistry,
  type GameSpec,
  createArcadeRegistry,
  GameRegistry,
  UnknownGameError,
  renderGame,
  AMBIGUITY_REDUCTION_REWARD,
  CONSOLIDATION_REWARD,
  composeReward,
  DEFAULT_REWARDS,
  GROUNDEDNESS_REWARD,
  SPEND_EFFICIENCY_REWARD,
  TASK_SETTLED_REWARD,
  VETO_PENALTY,
  BagPressureSensor,
  DEFAULT_SENSORS,
  DerivationBacklogSensor,
  GovernanceQueueSensor,
  HeadHealthSensor,
  SpendSensor,
  TaskTypeMixSensor,
  VetoHandoverRateSensor,
  type ActionExecutionContext,
  type CognitionAction,
  type CognitionContext,
  type NARState,
  type Reward,
  type RewardClassification,
  type Sensor,
  type SensorReading,
  failClosed,
  describeMetaGameActions,
  FOCUS_WEIGHT_STEPS,
  KNOB_SET_VALUES,
  SeededRNG,
} from './game/index.js';
// Resources
/** Resource contracts for bounded containers. @public */
export {
  RESOURCE_CONTRACTS,
  RESOURCE_IDS,
  type CapacitySource,
  type ResourceContract,
  type Retention,
} from './resources/index.js';
// Cognitive Parameters
/** Cognitive architecture parameters, validation, and defaults. @public */
export {
  DEFAULT_COGNITIVE_PARAMETERS,
  FAST_COGNITIVE_CONFIG,
  PARAMETER_SPACE,
  STRATEGY_SLOTS,
  STRATEGY_SLOTS_BY_KEY,
  buildDefaults,
  mergeParameters,
  readCognitiveParams,
  sameStrategies,
  validateParameters,
  type CognitiveParameters,
  type PriorityConfig,
  type LMConfig,
  type AttentionConfig,
  type InferenceConfig,
  type ModelRunnerConfig,
  type MemoryParams,
  type StrategySlotParams,
} from './config/cognitive-parameters.js';
// Strategies
/** Pluggable cognitive strategies (attention, derivation, sampling, premise, LM rule). @public */
export {
  AllSelector,
  AnytimeDerivation,
  CompositeAttention,
  CompositeLMRuleSelector,
  CompositeStrategy,
  configDigest,
  configurable,
  configSchema,
  DefaultDerivation,
  DiverseSampling,
  DiverseSelector,
  FocusedDerivation,
  GoalBiasedSampling,
  GoalRelevanceAttention,
  NoveltySampling,
  PrioritySampling,
  PrioritySelector,
  RotationSelector,
  SampledDerivation,
  SimpleAttention,
  SpreadingActivation,
  TermLinkStrategy,
  WindowedRouletteStrategy,
  createWindowedRouletteStrategy,
  canonicalJson,
  describeSpec,
  fixed,
  isStrategyExpression,
  singleton,
  strategySpecErrors,
  type AttentionContext,
  type AttentionModel,
  type ComponentMetadata,
  type DerivationContext,
  type DerivationStrategy,
  type ModelRuleSelectionContext,
  type ModelRuleSelector,
  type MetricsSummary,
  type SamplingStrategy,
  type SearchSpace,
  type SearchSpaceParam,
  type Strategy,
  type StrategyType,
  type CompositeSpec,
  type ConfigSchema,
  type ResolutionTier,
  type StrategyCatalog,
  type StrategyConfig,
  type StrategyRegistration,
  type StrategyRegistry,
  type StrategySpec,
} from './strategies/index.js';
// Eval
/** Arcade session state, Brier scoring, and harness utilities. @public */
export {
  BrierHarness,
  isResumable,
  loadSession,
  saveSession,
  sessionKey,
  startArcadeTickSpan,
  type ArcadeSession,
  type ArmAggregate,
  type ArmSummary,
  type ArcadeTickRecord,
  type ArcadeTickSpan,
} from './eval/index.js';
// Memory
/** Concept container. @public */
/** Main memory store. @public */
/** Unified AIKR priority bag substrate. @public */
export { PriorityBag, createBag, type Bag, type BagItem, type BagOptions } from './bag/index.js';
/** Bag slot resolution and validation. @public */
export { resolveBagSlot, bagSlotErrors, type BagSlotParams, type ResolvedBagSlot } from './bag/index.js';
/** The persisted consistency boundary, readable without starting a NAR. @public */
export { DEFAULT_NAR_STATE_PATH, readPersistedBoundary } from './state/persisted.js';
/** Rewind checkpoints and the partial-restore report (CORE.19 C2.3). @public */
export { CHECKPOINT_RING_CAP, REWIND_BASE_GAPS, type RewindReport } from './state/checkpoint.js';
// Cognitive
/** Counterfactual simulator. @public */
export { runCounterfactual } from './cognitive/index.js';
/** E1 error taxonomy — nar/public error surface. @public */
export {
  ActionGateError,
  BudgetGateError,
  BuilderError,
  GateError,
  PerceptionGateError,
  RewardGateError,
  SenarsError,
} from './errors/index.js';
// Imagination Engine (Cognitive Treadmill)
/** Scenario generation, hidden-model oracle, cognitive treadmill. @public */
export {
  CognitiveTreadmill,
  type DegradationCurve,
  type DegradationPoint,
  type GeneratorConfig,
  HiddenModelOracle,
  type HiddenRule,
  type OracleExpectation,
  type Scenario,
  ScenarioGenerator,
  type ScenarioProfile,
  type StressMetrics,
  type TreadmillConfig,
} from './imagination/index.js';
/** The one component lifecycle state machine (`NAR` extends it). @public */
export { BaseComponent } from './agent/Lifecycle.js';
// Log
/** Event log adapter over LogStore. @public */
export { LogStoreEventLog, InMemoryEventLog, createLogStoreEventLog, createLogStoreEventLogFromStore } from './log/index.js';
export { createLogStore, type LogStore } from './log/store.js';
// LLM Service
/** LLM service + factory/mock. @public */
export { createLMService, createMockLMService, LMService } from './lm/lm-service.js';
/** Bounded hard-negative mining bag (AIKR bag pattern; consumer: NAR). @public */
export { MiningBag } from './lm/system-one/hard-negatives.js';
export type { Episode, EpisodeType, EpisodicMemoryConfig } from './memory/EpisodicMemory.js';
// Episodic Memory
/** Episodic memory store. @public */
export { EpisodicMemory } from './memory/EpisodicMemory.js';
// Phase B (REFACTOR.todo2): episodic memory consolidation as an AIKR process
export type {
  ConsolidationResult,
  EpisodeConsolidatorOptions,
} from './memory/episode-consolidator.js';
/** Episodic memory consolidation process (AIKR bag pattern; consumer: NAR + integrators). @public */
export { EpisodeConsolidator, symbolicSummary } from './memory/episode-consolidator.js';
export type { ConceptTaskType, MemoryConfig } from './memory/index.js';
export { Concept, Memory } from './memory/index.js';
// Phase D (REFACTOR.todo2): bounded AIKR bags for proposals + hard-negative mining
export type { ProposalBagOptions, ProposalCandidate } from './meta/proposal-bag.js';
/** Bounded self-improvement proposal bag (AIKR bag pattern; consumer: SelfMetaGame). @public */
export { ProposalBag } from './meta/proposal-bag.js';
export type { NARConfig, RLFPConfig } from './nar.js';
// Main NAR class
/** The NAR reasoning engine. @public */
export { NAR } from './nar.js';
// NAR-LM integration
/** NAR with LM capabilities. @public */
export { NARLM } from './nar-lm.js';
// Factory for creating NAR instances
/** Kernel construction presets (tests/benches). @public */
export { createBotNAR, createMinimalNAR, createNAR, createTestNAR } from './nar-presets.js';
// NL Translation
/** Natural-language translation schemas. @public */
export * from './nl/schemas.js';
// Reason
export type { Strategy } from './reason/index.js';
// Rules
/** Rule type definitions. @public */
export type { RegisteredRule, RuleFn, RulePattern, RuleResult } from './rules/index.js';
/** Rule registry + indexing. @public */
/** Synchronous rule processor. @public */
/** Standard NAL rule set. @public */
/** Extended NAL rule set. @public */
export {
  createRulePattern,
  loadBuiltinTable,
  NALExtendedRules,
  NALRules,
  RuleIndex,
  RuleProcessor,
  RuleTableStore,
} from './rules/index.js';
// Self-Reasoning (Metacognition)
/** Reasoning about reasoning, architecture driver. @public */
export * from './self/index.js';
// Task
/** Task scheduling/queuing. @public */
export { TaskManager } from './task/index.js';
export type { SerializedStamp } from './terms/impls/Stamp.js';
/** Term temporal stamp. @public */
export { deserializeStamp, observeStampId, Stamp, serializeStamp } from './terms/impls/Stamp.js';
/** Truth-value algebra. @public */
export { isTruthEqual, Truth } from './terms/impls/Truth.js';
// Terms
/** Term construction + (de)serialization helpers. @public */
/** Narsese parser. @public */
/** Term predicate/accessor utilities. @public */
/** Term-to-graph-edge extraction. @public */
export {
  atom,
  atomicSymbols,
  atomKey,
  bareInheritancePair,
  containsSubterm,
  foldTerm,
  getAntecedent,
  getArgs,
  getConsequent,
  getPredicate,
  getSubject,
  hasVariable,
  isAtomic,
  isCompound,
  isConjunction,
  isDisjunction,
  isEquivalence,
  isImplication,
  isInheritance,
  isNegation,
  isSimilarity,
  isVariableSymbol,
  mentionsSymbol,
  operationNameOf,
  operationTerm,
  parseTermToEdges,
  readOperationTerm,
  sameKind,
  serializeTerm,
  sharesInheritanceEnd,
  sharesSymbol,
  TermBuilder,
  TermCollection,
  type TermEdge,
  TermMap,
  type TermMapEntry,
  TermParser,
  TermSet,
  termDepth,
  termKey,
  termParser,
  termSize,
  termsEqual,
  visitTerms,
  walkTerms,
} from './terms/index.js';
export type {
  AtomicTerm,
  Budget,
  CompoundTerm,
  CoreConfig,
  Hash,
  Source,
  Task,
  TaskType,
  Term,
  TermSymbol,
  TruthType,
} from './types/core.js';
/** Core builders, task factories, and NAR error hierarchy. @public */
export {
  ConfigurationError,
  createTaskWeight,
  createSecondaryTask,
  createTask,
  DEFAULT_CONFIG,
  err,
  flatMap,
  getOrElse,
  isErr,
  isOk,
  map,
  OperationError,
  ok,
  ToolError,
  unwrapOrThrow,
  ValidationError,
} from './types/core.js';
/** The kernel-owned autonomy loop (CORE.19 C5). @public */
export {
  AUTONOMY_MODES,
  AUTONOMY_POLICIES,
  AutonomyHeartbeat,
  type AutonomyConfig,
  type AutonomyConfigInput,
  type AutonomyMode,
  type AutonomyPolicyId,
  type AutonomyPorts,
  type AutonomyProvenance,
  type AutonomyTickReport,
  type ConceptObservation,
  createAutonomyHeartbeat,
  DEFAULT_AUTONOMY_CONFIG,
  resolveAutonomyConfig,
} from './autonomy/index.js';
/** The neuro-symbolic voice: one formalizer, one validation gate, one explanation (CORE.19 C6). @public */
export {
  createFormalizer,
  type ConflictExplanation,
  ExplanationGenerator,
  type Explanation,
  type ExplanationGeneratorOptions,
  type ExplanationSource,
  type Formalizer,
  type InterpretationValidation,
  LmFormalizer,
  PERCEIVED_ORIGINS,
  type PerceivedAdmission,
  type PerceivedInterpretation,
  type PerceivedOrigin,
  StructuredFormalizer,
  validateInterpretation,
} from './nl/index.js';
/** The drive→meta-goal injection policy — extracted, pure, and off by default (CORE.19 C5.6). @public */
export {
  createDriveMetaGoalPolicy,
  type DriveMetaGoal,
  DRIVE_META_GOAL_TABLE,
  type MetaGoalContext,
  type MetaGoalPolicy,
} from './drives/index.js';

// Protocol types (for UI compatibility with @senars/core)
export {
  GraphNodeData,
  GraphNodeDataView,
  Lens,
  GraphOp,
  CognitiveDelta,
  type GraphOpType,
  CognitiveEventsMsg,
  CognitiveMetrics,
  FocusSet,
  LensSet,
  StateSnapshot,
  SyncRequest,
  TelemetryMsg,
  CycleStateMsg,
  CycleStepMsg,
  CyclePauseMsg,
  CycleResumeMsg,
  CycleRewindMsg,
  type CognitiveMetricsData,
  type TelemetryMetrics,
  NodeHistoryMsg,
  NodeHistoryRequestMsg,
  LensDefinedMsg,
  LensDefineMsg,
  LensFieldsMsg,
  LensListMsg,
  ObjectSetMsg,
  IncomingFromClient,
  IncomingFromServer,
  ReasoningSubmitMsg,
  ReasoningAskMsg,
  ReasoningStepMsg,
  ReasoningRunMsg,
  ReasoningAbortMsg,
  ReasoningRetractMsg,
  ReasoningReviseMsg,
  ReasoningAddGoalMsg,
  ReasoningAdjustBudgetMsg,
  ReasoningAdjustProviderMsg,
  ReasoningControlResponse,
  type ReasoningSubmit,
  type ReasoningAsk,
  type ReasoningStep,
  type ReasoningRun,
  type ReasoningAbort,
  type ReasoningRetract,
  type ReasoningRevise,
  type ReasoningAddGoal,
  type ReasoningAdjustBudget,
  type ReasoningAdjustProvider,
  ServerError,
  type ServerErrorCode,
  type ToolSpec,
  type ToolSchema,
  type ToolSchemaProperty,
  type ToolResult,
  objectSpec,
  type ConfigFieldType,
  ChatMessage,
  ChatAgentComplete,
  ChatAgentStream,
  ChatUserMsg,
  LMStatusRequest,
  LMStatusMsg,
  LMSwitchMsg,
  UiCommandMsg,
  AgentCapabilities,
  CONNECTION_COLORS,
  EDGE_LABELS,
  EDGE_TYPES,
  edgeTypeLabel,
  LENS_COLORS_HEX,
  LENS_DESCRIPTIONS,
  LENS_FIELDS,
  LENS_LABELS,
  type LensFieldDescriptor,
  GraphNodeDataStrict,
  MettaAtomNode,
  MettaSkillNode,
  NarConceptNode,
} from './protocol/index.js';
export { isNarsese } from '@senars/util/text';
export { builtinLensSpecs } from './protocol/lens-schema.js';
export type { Agent } from './agent/index.js';
export type { CognitiveEvent } from './schemas/cognitive-events.js';
