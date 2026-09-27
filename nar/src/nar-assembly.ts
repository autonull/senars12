import { BaseComponent } from '@senars/core';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { Episode } from '@senars/util';
import { CognitiveController } from './cognitive';
import type { CognitiveParameters } from './config/cognitive-parameters';
import type { ParameterLedger } from './config/parameter-ledger.js';
import { createBootstrapTasks, DriveManager } from './drives';
import type { FocusBag } from './focus/FocusBag.js';
import type { GameFocus, GameFocusOptions } from './focus/GameFocus.js';
import type { ConversationGame } from './game/ConversationGame.js';
import type { SelfMetaGameImpl } from './game/SelfMetaGame.js';
import { createGateRegistry, type GateRegistry } from './kernel/GateRegistry.js';
import { SchemaInductor } from './learning/schema-induction.js';
import { GovernanceResolver } from './governance/pipeline.js';
import type { SelfMetaGameEvidence } from './governance/pipeline.js';
import type { LMService, SeNARSRegistry } from './lm';
import { getModelForTask, LMRules } from './lm';
import type { EmbeddingCache } from './lm/system-one/embedding-cache.js';
import { SystemOneIngressJudge } from './lm/system-one/ingress-judge.js';
import { createSystemOneLMRuleAdapter } from './lm/system-one/rule-adapter.js';
import { seedContrastiveMemory } from './lm/system-one/hard-negatives.js';
import { createNarTelemetrySinks, createTelemetryEmitter } from './lm/system-one/telemetry.js';
import type { TraceGradeInput, TraceGradeResult } from './lm/system-one/trace-grader.js';
import type { CognitiveDispatcher, JudgmentManifold } from './lm/system-one/types.js';
import { createLogger } from './logger';
import type { Concept } from './memory';
import { Memory } from './memory';
import { EpisodeConsolidator } from './memory/episode-consolidator.js';
import { MiningBag } from './lm/system-one/hard-negatives.js';
import { MetricsCollector } from './metrics';
import { createAttentionModel, type NARConfig, validateNarConfig } from './nar/config.js';
import { GameManager } from './nar/games.js';
import { StatePersister } from './nar/persistence.js';
import { SystemOneRuntime } from './nar/system-one.js';
import {
  askNaturalLanguage,
  consolidateLearning,
  contradicts,
  getModelWithFallback,
  injectBootstrapGoals,
  initializeLMRules,
  initializeTools,
} from './nar/facade.js';
import { NARExecution } from './nar-execution';
import { NARIO } from './nar-io';
import { NARLM } from './nar-lm';
import { QueryAPI, ReasoningTrace } from './query';
import { BagStrategy, Reasoner } from './reason';
import type { Reflex } from './reflex/Reflex.js';
import { RLFPLearner } from './rlfp';
import { RuleProcessor } from './rules';
import { ProofStreamRing } from './rules/recorder.js';
import { ReasoningAboutReasoning } from './self';
import { TaskManager } from './task';
import type { Term } from './terms';
import {
  containsSubterm,
  getSubject,
  Truth,
  type TruthType,
  termParser,
  termsEqual,
} from './terms';
import type { Tool, ToolResult } from './tools';
import { discoverTools, ToolManager } from './tools';
import { ProofMettaProposer, type ProofMettaProposerOptions } from './meta/index.js';
import { ConfigurationError, DEFAULT_CONFIG, NarEventBus, type Task, type TaskType } from './types';
import type { SourceReputation } from './kernel/source-reputation.js';

/** Bounded derivation-chain ring per AIKR (no I/O on the hot path). */
const DERIVATION_RING_CAP = 256;

import { errMsg } from './utils';

/**
 * NAR Assembly - ordered construction phases for NAR subsystems.
 * Phases: memory → gates → system-one → execution → games → optional features
 */
export interface NARAssemblyResult {
  memory: Memory;
  processor: RuleProcessor;
  reasoner: Reasoner;
  taskManager: TaskManager;
  query: QueryAPI;
  traceAPI: ReasoningTrace;
  tools: ToolManager;
  rlfp: RLFPLearner | undefined;
  cognitiveController: CognitiveController | undefined;
  systemOne: SystemOneRuntime;
  games: GameManager;
  persister: StatePersister;
  execution: NARExecution;
  lm: NARLM;
  io: NARIO;
  driveManager: DriveManager;
  systemEventBus: NarEventBus;
  gates: GateRegistry;
  self: ReasoningAboutReasoning | undefined;
  schemaInductor: SchemaInductor | undefined;
  episodeConsolidator: EpisodeConsolidator | undefined;
  miningBag: MiningBag | undefined;
  proofMettaProposer: ProofMettaProposer | undefined;
  governanceResolver: GovernanceResolver | undefined;
  sourceReputation: SourceReputation | undefined;
  metricsCollector: MetricsCollector;
  proofRing: ProofStreamRing<readonly Task[]>;
  constitution: Task[];
  lmService: LMService | undefined;
  registry: SeNARSRegistry | undefined;
  config: NARConfig;
  logger: ReturnType<typeof createLogger>;
}

/**
 * Phase 1: Core memory and processing infrastructure
 */
function assembleCore(config: NARConfig, eventBus: NarEventBus, logger: ReturnType<typeof createLogger>, metrics: MetricsCollector) {
  const gates = config.gateRegistry ?? createGateRegistry();
  const memory = new Memory(
    {
      ...config,
      bagImplementation: config.cognitiveParams?.strategies?.bag?.type ?? 'priority',
    },
    { attentionModel: createAttentionModel(config) }
  );
  const processor = new RuleProcessor();
  processor.setConfig({ memory, nar: null as any }); // nar set later
  processor.setEventBus(eventBus);
  const reasoner = new Reasoner(memory, processor, BagStrategy, { ...config, sampleSize: config.sampleSize });
  const taskManager = new TaskManager(memory, { gateRegistry: gates });
  const query = new QueryAPI(memory);
  const traceAPI = new ReasoningTrace(memory);
  const tools = new ToolManager({ eventBus, feedbackObserver: config.feedbackObserver });
  
  return { gates, memory, processor, reasoner, taskManager, query, traceAPI, tools };
}

/**
 * Phase 2: RLFP and optional features
 */
function assembleOptionalFeatures(config: NARConfig) {
  let rlfp: RLFPLearner | undefined;
  let episodeConsolidator: EpisodeConsolidator | undefined;
  let miningBag: MiningBag | undefined;
  let proofMettaProposer: ProofMettaProposer | undefined;

  if (config.enableRLFP) {
    rlfp = new RLFPLearner({ optimizeInterval: config.rlfp?.optimizeInterval });
  }

  if (config.episodeConsolidation?.enabled) {
    const cfg = config.episodeConsolidation;
    episodeConsolidator = new EpisodeConsolidator({
      capacity: cfg.capacity,
      budget: cfg.budget,
    });
  }

  if (config.hardNegativeMining?.bounded) {
    const cfg = config.hardNegativeMining;
    miningBag = new MiningBag({
      capacity: cfg.capacity,
      budget: cfg.budget,
      marginFloor: cfg.marginFloor,
    });
  }

  if (config.proofMettaProposer?.enabled) {
    const cfg = config.proofMettaProposer;
    proofMettaProposer = new ProofMettaProposer({
      maxRules: cfg.maxRules,
      minConfidence: cfg.minConfidence,
      patternMinSupport: cfg.patternMinSupport,
    });
  }

  return { rlfp, episodeConsolidator, miningBag, proofMettaProposer };
}

/**
 * Phase 3: Cognitive controller (if enabled)
 */
function assembleCognitiveController(
  config: NARConfig,
  registry: any,
  memory: Memory,
  processor: RuleProcessor,
  metrics: MetricsCollector,
  rlfp: RLFPLearner | undefined,
  _proofMettaProposer: ProofMettaProposer | undefined
): CognitiveController | undefined {
  if (config.cognitiveParams && config.strategyRegistry) {
    return new CognitiveController(
      config.strategyRegistry,
      memory,
      processor,
      metrics,
      rlfp,
      config.cognitiveParams,
      config.adaptationInterval
    );
  }
  return undefined;
}

/**
 * Phase 4: System One runtime
 */
function assembleSystemOne(
  config: NARConfig,
  lmService: LMService | undefined,
  proofMettaProposer: ProofMettaProposer | undefined,
  emitJudgmentResolved: (proposition: any, query?: any, provenance?: any) => void
): SystemOneRuntime {
  return new SystemOneRuntime(config, {
    lmService,
    onJudgmentResolved: emitJudgmentResolved,
  });
}

/**
 * Phase 5: Gates initialization with System One perception config
 */
function assembleGates(
  config: NARConfig,
  gates: GateRegistry,
  systemOne: SystemOneRuntime,
  sourceReputation: SourceReputation | undefined,
  lmService: LMService | undefined
): void {
  const perceptionConfig = config.systemOne?.enabled
    ? {
        systemOne: {
          enabled: true,
          judge: new SystemOneIngressJudge({
            manifold: systemOne.manifold!,
            embeddingCache: systemOne.embeddingCache!,
            budget: config.systemOne.reasoningBudget ?? {
              maxCycles: 100,
              maxDepth: 10,
              maxMemoryOps: 1000,
              maxLMCalls: 5,
              consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
            },
            reputation: () => sourceReputation,
            provider: () => lmService?.provider,
          }),
        },
      }
    : undefined;

  gates.initialize({
    initialBudget: {
      maxCycles: 1000,
      maxDepth: 100,
      maxMemoryOps: 10000,
      maxLMCalls: 50,
      consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
    },
    initialAutonomyMode: 'observe-only',
    perceptionConfig,
  });
  if (sourceReputation) gates.setReputation(sourceReputation);
}

/**
 * Phase 6: I/O and execution
 */
function assembleIOAndExecution(
  config: NARConfig,
  memory: Memory,
  taskManager: TaskManager,
  eventBus: NarEventBus,
  systemEventBus: NarEventBus,
  reasoner: Reasoner,
  rlfp: RLFPLearner | undefined,
  cognitiveController: CognitiveController | undefined,
  driveManager: DriveManager,
  self: ReasoningAboutReasoning | undefined,
  processor: RuleProcessor,
  tools: ToolManager,
  gates: GateRegistry
): { io: NARIO; execution: NARExecution } {
  const io = new NARIO(memory, taskManager, config);
  io.setEventBus(eventBus);
  io.setSystemEventBus(systemEventBus);
  
  const execution = new NARExecution({
    memory,
    taskManager,
    reasoner,
    config,
    rlfp,
    policyOptimizer: rlfp?.policyOptimizerPublic,
    cognitiveController,
    driveManager,
    systemEventBus,
    self,
    toolGoalExecutor: async (goalTerm) => tools.executeToolGoal(goalTerm),
    gates,
  });
  
  return { io, execution };
}

/**
 * Phase 7: Games and self-meta-game
 */
function assembleGames(
  systemOne: SystemOneRuntime,
  config: NARConfig,
  systemEventBus: NarEventBus,
  proofMettaProposer: ProofMettaProposer | undefined
): GameManager {
  return new GameManager(systemOne, config.rng, config.proposals, systemEventBus, proofMettaProposer);
}

/**
 * Phase 8: LM subsystem
 */
function assembleLM(
  memory: Memory,
  registry: SeNARSRegistry | undefined,
  lmService: LMService | undefined,
  config: NARConfig,
  getDispatcher: () => CognitiveDispatcher | undefined,
  getManifold: () => JudgmentManifold | undefined,
  getEmbeddingCache: () => EmbeddingCache | undefined
): NARLM {
  return new NARLM(
    memory,
    registry,
    lmService,
    config.enableBidirectionalFeedback,
    config.enableProactiveEnrichment,
    {
      getDispatcher,
      getManifold,
      getEmbeddingCache,
    }
  );
}

/**
 * Phase 9: Persistence and drive manager
 */
function assemblePersistenceAndDrives(
  config: NARConfig,
  memory: Memory,
  processor: RuleProcessor,
  driveManager: DriveManager,
  query: QueryAPI,
  attentionReport: () => any,
  systemEventBus: NarEventBus
): { persister: StatePersister; driveManager: DriveManager } {
  const persister = new StatePersister({
    config,
    memory,
    processor,
    driveManager,
    attentionReport,
    query,
  });
  driveManager.setSystemEventBus(systemEventBus);
  return { persister, driveManager };
}

/**
 * Main assembly function - builds all NAR subsystems in order.
 */
export function assembleNAR(
  config: NARConfig & { eventBus?: NarEventBus } = DEFAULT_CONFIG
): NARAssemblyResult {
  const eventBus = config.eventBus ?? new NarEventBus();
  const logger = createLogger({ scope: 'NAR' });
  const metrics = new MetricsCollector();
  const validatedConfig = { ...validateNarConfig(config) };
  
  // Phase 1: Core
  const core = assembleCore(validatedConfig, eventBus, logger, metrics);
  
  // Phase 2: Optional features
  const optional = assembleOptionalFeatures(validatedConfig);
  
  // Placeholder for source reputation (set later)
  let sourceReputation: SourceReputation | undefined;
  
  // Proof ring
  const proofRing = new ProofStreamRing<readonly Task[]>(DERIVATION_RING_CAP);
  const recordDerivationChain = (chain: readonly Task[]) => {
    const copy = [...chain];
    proofRing.push(copy);
  };
  
  // Phase 3: Cognitive controller
  const cognitiveController = assembleCognitiveController(
    validatedConfig,
    validatedConfig.strategyRegistry,
    core.memory,
    core.processor,
    metrics,
    optional.rlfp,
    optional.proofMettaProposer
  );
  
  // Phase 4: System One
  const emitJudgmentResolved = createTelemetryEmitter(
    createNarTelemetrySinks(new NarEventBus()) // temporary, will be replaced
  );
  const systemOne = assembleSystemOne(validatedConfig, validatedConfig.lmService, optional.proofMettaProposer, emitJudgmentResolved);
  
  // Phase 5: Gates
  assembleGates(validatedConfig, core.gates, systemOne, sourceReputation, validatedConfig.lmService);
  
  // Phase 6: I/O and execution - need drive manager first
  const driveManager = new DriveManager({
    input: async (text: string, type: TaskType, truth?: TruthType) => {
      // Will be wired after io is created
    },
  });
  
  // System event bus for NARExecution
  const systemEventBus = new NarEventBus();
  
  const { io, execution } = assembleIOAndExecution(
    validatedConfig,
    core.memory,
    core.taskManager,
    eventBus,
    systemEventBus,
    core.reasoner,
    optional.rlfp,
    cognitiveController,
    driveManager,
    undefined, // self set later
    core.processor,
    core.tools,
    core.gates
  );
  
  // Update drive manager with real io.input
  (driveManager as any).input = (text: string, type: TaskType, truth?: TruthType) => io.input(text, type, truth);
  
  // Phase 7: Games
  const games = assembleGames(systemOne, validatedConfig, systemEventBus, optional.proofMettaProposer);
  
  // Phase 8: LM
  const lm = assembleLM(
    core.memory,
    validatedConfig.providerRegistry,
    validatedConfig.lmService,
    validatedConfig,
    () => systemOne.dispatcher,
    () => systemOne.manifold,
    () => systemOne.embeddingCache
  );
  
  // Phase 9: Persistence
  const { persister } = assemblePersistenceAndDrives(
    validatedConfig,
    core.memory,
    core.processor,
    driveManager,
    core.query,
    () => ({
      concepts: core.memory.listConcepts().map(c => ({ term: c.term.toString(), priority: c.priority })).sort((a,b) => b.priority - a.priority).slice(0,20),
      total: core.memory.listConcepts().length
    }),
    systemEventBus
  );
  
  // Phase 10: Self
  let self: ReasoningAboutReasoning | undefined;
  if (validatedConfig.enableSelf) {
    self = new ReasoningAboutReasoning({} as any, {});
  }
  
  // Schema inductor (lazy)
  let schemaInductor: SchemaInductor | undefined;
  if (validatedConfig.lmService) {
    schemaInductor = new SchemaInductor(core.memory, validatedConfig.lmService, {
      rng: validatedConfig.rng,
    });
  }
  
  // Governance resolver (lazy)
  let governanceResolver: GovernanceResolver | undefined;
  
  // Update telemetry emitter with real system event bus
  const finalEmitJudgmentResolved = createTelemetryEmitter(createNarTelemetrySinks(systemEventBus));
  
  // Wire perception gate drive manager
  core.gates.getPerceptionGate().setDriveManager(driveManager);
  
  return {
    memory: core.memory,
    processor: core.processor,
    reasoner: core.reasoner,
    taskManager: core.taskManager,
    query: core.query,
    traceAPI: core.traceAPI,
    tools: core.tools,
    rlfp: optional.rlfp,
    cognitiveController,
    systemOne,
    games,
    persister,
    execution,
    lm,
    io,
    driveManager,
    systemEventBus,
    gates: core.gates,
    self,
    schemaInductor,
    episodeConsolidator: optional.episodeConsolidator,
    miningBag: optional.miningBag,
    proofMettaProposer: optional.proofMettaProposer,
    governanceResolver,
    sourceReputation,
    metricsCollector: metrics,
    proofRing,
    constitution: [],
    lmService: validatedConfig.lmService,
    registry: validatedConfig.providerRegistry,
    config: validatedConfig,
    logger,
  };
}

export type { NARConfig } from './nar/config.js';