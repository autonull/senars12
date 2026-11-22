// Client-safe exports — types and pure functions only, no server-only dependencies (llama.cpp, etc.)

// Core types
export type {
  ComponentContext,
  ComponentState,
} from '@senars/types/lifecycle.js';

// Bag (AIKR substrate)
export {
  PriorityBag,
  createBag,
  type Bag,
  type BagItem,
  type BagOptions,
} from './bag/index.js';
export {
  resolveBagSlot,
  bagSlotErrors,
  type BagSlotParams,
  type ResolvedBagSlot,
} from './bag/index.js';

// Resources
export {
  RESOURCE_CONTRACTS,
  RESOURCE_IDS,
  type CapacitySource,
  type ResourceContract,
  type Retention,
} from './resources/index.js';

// Cognitive Parameters
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
export { PriorityBag as MemoryPriorityBag, createBag as createMemoryBag, type Bag as MemoryBag, type BagItem as MemoryBagItem, type BagOptions as MemoryBagOptions } from './bag/index.js';
export { Concept, Memory } from './memory/index.js';
export type { ConceptTaskType, MemoryConfig } from './memory/index.js';
export { EpisodicMemory } from './memory/EpisodicMemory.js';
export type { Episode, EpisodeType, EpisodicMemoryConfig } from './memory/EpisodicMemory.js';

// Cognitive
export { runCounterfactual } from './cognitive/index.js';

// Errors
export {
  ActionGateError,
  BudgetGateError,
  BuilderError,
  GateError,
  PerceptionGateError,
  RewardGateError,
  SenarsError,
} from './errors/index.js';

// Imagination Engine
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

// Base Component
export { BaseComponent } from './agent/Lifecycle.js';

// Log
export { LogStoreEventLog, InMemoryEventLog, createLogStoreEventLog, createLogStoreEventLogFromStore } from './log/index.js';
export { createLogStore, type LogStore } from './log/store.js';

// Terms
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

// Autonomy
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

// NL
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

// Drives
export {
  createDriveMetaGoalPolicy,
  type DriveMetaGoal,
  DRIVE_META_GOAL_TABLE,
  type MetaGoalContext,
  type MetaGoalPolicy,
} from './drives/index.js';

// Protocol types
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
export type { LensSpec, ModulationSpec, BuiltinLens } from './protocol/lens-schema.js';
export type { Agent } from './agent/Agent.js';
export type { CognitiveEvent } from './schemas/cognitive-events.js';

// Rules (verifier truth table for UI vocabulary)
export {
  BINARY_TRUTH,
  UNARY_TRUTH,
  VERIFIER_TRUTH_TABLE,
  resolveTruthFn,
} from './rules/verifier-truth-table.js';
export type { RegisteredRule, RuleFn, RulePattern, RuleResult } from './rules/index.js';
export {
  createRulePattern,
  loadBuiltinTable,
  NALExtendedRules,
  NALRules,
  RuleIndex,
  RuleProcessor,
  RuleTableStore,
} from './rules/index.js';

// Query
export type { Answer, QueryAPI, ReasoningTrace } from './query/index.js';

// Task
export { TaskManager } from './task/index.js';
export type { SerializedStamp } from './terms/impls/Stamp.js';
export { deserializeStamp, observeStampId, Stamp, serializeStamp } from './terms/impls/Stamp.js';
export { isTruthEqual, Truth } from './terms/impls/Truth.js';

// Game (types only, no LM dependencies)
export type {
  Game,
  GameOutcome,
  MetaGame,
  Perception,
  SelfMetaGame,
  GameSpec,
  CognitionAction,
  CognitionContext,
  NARState,
  Reward,
  RewardClassification,
  Sensor,
  SensorReading,
} from './game/index.js';