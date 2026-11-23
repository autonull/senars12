import { createAgent, type CreateAgentConfig, type BinAgentApi, type ExtendedAgent } from './create-agent';

export { createAgent, type CreateAgentConfig, type BinAgentApi, type ExtendedAgent } from './create-agent';

export { Agent } from './Agent';
export { createCortexFromLM } from '@senars/cortex';
export type { JsonlSessionManagerConfig } from '@senars/memory';
export {
  abortSession,
  createSession,
  InMemorySessionManager,
  JsonlSessionManager,
} from '@senars/memory';
export { dispatchToolCalls, registerAgentTools, ToolRegistry, type ToolRegistryDelegate, type ToolSpec } from '@senars/motor';
export { emitDomainEvent, setDomainEventSink, hasDomainEventSink, type DomainEventPayload } from './event-sink';
export { PolicyEngine } from './PolicyEngine';
export { ApprovalService, type ApprovalManager, InMemoryApprovalManager } from './ApprovalService';
export { ModelRunner, type ModelRunnerDeps } from './ModelRunner';
export type { MettaPort } from './metta-port';
export type { CapabilitySpec, CapabilitySurface, WiredNAR } from './builder';
export { BuilderError, NARBuilder } from './builder';
export {
  type AnswerEnvelope,
  type CognitiveAgent,
  type CognitiveAgentConfig,
  type CognitiveAgentPreset,
  createCognitiveAgent,
} from './cognitive-agent';
export type { NARProfileName, NARProfileSpec } from './profiles';
export { NAR_PROFILES, resolveProfile } from './profiles';
export {
  ADMISSION_ORDER_CALL_SITE,
  DECISION_AXES,
  DECISION_CALL_SITE_IDS,
  DECISION_CALL_SITES,
  DECISION_POSITIONS,
  DECISION_QUERIES,
  type DecisionCallSite,
} from '../decision/index';

// Re-export shared types from main index to avoid duplication
export type {
  NARConfig,
  RLFPConfig,
  NarEventBus,
  NAREventMap,
  ConnectionConfig,
  Connection,
  CognitiveEvent,
  TermSymbol,
  Task,
  TaskType,
  TruthType,
  Source,
  Hash,
  CoreConfig,
  Term,
  AtomicTerm,
  CompoundTerm,
  Stamp,
  SerializedStamp,
  deserializeStamp,
  observeStampId,
  serializeStamp,
} from '../index';

export { NAR, Truth, isTruthEqual, createBotNAR, createMinimalNAR, createNAR, createTestNAR } from '../index';
export { readPersistedBoundary } from '../index';
export { createCognitiveThread, ThreadPool, type ThreadMessage, type ThreadStatus, type BackpressureReason, type SpawnResult, type JoinResult } from './cognitive-thread';
export { composeStrategy, describeStrategyExpression } from '../reason/strategy-algebra';
export { ParameterLedger, OutcomeLinker } from '../config/parameter-ledger';
export { createDriveMetaGoalPolicy, DriveManager, DRIVE_META_GOAL_TABLE } from '../drives/index';
export { validateInterpretation, type PerceivedInterpretation } from '../nl/formalizer';
export { IncomingFromClient, type IncomingFromClient as IncomingFromClientType } from '../protocol/unions';
export { createLogStoreEventLog, LogStoreEventLog, createLogStore } from '../log/index';
export { mintCognitiveEvent, isDurableEvent, recalledEventTypes } from '../schemas/index';
export { withinWorkspace } from '../motor/workspace';
export {
  AUTONOMY_MODES,
  AUTONOMY_POLICIES,
  DEFAULT_AUTONOMY_CONFIG,
  resolveAutonomyConfig,
  type AutonomyConfigInput,
} from '../autonomy/config';
export { createLogger } from '@senars/util/logger';
export { BaseComponent } from './Lifecycle';
export { CommandRegistry } from '@senars/commands';
export { validateParameters, DEFAULT_COGNITIVE_PARAMETERS, type CognitiveParameters } from '../config/cognitive-parameters';
export { ok, err, isOk, isErr, map, mapErr, flatMap, unwrapOrThrow, attempt, attemptAsync, type Result, type Ok, type Err } from '../util/result';
export { SenarsError, ConfigurationError, OperationError, ValidationError, type ErrorCode } from '../errors/index';
export { ProposalBag } from '../meta/index';
export { resolveBagSlot, bagSlotErrors } from '../bag/index';
export { TASK_BAG_KINDS, TASK_TYPES, TOLERANT_PUNCTUATIONS, taskTypeForPunctuation, TASK_PUNCTUATION, TASK_PUNCTUATIONS, TaskTypeSchema, FormalizationCandidateSchema, FormalizationBatchSchema, ProposalSchema, PROPOSAL_KINDS } from '../schemas/index';
export { DETECTED_INTENTS, DetectedIntentSchema } from '../schemas/index';
export { ChatMessage, NarConceptNode, GraphNodeDataView } from '../protocol/index';
export { CognitiveRegistry, createDefaultRegistry } from '../cognitive/index';
export { verifyRecord } from '../verification/index';
export {
  VERIFIER_TRUTH_TABLE,
  resolveTruthFn,
} from '../rules/index';
export { NAREngine } from '../engine/index';
export { CompositeSampling } from '../strategies/sampling/CompositeSampling';
export { CognitiveController } from '../cognitive/index';
export { Memory, EpisodicMemory, EpisodeSchema } from '../memory/index';
export { PriorityBag } from '../bag/index';
export { isEventType, validateCognitiveEvent } from '../schemas/cognitive-events';
export { validateDerivationRecord } from '../schemas/derivation-records';
export { StreamReasoner } from '../stream/index';
export { LMProposalProducer, CycleTrace, findInCycleProposals, findStageOverlaps, CYCLE_STAGES, ProposalLifecycle } from '../proposal/index';
export type { CycleStageEvent, StageOverlap, ProposalQueueLimits } from '../proposal/index';
export { canonicalJson, configDigest } from '../strategies/index';
export { CompositeStrategy, CompositeLMRuleSelector, CompositeAttention, TermLinkStrategy } from '../strategies/index';
export { LINK_LAYER, type KnownLinkLayer } from '../memory/index';
export { Layer } from '../memory/index';
export { AssociativeRegistry, LinkLayerMemory, type AssociativeMemory, EpisodeConsolidator, symbolicSummary, episodeSalience, causalConnections } from '../memory/index';
export { BrierHarness, isResumable, loadSession, startArcadeTickSpan, saveSession } from '../eval/index';
export { SeededRNG } from '../util/random';
export { createTimestamp, type Timestamp } from '../types/primitives';
export {
  sanitizePreopens,
  containsPath,
  withSandboxTimeout,
  createNodeVMSandbox,
  SandboxTimeoutError,
  assertWasmPathContained,
} from '../capability/index';
export { askSafely, DECISION_ASK_TIMEOUT_MS } from '../ports/decision';
export { createTetrisGame, TetrisGame, createSelfMetaGame } from '../game/index';
export { SOURCE_QUALITY_CONFIDENCE } from '../schemas/index';
export { SchedulerAdapter, SchemaInductor, AIKRProcessor } from '../learning/index';
export { TaskManager, type Budget as TaskBudget } from '../task/index';
export { createTask, createTaskWeight, NEUTRAL_BUDGET, createSecondaryTask } from '../types/core';
export { RuleProcessor, ProofStreamRing, rankDerivations } from '../rules/index';
export { DEFAULT_CONFIG } from '../types/core';
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
  type AtomicTerm as TermsAtomicTerm,
  type CompoundTerm as TermsCompoundTerm,
  type Term as TermsTerm,
} from '../terms/index';
export { NARExecution } from '../nar-execution';
export { PROPOSAL_SCHEMA_VERSION, RULE_TABLE_SCHEMA_VERSION, BUILTIN_RULE_ARTIFACT_VERSION } from '../schemas/index';
export { createMockLMService } from '../lm/lm-service';
export { narEventToCognitive, MAPPED_NAR_EVENTS } from '../events/index';
export { EmbeddingCache, createEmbeddingCache } from '../lm/system-one/index';
export { RESOURCE_CONTRACTS, RESOURCE_IDS } from '../resources/index';
export { DEFAULT_MEMORY_CONFIG } from '../memory/config';

// Types not in main index - import from original sources
export type { Tool } from '../protocol/index';
export type { ChatStreamEvent } from './chat';
export type { AgentOptions } from '../types/agent';
export { AgentOptionsSchema, ConnectionConfigSchema } from '../tools/index';