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
import { createSelfTools } from './tools/adapters/self-tools.js';
import { ConfigurationError, DEFAULT_CONFIG, NarEventBus, type Task, type TaskType } from './types';

/** Bounded derivation-chain ring per AIKR (no I/O on the hot path). */
const DERIVATION_RING_CAP = 256;

import { errMsg } from './utils';

export { MetricsCollector } from './metrics';

export type {
  NARConfig,
  RLFPConfig,
  SystemOneConfig,
  SystemOneFileConfig,
  SystemOneRuntimeConfig,
} from './nar/config.js';

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
  /** TODO25 follow-on: bounded derivation-chain ring, fuel for SchemaInductor; Phase D live ProofStream source. */
  #proofRing = new ProofStreamRing<readonly Task[]>(DERIVATION_RING_CAP);
  #schemaInductor?: SchemaInductor;
  /** Phase B (REFACTOR.todo2): episodic consolidation process — created only when config opts in. */
  #episodeConsolidator?: EpisodeConsolidator;
  /** Phase D (REFACTOR.todo2): bounded hard-negative mining bag — created only when config opts in. */
  #miningBag?: MiningBag;
  #sourceReputation?: import('./kernel/source-reputation.js').SourceReputation;
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

  // Extracted subsystems (M2)
  private readonly systemOne: SystemOneRuntime;
  private readonly games: GameManager;
  private readonly persister: StatePersister;

  constructor(config: NARConfig & { eventBus?: NarEventBus } = DEFAULT_CONFIG) {
    const eventBus = config.eventBus ?? new NarEventBus();
    const logger = createLogger({ scope: 'NAR' });
    const metrics = new MetricsCollector();

    super({ logger, metrics, eventBus });

    this.config = { ...validateNarConfig(config) };
    this.gates = config.gateRegistry ?? createGateRegistry();
    this.memory = new Memory(this.config, { attentionModel: createAttentionModel(config) });
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

    if (this.config.episodeConsolidation?.enabled) {
      const cfg = this.config.episodeConsolidation;
      this.#episodeConsolidator = new EpisodeConsolidator({
        capacity: cfg.capacity,
        budget: cfg.budget,
      });
    }

    if (this.config.hardNegativeMining?.bounded) {
      const cfg = this.config.hardNegativeMining;
      this.#miningBag = new MiningBag({
        capacity: cfg.capacity,
        budget: cfg.budget,
        marginFloor: cfg.marginFloor,
      });
    }

    if (config.cognitiveParams && config.strategyRegistry) {
      this.cognitiveController = new CognitiveController(
        config.strategyRegistry,
        this.memory,
        this.processor,
        metrics,
        this.rlfp,
        config.cognitiveParams,
        config.adaptationInterval,
        (chain) => this.#recordDerivationChain(chain)
      );
    }

    // Extracted subsystems. System One must initialize before gateRegistry.initialize
    // to provide perceptionConfig.
    this.systemOne = new SystemOneRuntime(config, {
      lmService: this._lmService,
      onJudgmentResolved: (proposition, query) => this.emitJudgmentResolved(proposition, query),
    });

    // Initialize gate registry with System One perception config if enabled
    const perceptionConfig = this.config.systemOne?.enabled
      ? {
          systemOne: {
            enabled: true,
            judge: new SystemOneIngressJudge({
              manifold: this.systemOne.manifold!,
              embeddingCache: this.systemOne.embeddingCache!,
              budget: this.config.systemOne.reasoningBudget ?? {
                maxCycles: 100,
                maxDepth: 10,
                maxMemoryOps: 1000,
                maxLMCalls: 5,
                consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
              },
              reputation: () => this.#sourceReputation,
              provider: () => this._lmService?.provider,
            }),
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
    // Phase E: reputation consulted lazily at admission/seeding time (C1 default-neutral).
    if (this.#sourceReputation) this.gates.setReputation(this.#sourceReputation);

    this.io = new NARIO(this.memory, this.taskManager, this.config);
    this.io.setEventBus(eventBus);
    this.systemEventBus = new NarEventBus();
    this.io.setSystemEventBus(this.systemEventBus);
    this.games = new GameManager(this.systemOne, config.rng, config.proposals, this.systemEventBus);
    this._emitJudgmentResolved = createTelemetryEmitter(
      createNarTelemetrySinks(this.systemEventBus)
    );
    this.driveManager = new DriveManager({
      input: (text, type, truth) => this.io.input(text, type, truth),
    });
    this.driveManager.setSystemEventBus(this.systemEventBus);
    this.persister = new StatePersister({
      config: this.config,
      memory: this.memory,
      processor: this.processor,
      driveManager: this.driveManager,
      attentionReport: () => this.attentionReport(),
      query: this.query,
    });
    // D23 (TODO17b): ambiguity at ingress stimulates curiosity (A4 closure).
    this.gates.getPerceptionGate().setDriveManager(this.driveManager);
    this.execution = new NARExecution({
      memory: this.memory,
      taskManager: this.taskManager,
      reasoner: this.reasoner,
      config: this.config,
      rlfp: this.rlfp,
      policyOptimizer: this.rlfp?.policyOptimizerPublic,
      cognitiveController: this.cognitiveController,
      driveManager: this.driveManager,
      systemEventBus: this.systemEventBus,
      self: this.self,
      toolGoalExecutor: async (goalTerm) => this.tools.executeToolGoal(goalTerm),
      gates: this.gates,
    });
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
    this.logger?.info('NAR initialized');
  }

  override async start(): Promise<void> {
    if (!this.isInitialized()) {
      await this.initialize();
    }
    await super.start();
    await this.persister.load();
    this.self?.start();
    this.lm.getEnricher()?.start();
    await this.injectBootstrapGoals();
    this.logger?.info('NAR started');
  }

  override async stop(): Promise<void> {
    this.self?.stop();
    this.stopLM();
    await this.persister.save();
    await super.stop();
    this.logger?.info('NAR stopped');
  }

  override async dispose(): Promise<void> {
    this.self?.shutdown();
    this.stopLM();
    await super.dispose();
    this.logger?.info('NAR disposed');
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

  /** Record one derivation chain (bounded ring; called from the CognitiveController sink). */
  #recordDerivationChain(chain: readonly Task[]): void {
    const copy = [...chain];
    this.#proofRing.push(copy);
    // Phase C (REFACTOR.todo1): continuous SchemaInductor admission (AIKR-bounded).
    if (this.#schemaInductor) this.#schemaInductor.onDerivation(copy);
  }

  /** Lazily-owned SchemaInductor (Phase C); undefined without an LM service. */
  getSchemaInductor(): import('./learning/schema-induction.js').SchemaInductor | undefined {
    if (!this.#schemaInductor && this._lmService) {
      this.#schemaInductor = new SchemaInductor(this.memory, this._lmService, {
        rng: this.config.rng,
      });
    }
    return this.#schemaInductor;
  }

  /** Latest derivation chains (bounded ring) — SchemaInductor fuel (TODO25). */
  getDerivationChains(limit = 64): readonly (readonly Task[])[] {
    return this.#proofRing.snapshot(limit);
  }

  /** Phase D (REFACTOR.todo1): live ProofStream over the bounded derivation ring. */
  getProofStream(signal?: AbortSignal): AsyncIterable<readonly Task[]> {
    return this.#proofRing.stream(signal);
  }

  /** Phase B (REFACTOR.todo1): wire the shared parameter ledger into every writer NAR owns. */
  setParameterLedger(ledger: ParameterLedger): void {
    this.rlfp?.attachLedger(ledger);
    this.games.getSelfMetaGame().attachParameterLedger(ledger, 'self-meta-game');
  }

  /** Phase E (REFACTOR.todo1): attach the source-reputation track record (trust ceiling). */
  setSourceReputation(reputation: import('./kernel/source-reputation.js').SourceReputation): void {
    this.#sourceReputation = reputation;
    this.gates.setReputation(reputation);
  }

  getSourceReputation(): import('./kernel/source-reputation.js').SourceReputation | undefined {
    return this.#sourceReputation;
  }

  getDriveManager(): DriveManager | undefined {
    return this.driveManager;
  }

  getEventBus(): NarEventBus {
    return this.systemEventBus;
  }

  /** Get System One dispatcher (for proposeAndJudge, judge, synthesize). */
  getSystemOneDispatcher(): CognitiveDispatcher | undefined {
    return this.systemOne.dispatcher;
  }

  /** Get System One manifold (for direct judgment access). */
  getSystemOneManifold(): JudgmentManifold | undefined {
    return this.systemOne.manifold;
  }

  /** Get System One embedding cache (for zero-copy embeddings). */
  getSystemOneEmbeddingCache(): EmbeddingCache | undefined {
    return this.systemOne.embeddingCache;
  }

  /** Get the unified decision facade (TODO23): decide/choose with provenance. */
  getSystemOneDecider(): import('./lm/system-one/decide.js').Decider | undefined {
    return this.systemOne.decider;
  }

  /** Get System One groundedness gate (for egress filtering). */
  getSystemOneGroundednessGate(): ((narration: string) => Promise<boolean>) | undefined {
    return this.systemOne.groundednessGate;
  }

  /** Get System One trace grader (E4 agent-trace grading; undefined when disabled). */
  getSystemOneTraceGrader(): ((trace: TraceGradeInput) => Promise<TraceGradeResult>) | undefined {
    return this.systemOne.traceGrader;
  }

  /** CLM contrastive exemplar memory (zero-shot scoring; undefined when disabled). */
  getSystemOneContrastive():
    | import('./lm/system-one/contrastive.js').ContrastiveMemory
    | undefined {
    return this.systemOne.enabled ? this.systemOne.contrastive : undefined;
  }

  /** Refresh CLM contrastive exemplars from live state (hard negatives + calibration). */
  refreshSystemOneContrastive(
    episodic?: import('./memory/EpisodicMemory.js').EpisodicMemory
  ): Promise<void> {
    return this.systemOne.refreshContrastive(this, episodic);
  }

  /** Phase C (REFACTOR.todo1): AIKR-bounded learning maintenance (decay + pressure-gated drain). */
  async consolidateLearning(options: { budget?: number } = {}): Promise<void> {
    return consolidateLearning(this, options);
  }

  /** Phase D (REFACTOR.todo2): the bounded mining bag, when config opts in. */
  getMiningBag(): MiningBag | undefined {
    return this.#miningBag;
  }

  /** Phase B (REFACTOR.todo2): the episodic consolidation process, when enabled in config. */
  getEpisodeConsolidator(): EpisodeConsolidator | undefined {
    return this.#episodeConsolidator;
  }

  /** Phase B: wire the summary sink post-construction (integrator owns persistence). */
  attachEpisodeConsolidatorSink(emit: (episode: Episode) => Promise<void> | void): void {
    this.#episodeConsolidator?.setSink(emit);
  }

  /** Check if System One is enabled and initialized. */
  isSystemOneEnabled(): boolean {
    return this.systemOne.enabled;
  }

  private _emitJudgmentResolved?: (
    proposition: any,
    query?: any,
    provenance?: {
      inputDigest?: string;
      calibrationDigest?: string;
      decisionBand?: 'act' | 'review' | 'block' | 'abstain';
    }
  ) => void;

  /** Emit a judgment.resolved kernel event + Prometheus metric for a resolved proposition. */
  private emitJudgmentResolved(
    proposition: any,
    query?: any,
    provenance?: {
      inputDigest?: string;
      calibrationDigest?: string;
      decisionBand?: 'act' | 'review' | 'block' | 'abstain';
    }
  ): void {
    this._emitJudgmentResolved?.(proposition, query, provenance);
  }

  attachManifoldReflex(gameFocus: {
    bindReflex: (reflex: Reflex) => void;
    setReflexPrefetchContext?: (context: {
      manifold: JudgmentManifold;
      embeddingCache: EmbeddingCache;
      budget: ReasoningBudget;
    }) => void;
  }): Reflex | undefined {
    return this.systemOne.attachManifoldReflex(gameFocus);
  }

  getFocusBag(): FocusBag {
    return this.games.getFocusBag();
  }

  attachGame(
    game: GameFocusOptions['game'],
    options: {
      id?: string;
      reflexes?: Reflex[];
      weight?: number;
      focusBag?: FocusBag;
      /** Bind an LMReflex (real-LM per-tick decisions) in addition to the manifold arm. */
      lmReflex?: boolean;
      /** Phase C (REFACTOR.todo3): extra proposers (e.g. MettaProposer) + contradiction bus. */
      proposers?: GameFocusOptions['proposers'];
      eventBus?: GameFocusOptions['eventBus'];
    } = {}
  ): GameFocus {
    return this.games.attachGame(game, options);
  }

  /** Remove a game's focus from the bag and drop its scoped gates (no residue). */
  detachGame(id: string): boolean {
    return this.games.detachGame(id);
  }

  getAttachedGames(): string[] {
    return this.games.getAttachedGames();
  }

  /** Attach a ConversationGameFocus for the bot's conversation loop. */
  attachConversationGame(
    options: {
      id?: string;
      reflexes?: Reflex[];
      weight?: number;
      focusBag?: FocusBag;
      lmReflex?: boolean;
      /** Phase C (REFACTOR.todo3): extra proposers (e.g. MettaProposer) + contradiction bus. */
      proposers?: GameFocusOptions['proposers'];
      eventBus?: GameFocusOptions['eventBus'];
    } = {}
  ): { focus: GameFocus; game: ConversationGame } {
    return this.games.attachConversationGame(options);
  }

  /** Self-meta-game (TODO17b D20): lazy — focus step reports route improvement proposals. */
  getSelfMetaGame(): SelfMetaGameImpl {
    return this.games.getSelfMetaGame();
  }

  /** Bind an LMReflex (TODO17 C1): undefined when the System One dispatcher is disabled. */
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
    return this.systemOne.attachLMReflex(gameFocus, options);
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
      this.config.adaptationInterval,
      (chain) => this.#recordDerivationChain(chain)
    );
    this.execution = new NARExecution({
      memory: this.memory,
      taskManager: this.taskManager,
      reasoner: this.reasoner,
      config: this.config,
      rlfp: this.rlfp,
      policyOptimizer: this.rlfp?.policyOptimizerPublic,
      cognitiveController: this.cognitiveController,
      driveManager: this.driveManager,
      systemEventBus: this.systemEventBus,
      self: this.self,
      toolGoalExecutor: async (goalTerm) => this.tools.executeToolGoal(goalTerm),
      gates: this.gates,
    });
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
    return askNaturalLanguage(this, question);
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

  private stopLM(): void {
    this.lm.getEnricher()?.stop();
  }

  private getModelWithFallback(prefix: string) {
    return getModelWithFallback(this, prefix);
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

  private async injectBootstrapGoals(): Promise<void> {
    return injectBootstrapGoals(this);
  }

  private initializeLMRules(lmService: LMService): void {
    initializeLMRules(
      this,
      LMRules.createAll(lmService as never),
      this._registry ? getModelForTask(this._registry, 'structured') : undefined
    );
    this._lmInitialized = true;
  }

  private initializeTools(): void {
    initializeTools(this);
  }

  private contradicts(a: Term, b: Term): boolean {
    return contradicts(a, b);
  }
}
