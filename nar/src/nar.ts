import { promises as fs } from 'node:fs';
import path from 'node:path';
import { BaseComponent } from '@senars/core';
import type { AutonomyMode, JudgmentResolvedEvent } from '@senars/kernel/schemas';
import type { CognitiveRegistry } from './cognitive';
import { CognitiveController } from './cognitive';
import type { CognitiveParameters } from './config/cognitive-parameters';
import { createBootstrapTasks, DriveManager, type INarInput } from './drives';
import { FocusBag } from './focus/FocusBag.js';
import { GameFocus, type GameFocusOptions } from './focus/GameFocus.js';
import { createSelfMetaGame, type SelfMetaGameImpl } from './game/SelfMetaGame.js';
import { createGateRegistry, type GateRegistry } from './kernel/GateRegistry.js';
import type { LMService, SeNARSRegistry } from './lm';
import { getModelForTask, LMRules } from './lm';
import { createLMServiceCortex, LMServiceCortex } from './lm/system-one/cortex-adapter.js';
import { createDispatcher, StubCortex } from './lm/system-one/dispatcher.js';
import { JudgmentDataset } from './lm/system-one/distill.js';
import { createEmbeddingCache } from './lm/system-one/embedding-cache.js';
import { createGroundednessGate } from './lm/system-one/groundedness-gate.js';
import { createHttpManifold } from './lm/system-one/http-manifold.js';
import { LMReflex } from './lm/system-one/lm-reflex.js';
import { createManifold } from './lm/system-one/manifold.js';
import { ManifoldReflex } from './lm/system-one/manifold-reflex.js';
import { createSystemOneLMRuleAdapter } from './lm/system-one/rule-adapter.js';
import { createNarTelemetrySinks, createTelemetryEmitter } from './lm/system-one/telemetry.js';
import type { TraceGradeInput, TraceGradeResult } from './lm/system-one/trace-grader.js';
import { createTraceGrader } from './lm/system-one/trace-grader.js';
import { composeModelDigest, encoderDigest } from './lm/system-one/wasi-runtime.js';
import { createLogger } from './logger';
import type { Concept } from './memory';
import { Memory } from './memory';
import { createEmbeddingGenerator } from './memory/embedding.js';
import { MetricsCollector } from './metrics';
import { NARExecution } from './nar-execution';
import { NARIO } from './nar-io';
import { NARLM } from './nar-lm';
import { QueryAPI, ReasoningTrace } from './query';
import { BagStrategy, Reasoner } from './reason';
import { EpsilonGreedyReflex } from './reflex/EpsilonGreedyReflex.js';
import type { ActionProposal, LearningEvent, Reflex } from './reflex/Reflex.js';
import { RLFPLearner } from './rlfp';
import { RuleProcessor } from './rules';
import { ReasoningAboutReasoning } from './self';
import type { AttentionModel } from './strategies';
import { SimpleAttention } from './strategies';
import { TaskManager } from './task';
import type { Term } from './terms';
import {
  containsSubterm,
  getSubject,
  Stamp,
  Truth,
  type TruthType,
  termParser,
  termsEqual,
} from './terms';
import type { Tool, ToolResult } from './tools';
import { discoverTools, ToolManager } from './tools';
import { createSelfTools } from './tools/adapters/external-tools.js';
import {
  ConfigurationError,
  type CoreConfig,
  createTask,
  DEFAULT_CONFIG,
  EventBus as NarEventBus,
  type Task,
  type TaskType,
} from './types';
import { errMsg } from './utils';

export { MetricsCollector } from './metrics';

export interface RLFPConfig {
  optimizeInterval?: number;
}

import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import type { SystemOneConfig as SystemOneConfigSchema } from '@senars/util/config';
import type { EmbeddingCache } from './lm/system-one/embedding-cache.js';
import type {
  CognitiveDispatcher,
  JudgmentManifold,
  JudgmentQuery,
  SynthesisQuery,
} from './lm/system-one/types.js';

/** File-validated System One config (zod-inferred, single source of truth — G6). */
export type SystemOneFileConfig = SystemOneConfigSchema;

/** Runtime config extending the file config with injected runtime objects. */
export interface SystemOneRuntimeConfig extends Omit<SystemOneFileConfig, 'manifold'> {
  manifold?: SystemOneFileConfig['manifold'] | JudgmentManifold;
  embeddingCache?: EmbeddingCache;
  reasoningBudget?: ReasoningBudget;
}

/** Back-compat alias for the runtime config. */
export type SystemOneConfig = SystemOneRuntimeConfig;

export interface NARConfig extends CoreConfig {
  lmService?: LMService;
  providerRegistry?: SeNARSRegistry;
  enableLMRules?: boolean;
  enableTools?: boolean;
  enableSelf?: boolean;
  enableRLFP?: boolean;
  rlfp?: RLFPConfig;
  enableBidirectionalFeedback?: boolean;
  enableProactiveEnrichment?: boolean;
  enableLMStreaming?: boolean;
  persistState?: boolean;
  statePath?: string;

  cognitiveParams?: CognitiveParameters;
  strategyRegistry?: CognitiveRegistry;
  adaptationInterval?: number;
  feedbackObserver?: ToolFeedbackObserver;
  /** TODO19 F2: per-instance gate registry; defaults to a fresh isolated instance. */
  gateRegistry?: GateRegistry;

  systemOne?: Partial<SystemOneConfig>;
}

export class NAR extends BaseComponent {
  readonly id = 'nar';
  readonly memory: Memory;
  readonly taskManager: TaskManager;
  readonly reasoner: Reasoner;
  readonly query: QueryAPI;
  readonly traceAPI: ReasoningTrace;
  readonly tools: ToolManager;
  self?: ReasoningAboutReasoning;
  rlfp?: RLFPLearner;
  cognitiveController?: CognitiveController;
  driveManager?: DriveManager;
  private readonly systemEventBus: NarEventBus;

  private readonly io: NARIO;
  private execution: NARExecution;
  private readonly lm: NARLM;
  private readonly config: NARConfig;
  private readonly processor: RuleProcessor;
  private readonly _metricsCollector: MetricsCollector;
  private readonly _lmService?: LMService;
  private readonly _registry?: SeNARSRegistry;
  private _lmInitialized = false;
  private _toolsInitialized = false;
  private _constitution: Task[] = [];
  /** TODO19 F2: per-instance kernel gates — isolated per NAR, injected or created. */
  readonly gates: GateRegistry;

  // System One components
  private _systemOneEmbeddingCache?: EmbeddingCache;
  private _systemOneManifold?: JudgmentManifold;
  private _systemOneDispatcher?: CognitiveDispatcher;
  private _systemOneGroundednessGate?: (narration: string) => Promise<boolean>;
  private _systemOneTraceGrader?: (trace: TraceGradeInput) => Promise<TraceGradeResult>;
  private _systemOneDataset?: JudgmentDataset;

  constructor(config: NARConfig & { eventBus?: NarEventBus } = DEFAULT_CONFIG) {
    const eventBus = config.eventBus ?? new NarEventBus();
    const logger = createLogger({ scope: 'NAR' });
    const metrics = new MetricsCollector();

    super({ logger, metrics, eventBus });

    this.config = { ...this.validateConfig(config) };
    this.gates = config.gateRegistry ?? createGateRegistry();
    this.memory = new Memory(this.config, { attentionModel: this.createAttentionModel(config) });
    this.processor = new RuleProcessor();
    this.processor.setConfig({ memory: this.memory, nar: this });
    this.processor.setEventBus(eventBus);
    this.reasoner = new Reasoner(this.memory, this.processor, BagStrategy, this.config);
    this.taskManager = new TaskManager(this.memory, { gateRegistry: this.gates });
    this.query = new QueryAPI(this.memory);
    this.traceAPI = new ReasoningTrace(this.memory);
    this.tools = new ToolManager({ eventBus, feedbackObserver: config.feedbackObserver });
    this._lmService = this.config.lmService;
    this._registry = this.config.providerRegistry;

    if (this.config.enableRLFP)
      this.rlfp = new RLFPLearner({ optimizeInterval: this.config.rlfp?.optimizeInterval });

    if (config.cognitiveParams && config.strategyRegistry) {
      this.cognitiveController = new CognitiveController(
        config.strategyRegistry,
        this.memory,
        this.processor,
        metrics,
        this.rlfp,
        config.cognitiveParams,
        config.adaptationInterval
      );
    }

    // System One initialization (behind config flag; disabled by default)
    // Must run before gateRegistry.initialize to provide perceptionConfig
    this.initializeSystemOne();

    // Initialize gate registry with System One perception config if enabled
    const perceptionConfig = this.config.systemOne?.enabled
      ? {
          systemOne: {
            enabled: true,
            manifold: this._systemOneManifold!,
            embeddingCache: this._systemOneEmbeddingCache!,
            reasoningBudget: this.config.systemOne.reasoningBudget ?? {
              maxCycles: 100,
              maxDepth: 10,
              maxMemoryOps: 1000,
              maxLMCalls: 5,
              consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
            },
            provisionalCInitial: this.config.systemOne.provisional?.cInitial ?? 0.1,
            provisionalDecayRate: this.config.systemOne.provisional?.decayRate ?? 0.3,
            provisionalMaxTtlMs: this.config.systemOne.provisional?.maxTtlMs ?? 30_000,
          },
        }
      : undefined;

    this.gates.initialize({
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

    this.io = new NARIO(this.memory, this.taskManager, this.config);
    this.io.setEventBus(eventBus);
    this.systemEventBus = new NarEventBus();
    this.io.setSystemEventBus(this.systemEventBus);
    this._emitJudgmentResolved = createTelemetryEmitter(
      createNarTelemetrySinks(this.systemEventBus)
    );
    this.driveManager = new DriveManager({
      input: (text, type, truth) => this.io.input(text, type, truth),
    });
    this.driveManager.setSystemEventBus(this.systemEventBus);
    // D23 (TODO17b): ambiguity at ingress stimulates curiosity (A4 closure).
    this.gates.getPerceptionGate().setDriveManager(this.driveManager);
    this.execution = new NARExecution(
      this.memory,
      this.taskManager,
      this.reasoner,
      this.config,
      this.rlfp,
      this.rlfp?.policyOptimizerPublic,
      this.cognitiveController,
      this.driveManager,
      this.systemEventBus,
      this.self,
      async (goalTerm) => this.tools.executeToolGoal(goalTerm),
      undefined,
      this.gates
    );
    this.lm = new NARLM(
      this.memory,
      this._registry,
      this.config.lmService,
      this.config.enableBidirectionalFeedback,
      this.config.enableProactiveEnrichment,
      {
        getDispatcher: () => this.getSystemOneDispatcher(),
        getManifold: () => this.getSystemOneManifold(),
        getEmbeddingCache: () => this.getSystemOneEmbeddingCache(),
      }
    );
    this._metricsCollector = metrics;

    this.initializeOptionalFeatures();
  }

  override async initialize(): Promise<void> {
    await super.initialize();
    this.logger!.info('NAR initialized');
  }

  override async start(): Promise<void> {
    if (!this.isInitialized()) {
      await this.initialize();
    }
    await super.start();
    await this.loadState();
    this.self?.start();
    this.lm.getEnricher()?.start();
    await this.injectBootstrapGoals();
    this.logger!.info('NAR started');
  }

  override async stop(): Promise<void> {
    this.self?.stop();
    this.stopLM();
    await this.saveState();
    await super.stop();
    this.logger!.info('NAR stopped');
  }

  override async dispose(): Promise<void> {
    this.self?.shutdown();
    this.stopLM();
    await super.dispose();
    this.logger!.info('NAR disposed');
  }

  /** Whether the kernel is in a running state. */
  override isRunning(): boolean {
    return super.isRunning();
  }

  /** Get current lifecycle state */
  getState(): string {
    return this.state;
  }

  /** Get the system event bus */
  getSystemEventBus(): NarEventBus {
    return this.systemEventBus;
  }

  async input(input: string | Term, type: TaskType = 'belief', truth?: TruthType): Promise<void> {
    return this.io.input(input, type, truth);
  }

  async believe(input: string | Term, truth?: TruthType): Promise<void> {
    return this.io.believe(input, truth);
  }

  async goal(input: string | Term, truth?: TruthType): Promise<void> {
    return this.io.goal(input, truth);
  }

  async question(input: string | Term): Promise<void> {
    return this.io.question(input);
  }

  async run(steps = 1, signal?: AbortSignal): Promise<number> {
    return this.execution.run(steps, signal);
  }

  async *runStream(steps = 1, maxResults = 100, signal?: AbortSignal): AsyncGenerator<Task> {
    yield* this.execution.runStream(steps, maxResults, signal);
  }

  getConcept(term: Term): Concept | undefined {
    return this.memory.getConcept(term);
  }

  listConcepts(): Concept[] {
    return this.memory.listConcepts();
  }

  clearMemory(): void {
    this.memory.clear();
  }

  getStatistics() {
    return this.memory.getStatistics();
  }

  getConfig(): NARConfig {
    return { ...this.config };
  }

  setConfig(updates: Partial<NARConfig>): void {
    Object.assign(this.config, updates);
    this.memory.setConfig(updates);
  }

  getLMClient(): LMService | undefined {
    return this._lmService;
  }

  getProviderRegistry(): SeNARSRegistry | undefined {
    return this._registry;
  }

  getSelfAnalyzer(): ReasoningAboutReasoning | undefined {
    return this.self;
  }

  getRLFP(): RLFPLearner | undefined {
    return this.rlfp;
  }

  getProcessor(): RuleProcessor {
    return this.processor;
  }

  getExecution(): NARExecution {
    return this.execution;
  }

  getCycleCount(): number {
    return this.execution.getCycleCount();
  }

  getController(): CognitiveController | undefined {
    return this.cognitiveController;
  }

  getDriveManager(): DriveManager | undefined {
    return this.driveManager;
  }

  getEventBus(): NarEventBus {
    return this.systemEventBus;
  }

  /** Get System One dispatcher (for proposeAndJudge, judge, synthesize). */
  getSystemOneDispatcher(): CognitiveDispatcher | undefined {
    return this._systemOneDispatcher;
  }

  /** Get System One manifold (for direct judgment access). */
  getSystemOneManifold(): JudgmentManifold | undefined {
    return this._systemOneManifold;
  }

  /** Get System One embedding cache (for zero-copy embeddings). */
  getSystemOneEmbeddingCache(): EmbeddingCache | undefined {
    return this._systemOneEmbeddingCache;
  }

  /** Get System One groundedness gate (for egress filtering). */
  getSystemOneGroundednessGate(): ((narration: string) => Promise<boolean>) | undefined {
    return this._systemOneGroundednessGate;
  }

  /** Get System One trace grader (E4 agent-trace grading; undefined when disabled). */
  getSystemOneTraceGrader(): ((trace: TraceGradeInput) => Promise<TraceGradeResult>) | undefined {
    return this._systemOneTraceGrader;
  }

  /** Check if System One is enabled and initialized. */
  isSystemOneEnabled(): boolean {
    return this._systemOneDispatcher !== undefined;
  }

  private _emitJudgmentResolved?: ReturnType<typeof createTelemetryEmitter>;

  /** Emit a judgment.resolved kernel event + Prometheus metric for a resolved proposition. */
  private emitJudgmentResolved(proposition: any, query?: any): void {
    this._emitJudgmentResolved?.(proposition, query);
  }

  /**
   * Create and bind a ManifoldReflex to a GameFocus.
   * This enables semantic reflex proposals from the Judgment Manifold
   * instead of (or in addition to) the incumbent bandit/Q-learning reflexes.
   * Returns the created reflex for external management, or undefined if System One is disabled.
   */
  attachManifoldReflex(gameFocus: {
    bindReflex: (reflex: Reflex) => void;
    setReflexPrefetchContext?: (context: {
      manifold: JudgmentManifold;
      embeddingCache: EmbeddingCache;
      budget: ReasoningBudget;
    }) => void;
  }): Reflex | undefined {
    if (!this.isSystemOneEnabled() || !this._systemOneManifold || !this._systemOneEmbeddingCache) {
      return undefined;
    }

    // Create incumbent reflex as fallback
    const incumbentReflex = new EpsilonGreedyReflex('incumbent', { numArms: 10, epsilon: 0.1 });

    // Create ManifoldReflex with incumbent fallback
    const manifoldReflex = new ManifoldReflex(incumbentReflex);

    // Bind to the GameFocus
    gameFocus.bindReflex(manifoldReflex);

    // Prefetch at the attend stage of each GameFocus step (C1) — the async gap is
    // absorbed before the synchronous propose contract.
    const manifold = this._systemOneManifold;
    const embeddingCache = this._systemOneEmbeddingCache;
    if (manifold && embeddingCache) {
      gameFocus.setReflexPrefetchContext?.({
        manifold,
        embeddingCache,
        budget: this.config.systemOne?.reasoningBudget ?? {
          maxCycles: 100,
          maxDepth: 10,
          maxMemoryOps: 1000,
          maxLMCalls: 5,
          consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
        },
      });
    }

    this.logger?.info('ManifoldReflex attached to GameFocus');
    return manifoldReflex;
  }

  private readonly attachedGames = new Map<string, { focus: GameFocus; bag: FocusBag }>();
  private gameFocusBag: FocusBag | null = null;
  private metaGame: SelfMetaGameImpl | null = null;
  private readonly metaGameFocuses = new Map<string, GameFocus>();

  /** Default FocusBag backing attachGame (created lazily, script-owned drive loops). */
  getFocusBag(): FocusBag {
    this.gameFocusBag ??= new FocusBag({ capacity: 32 });
    return this.gameFocusBag;
  }

  /**
   * Register a game with the kernel (TODO17 A4): creates a scoped-gate GameFocus,
   * binds the supplied reflexes (plus a ManifoldReflex when System One is enabled),
   * wires the prefetch context, and inserts the focus into a FocusBag.
   */
  attachGame(
    game: GameFocusOptions['game'],
    options: {
      id?: string;
      reflexes?: Reflex[];
      weight?: number;
      focusBag?: FocusBag;
      /** Bind an LMReflex (real-LM per-tick decisions) in addition to the manifold arm. */
      lmReflex?: boolean;
    } = {}
  ): GameFocus {
    const bag = options.focusBag ?? this.getFocusBag();
    const id = options.id ?? `game-${game.constructor.name}-${bag.getFocusWeights().size}`;
    const focus = new GameFocus({
      focusId: id,
      game,
      focusOptions: { weight: options.weight ?? 1.0 },
    });
    for (const reflex of options.reflexes ?? []) focus.bindReflex(reflex);
    if (this.isSystemOneEnabled()) this.attachManifoldReflex(focus);
    if (options.lmReflex && this.isSystemOneEnabled()) this.attachLMReflex(focus);
    bag.add(focus.focus);
    this.attachedGames.set(id, { focus, bag });
    this.metaGameFocuses.set(id, focus);
    return focus;
  }

  /** Remove a game's focus from the bag and drop its scoped gates (no residue). */
  detachGame(id: string): boolean {
    const entry = this.attachedGames.get(id);
    if (!entry) return false;
    entry.bag.remove(id);
    entry.focus.releaseScope();
    this.attachedGames.delete(id);
    this.metaGameFocuses.delete(id);
    return true;
  }

  getAttachedGames(): string[] {
    return [...this.attachedGames.keys()];
  }

  /**
   * Self-meta-game over the attached games (TODO17b D20): lazily created so
   * focus step reports (via FocusSchedulerOptions.metaGame) route self-improvement
   * proposals through the governance pipeline.
   */
  getSelfMetaGame(): SelfMetaGameImpl {
    this.metaGame ??= createSelfMetaGame({
      id: 'nar-self-meta-game',
      observesFocuses: [...this.attachedGames.keys()],
      focusBag: this.getFocusBag(),
      gameFocuses: this.metaGameFocuses,
    });
    return this.metaGame;
  }

  /**
   * Create and bind an LMReflex to a GameFocus (TODO17 C1): a real LM decides
   * per tick under a GBNF action grammar; the manifold judges its candidates.
   * Undefined when System One (dispatcher) is disabled.
   */
  attachLMReflex(
    gameFocus: {
      bindReflex: (reflex: Reflex) => void;
      setReflexPrefetchContext?: (context: {
        manifold: JudgmentManifold;
        embeddingCache: EmbeddingCache;
        budget: ReasoningBudget;
      }) => void;
    },
    options: { maxCandidates?: number } = {}
  ): Reflex | undefined {
    const dispatcher = this._systemOneDispatcher;
    const embeddingCache = this._systemOneEmbeddingCache;
    const manifold = this._systemOneManifold;
    if (!this.isSystemOneEnabled() || !dispatcher || !embeddingCache || !manifold) return undefined;

    const incumbent = new EpsilonGreedyReflex('lm-incumbent', { numArms: 10, epsilon: 0.1 });
    const lmReflex = new LMReflex({
      fallback: incumbent,
      dispatcher,
      embeddingCache,
      budget: this.config.systemOne?.reasoningBudget ?? {
        maxCycles: 100,
        maxDepth: 10,
        maxMemoryOps: 1000,
        maxLMCalls: 5,
        consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
      },
      dataset: this._systemOneDataset,
      maxCandidates: options.maxCandidates ?? this.config.systemOne?.lmReflex?.maxCandidates ?? 3,
    });
    gameFocus.bindReflex(lmReflex);
    gameFocus.setReflexPrefetchContext?.({ manifold, embeddingCache, budget: lmReflex.budget });
    this.logger?.info('LMReflex attached to GameFocus');
    return lmReflex;
  }

  getMetricsCollector(): MetricsCollector {
    return this._metricsCollector;
  }

  reconfigure(params: CognitiveParameters): void {
    if (!this.cognitiveController) {
      throw new ConfigurationError('NAR was not created with cognitive architecture enabled');
    }
    const registry = this.config.strategyRegistry;
    if (!registry) {
      throw new ConfigurationError('NAR has no strategy registry — cannot reconfigure');
    }
    this.cognitiveController = new CognitiveController(
      registry,
      this.memory,
      this.processor,
      this._metricsCollector,
      this.rlfp,
      params,
      this.config.adaptationInterval
    );
    this.execution = new NARExecution(
      this.memory,
      this.taskManager,
      this.reasoner,
      this.config,
      this.rlfp,
      this.rlfp?.policyOptimizerPublic,
      this.cognitiveController,
      this.driveManager,
      this.systemEventBus,
      this.self,
      async (goalTerm) => this.tools.executeToolGoal(goalTerm),
      undefined,
      this.gates
    );
  }

  setRLFP(rlfp: RLFPLearner): void {
    this.rlfp = rlfp;
  }

  inputTask(task: Task): void {
    const gate = this.gates.getPerceptionGate();
    const result = gate.admitTask(task.term, task.type, task.truth, 'nar-api', task.stamp.id);

    if (!result.admitted) {
      this.logger?.warn('Perception gate rejected task', {
        reason: result.rejectionReason,
        term: task.term.toString(),
      });
      return;
    }

    this.taskManager.addTask(task);
  }

  getPhaseTimer() {
    return this.execution.getPhaseTimer();
  }

  getLMClientStats() {
    return this._lmService?.getStats?.();
  }

  getLMRuleExecutionLog() {
    return this.processor.getLMRuleExecutionLog();
  }

  clearLMRuleExecutionLog() {
    this.processor.clearLMRuleExecutionLog();
  }

  getQualityModel() {
    return this.getModelWithFallback('quality');
  }

  getFastModel() {
    return this.getModelWithFallback('fast');
  }

  setConstitution(beliefs: Task[]): void {
    this._constitution = beliefs.map((b) => ({
      ...b,
      stamp: { ...b.stamp, source: 'CONSTITUTION' as const },
    }));
  }

  getConstitution(): Task[] {
    return [...this._constitution];
  }

  checkConstitutionViolation(belief: Task): boolean {
    return this._constitution.some((c) => this.contradicts(belief.term, c.term));
  }

  attentionReport(): { concepts: Array<{ term: string; priority: number }>; total: number } {
    const concepts = this.memory.listConcepts();
    const sorted = concepts
      .map((c) => ({
        term: c.term.toString(),
        priority: c.priority,
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 20);
    return { concepts: sorted, total: concepts.length };
  }

  loadDomain(domain: { name: string; beliefs: string[] }): void {
    for (const belief of domain.beliefs) this.io.input(belief);
  }

  async askNaturalLanguage(question: string): Promise<string> {
    const lm = this._lmService;
    if (!lm) return 'LM client not configured';

    const translatePrompt = `Convert this natural language question to Narsese query format. Only output the Narsese, nothing else. Question: "${question}"`;
    const narsese = await lm.generateText(translatePrompt);
    const cleaned = narsese.trim().replace(/^<|>$/g, '').trim();
    const queryTerm = termParser.parse(cleaned);
    const subjectTerm = queryTerm ? getSubject(queryTerm) : undefined;

    await this.io.input(cleaned + '?');
    await this.run(5);

    const beliefs = this.query.getBeliefs();
    const relevant = subjectTerm
      ? beliefs.filter((b) => containsSubterm(b.term, subjectTerm))
      : queryTerm
        ? beliefs.filter((b) => containsSubterm(b.term, queryTerm))
        : beliefs;

    if (relevant.length === 0) return "I don't have enough knowledge to answer that.";

    const best = relevant[0]!;
    const result = `${best.term.toString()} ${Truth.format(best.truth)}`;
    const explainPrompt = `Convert this Narsese result to a natural language answer. Narsese: ${result} Question: "${question}" Only output the answer, nothing else.`;

    return lm.generateText(explainPrompt);
  }

  getBeliefs(filter?: Record<string, unknown>): Task[] {
    return this.query.getBeliefs(filter);
  }

  getRevisionHistory(term: Term): Array<{
    truth: { frequency: number; confidence: number };
    stampId: string;
    timestamp: number;
    source: 'input' | 'derivation' | 'revision' | 'inference';
  }> {
    const key = term.toString();
    return this.memory.getRevisionHistory(key);
  }

  getGoals(filter?: Record<string, unknown>): Task[] {
    return this.query.getGoals(filter);
  }

  getQuestions(filter?: Record<string, unknown>): Task[] {
    return this.query.getQuestions(filter);
  }

  queryTerm(term: Term, filter?: Record<string, unknown>) {
    return this.query.query(term, filter);
  }

  ask(question: string | Term) {
    return this.query.ask(question);
  }

  getDerivationHistory(task: Task) {
    return this.traceAPI.getDerivationHistory(task);
  }

  traceTerm(term: Term) {
    return this.traceAPI.trace(term);
  }

  explain(conclusion: Task) {
    return this.traceAPI.explain(conclusion);
  }

  recordRuleExecution(ruleId: string, success: boolean, duration: number) {
    this._metricsCollector.recordRuleExecution(ruleId, success, duration);
  }

  incrementDerivations(count?: number) {
    this._metricsCollector.incrementDerivations(count);
  }

  incrementSteps(count?: number) {
    this._metricsCollector.incrementSteps(count);
  }

  getMetrics() {
    return this._metricsCollector.getSummary();
  }

  async initializeLM(): Promise<void> {
    if (this._lmInitialized || !this._lmService) return;
    this.initializeLMRules(this._lmService);
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    return this.tools.execute(name, args);
  }

  listTools(): Tool[] {
    return this.tools.list();
  }

  export() {
    return this.io.export();
  }

  import(data: any) {
    return this.io.import(data);
  }

  async saveToFile(filename: string): Promise<void> {
    await this.io.saveToFile(filename);
  }

  async loadFromFile(filename: string): Promise<void> {
    await this.io.loadFromFile(filename);
  }

  async getMemoryState(): Promise<any> {
    return this.io.getMemoryState();
  }

  async loadMemoryState(state: any): Promise<void> {
    await this.io.loadMemoryState(state);
  }

  async processHypothesisWithFeedback(hypothesis: Task): Promise<boolean> {
    return this.lm.processHypothesisWithFeedback(hypothesis);
  }

  async enrichMemoryWithLM(): Promise<void> {
    await this.lm.enrichMemory();
  }

  getEnrichmentStats() {
    return this.lm.getEnrichmentStats();
  }

  getFeedbackStats() {
    return this.lm.getFeedbackStats();
  }

  private getStatePath(filename: string): string {
    const base = this.config.statePath ?? '.cache/nar-state';
    return path.resolve(base, filename);
  }

  private async readJsonIfExists<T>(filename: string): Promise<T | null> {
    const target = this.getStatePath(filename);
    try {
      const content = await fs.readFile(target, 'utf-8');
      return JSON.parse(content) as T;
    } catch (e: any) {
      if (e?.code !== 'ENOENT') throw e;
      return null;
    }
  }

  private serializeTask(task: Task) {
    return {
      term: task.term.toString(),
      type: task.type,
      truth: task.truth ? Truth.create(task.truth.f, task.truth.c) : undefined,
      stamp: task.stamp,
    };
  }

  private rehydrateTask(
    record: { term: string; type?: TaskType; truth?: TruthType; stamp?: any },
    type: TaskType
  ) {
    const punctuation =
      (record.type ?? type) === 'belief' ? '.' : (record.type ?? type) === 'goal' ? '!' : '?';
    const parsed = termParser.parse(`${record.term}${punctuation}`);
    return (
      parsed && {
        term: parsed,
        type: record.type ?? type,
        truth: record.truth ?? Truth.NEUTRAL,
        budget: { priority: 0.5, durability: 0.8, quality: 0.9, cycles: 0, depth: 0 },
        stamp: record.stamp ?? Stamp.createInput(),
        occurrenceTime: Date.now() as any,
        derived: false,
      }
    );
  }

  private async saveState(): Promise<void> {
    if (!this.config.persistState) return;
    try {
      const driveStates = this.driveManager?.getAllStates() ?? [];
      const drives: Record<string, number> = {};
      for (const ds of driveStates) drives[ds.spec.id] = ds.currentIntensity;

      const files: Array<[string, unknown]> = [
        ['beliefs.json', this.query.getBeliefs().map((b) => this.serializeTask(b))],
        ['goals.json', this.query.getGoals().map((g) => this.serializeTask(g))],
        ['questions.json', this.query.getQuestions().map((q) => this.serializeTask(q))],
        ['attention.json', this.attentionReport()],
        ['drives.json', drives],
        ['lm-rules.json', this.processor.serializeLMRules()],
      ];

      await fs.mkdir(path.dirname(this.getStatePath(files[0]![0])), { recursive: true });
      await Promise.all(
        files.map(([name, data]) =>
          fs.writeFile(this.getStatePath(name), JSON.stringify(data, null, 2), 'utf-8')
        )
      );
    } catch (e) {
      this.logger!.warn('NAR state save failed', { error: errMsg(e) });
    }
  }

  private async loadState(): Promise<void> {
    if (!this.config.persistState) return;
    try {
      const taskFiles: Array<[string, TaskType]> = [
        ['beliefs.json', 'belief'],
        ['goals.json', 'goal'],
        ['questions.json', 'question'],
      ];
      for (const [name, type] of taskFiles) {
        const records = await this.readJsonIfExists<any[]>(name);
        if (!records) continue;
        for (const record of records) {
          try {
            const task = this.rehydrateTask(record, type);
            if (task) this.memory.addTask(task.term, task.type, task.truth, task.budget);
          } catch (e) {
            this.logger!.warn('Skipping unparseable persisted task', { error: errMsg(e) });
          }
        }
      }

      const drives = await this.readJsonIfExists<Record<string, number>>('drives.json');
      if (this.driveManager && drives) {
        for (const [driveId, value] of Object.entries(drives)) {
          const currentIntensity = this.driveManager.getState(driveId)?.currentIntensity ?? 0;
          this.driveManager.stimulate(driveId, Number(value) - currentIntensity);
        }
      }

      const lmRuleState = await this.readJsonIfExists<{ rules: any[] }>('lm-rules.json');
      if (lmRuleState) this.processor.deserializeLMRules(lmRuleState);

      this.logger!.info('NAR state loaded');
    } catch (e) {
      this.logger!.warn('NAR state load failed', { error: errMsg(e) });
    }
  }

  private stopLM(): void {
    this.lm.getEnricher()?.stop();
  }

  private getModelWithFallback(prefix: string) {
    if (!this._registry) return undefined;
    try {
      return (this._registry as any).languageModel(`local:${prefix}`);
    } catch {
      return (this._registry as any).languageModel('builtin:compact');
    }
  }

  private initializeOptionalFeatures(): void {
    if (this.config.enableLMRules && this.config.lmService) {
      this.initializeLMRules(this.config.lmService);
    }
    if (this.config.enableTools) {
      this.initializeTools();
    }
    if (this.config.enableSelf) {
      this.self = new ReasoningAboutReasoning(this, {});
    }
  }

  /** Initialize System One components behind config flag. Disabled by default for byte-identical baseline behavior. */
  private initializeSystemOne(): void {
    const systemOneConfig = this.config.systemOne;
    if (!systemOneConfig?.enabled) {
      return;
    }

    const reasoningBudget: ReasoningBudget = systemOneConfig.reasoningBudget ?? {
      maxCycles: 100,
      maxDepth: 10,
      maxMemoryOps: 1000,
      maxLMCalls: 5,
      consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
    };

    // Create embedding cache (zero-copy, pooled Float32Array)
    const encoderConfig =
      systemOneConfig.manifold && !('judgeBatch' in systemOneConfig.manifold)
        ? (systemOneConfig.manifold as SystemOneConfigSchema['manifold']).encoder
        : undefined;
    const encoder = createEmbeddingGenerator(undefined, encoderConfig);
    this._systemOneEmbeddingCache =
      systemOneConfig.embeddingCache ??
      createEmbeddingCache({
        maxSize: 10000,
        ttlMs: 300_000,
        dimension: encoderConfig?.dimension ?? encoder.dimension,
        generator: encoder,
      });

    // Create manifold with per-head config from systemOne config
    let manifold: JudgmentManifold;
    const manifoldFileConfig = systemOneConfig.manifold as
      | SystemOneConfigSchema['manifold']
      | undefined;
    if (manifoldFileConfig?.provider === 'http' && manifoldFileConfig.endpoint) {
      // D4: remote judge over the /v1/systemone wire shape; local cache still
      // produces the context embedding; remote results are untrusted (LLM_PRIOR ceiling).
      manifold = createHttpManifold({
        endpoint: manifoldFileConfig.endpoint,
        embeddingCache: this._systemOneEmbeddingCache!,
        timeoutMs: manifoldFileConfig.timeoutMs,
      });
    } else if (systemOneConfig.manifold && 'judgeBatch' in systemOneConfig.manifold) {
      // Pre-built manifold provided
      manifold = systemOneConfig.manifold as JudgmentManifold;
    } else {
      const manifoldConfig = (systemOneConfig.manifold as SystemOneConfigSchema['manifold']) ?? {};
      const perHeadConfig: Record<string, any> = {};
      if (manifoldConfig.heads) {
        for (const [key, headConfig] of Object.entries(manifoldConfig.heads)) {
          perHeadConfig[key] = {
            modelDigest: headConfig.modelDigest,
            calibrationVersion: headConfig.calibrationVersion,
            abstainThreshold: headConfig.abstainThreshold,
            enabled: headConfig.enabled,
          };
        }
      }

      manifold = createManifold(this._systemOneEmbeddingCache!, {
        backendId: 'encoder-wasm-s1' as any,
        modelDigest: composeModelDigest(
          encoderDigest(
            encoderConfig?.modelId ?? 'Xenova/all-MiniLM-L6-v2',
            encoderConfig?.dimension ?? 384
          ),
          'all-MiniLM-L6-v2-heads-v1'
        ) as any,
        calibrationVersion: 'v2.4.1' as any,
        perHeadConfig,
        maxBatchSize: 64,
        maxLatencyMs: 33,
        abstainThreshold: 0.3,
      });
    }

    this._systemOneManifold = manifold;

    // Emit judgment.resolved telemetry from the real Tier 1 manifold
    if ('setPropositionCallback' in manifold) {
      const m = manifold as {
        setPropositionCallback: (cb: (proposition: any, query: any) => void) => void;
        getPropositionCallback?: () => ((proposition: any, query: any) => void) | undefined;
      };
      const previous = m.getPropositionCallback?.();
      m.setPropositionCallback((proposition, query) => {
        previous?.(proposition, query);
        this.emitJudgmentResolved(proposition, query);
      });
    }

    // Create cortex adapter if provider is not 'off'
    let cortex: import('./lm/system-one/types.js').GenerativeCortex;
    if (
      systemOneConfig.cortex?.provider &&
      systemOneConfig.cortex.provider !== 'off' &&
      this._lmService
    ) {
      cortex = createLMServiceCortex({
        lmService: this._lmService,
        grammar: 'narsese-term',
        temperature: 0,
        model: systemOneConfig.cortex?.model,
      });
    } else {
      cortex = new StubCortex('off');
    }

    // Create dispatcher with all four tiers (real manifold as Tier 1)
    this._systemOneDispatcher = createDispatcher(
      true,
      {
        embeddingCache: this._systemOneEmbeddingCache!,
        tier1Manifold: manifold,
        provisional: {
          cInitial: systemOneConfig.provisional?.cInitial ?? 0.1,
          decayRate: systemOneConfig.provisional?.decayRate ?? 0.3,
          maxTtlMs: systemOneConfig.provisional?.maxTtlMs ?? 30_000,
        },
      },
      cortex
    );

    // Create groundedness gate for egress filtering
    this._systemOneGroundednessGate = createGroundednessGate({
      manifold: this._systemOneManifold!,
      embeddingCache: this._systemOneEmbeddingCache!,
      threshold: 0.7,
    });

    // E4: trace grader over the live manifold; dataset auto-flush (D3) when enabled
    const datasetPath = systemOneConfig.distillation?.datasetPath;
    if (datasetPath) {
      this._systemOneDataset = new JudgmentDataset();
      this._systemOneDataset.setVectorSidecarPath('.cache/systemone/vectors');
      if (systemOneConfig.distillation?.autoFlush) {
        this._systemOneDataset.startAutoFlush(datasetPath);
      }
    }
    this._systemOneTraceGrader = createTraceGrader({
      manifold: this._systemOneManifold!,
      embeddingCache: this._systemOneEmbeddingCache!,
      dataset: this._systemOneDataset,
    });

    this.logger?.info('System One initialized', {
      manifold: this._systemOneManifold ? 'enabled' : 'disabled',
      dispatcher: this._systemOneDispatcher ? 'enabled' : 'disabled',
      cortex: systemOneConfig.cortex?.provider ?? 'off',
    });
  }

  private async injectBootstrapGoals(): Promise<void> {
    const tasks = createBootstrapTasks();
    for (const task of tasks) {
      await this.io.input(task.term, task.type, task.truth as any);
    }
  }

  private validateConfig(config: NARConfig): NARConfig {
    if (config.maxConcepts <= 0) {
      throw new ConfigurationError('maxConcepts must be positive', {
        maxConcepts: config.maxConcepts,
      });
    }
    return config;
  }

  private initializeLMRules(lmService: LMService): void {
    const lmRules = LMRules.createAll(lmService as any);
    const structuredModel = this._registry
      ? getModelForTask(this._registry, 'structured')
      : undefined;

    const toolDispatcher = async (tool: string, args: Record<string, unknown>) => {
      return this.executeTool(tool, args);
    };

    // Get System One dispatcher if available
    const systemOneDispatcher = this.getSystemOneDispatcher();

    // Create System One rule adapter for translation rule
    /** §8 dispositions served by the System One rule adapter (F5). */
    const SYSTEM_ONE_DISPOSITION_RULES = new Set([
      'lm-narsese-translation',
      'lm-meta-reasoning',
      'lm-uncertainty-calibration',
    ]);

    const systemOneAdapter = systemOneDispatcher
      ? createSystemOneLMRuleAdapter({
          dispatcher: systemOneDispatcher,
          nar: {
            getCycleCount: () => this.getCycleCount(),
            getSystemOneEmbeddingCache: () => this.getSystemOneEmbeddingCache(),
            getSystemOneManifold: () => this.getSystemOneManifold(),
          },
          logger: this.logger,
        })
      : null;

    for (const rule of lmRules) {
      if (structuredModel) rule.setStructuredModel(structuredModel);
      rule.setSystemEventBus(this.systemEventBus);
      rule.setEventBus(this.systemEventBus);
      rule.setNAR(this);
      rule.setToolDispatcher(toolDispatcher);

      // §8 dispositions with a System One adapter (F5): translation REPLACE
      // via proposeAndJudge, meta-reasoning + uncertainty-calibration REPLACE
      // via manifold scoring/calibrators.
      if (systemOneAdapter && SYSTEM_ONE_DISPOSITION_RULES.has(rule.id)) {
        rule.setSystemOneAdapter(systemOneAdapter);
      }

      this.processor.registerLMRule(rule);
    }
    this._lmInitialized = true;
  }

  private initializeTools(): void {
    if (this._toolsInitialized) return;

    const toolDeps = { memory: this.memory, nar: this } as Record<string, unknown>;
    const tools = discoverTools(toolDeps);
    for (const tool of tools) {
      this.tools.register(tool);
    }

    // Self-improvement tools (goal→tool dispatch target) — registered when self-reasoning is enabled.
    if (this.config.enableSelf) {
      const selfTools = createSelfTools({
        workspaceRoot: process.cwd(),
        nar: this,
        rlfpLearner: this.rlfp,
        cognitiveController: this.cognitiveController,
        toolManager: this.tools,
        ruleProcessor: this.processor,
      });
      for (const [name, selfTool] of Object.entries(selfTools)) {
        try {
          // ai-style tools carry no name — inject the registry key.
          this.tools.register({ ...(selfTool as object), name } as Tool);
        } catch (e) {
          this.logger!.warn('Self-tool registration skipped', { name, error: errMsg(e) });
        }
      }
    }
    this._toolsInitialized = true;
  }

  private createAttentionModel(config: NARConfig): AttentionModel {
    const type = config.cognitiveParams?.strategies.attention.type;
    if (!type) return new SimpleAttention();
    return config.strategyRegistry?.get('attention', type) ?? new SimpleAttention();
  }

  private contradicts(a: Term, b: Term): boolean {
    if (termsEqual(a, b)) return true;
    const [aArg] = a.kind === 'negation' ? a.args : [];
    const [bArg] = b.kind === 'negation' ? b.args : [];
    return (!!aArg && termsEqual(aArg, b)) || (!!bArg && termsEqual(bArg, a));
  }
}
