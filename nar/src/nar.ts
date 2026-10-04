import { BaseComponent } from '@senars/core';
import type { CognitiveEvent, DerivationRecord } from '@senars/core/schemas';
import type { ReasoningBudget } from '@senars/core/schemas/reasoning-budget';
import { ambientRng, type BeliefTruth, type Episode } from '@senars/util';
import { BoundedRing, createLogger, errMsg, installIdSource, selectTopN } from '@senars/util';
import { resolveBagSlot } from './bag/registration.js';
import { CognitiveController, createDefaultRegistry } from './cognitive';
import type { CognitiveParameters } from './config/cognitive-parameters';
import { DEFAULT_COGNITIVE_PARAMETERS } from './config/cognitive-parameters.js';
import type { ParameterLedger } from './config/parameter-ledger.js';
import { createBootstrapTasks, DriveManager } from './drives';
import { type NARConfig, validateNarConfig } from './facade/config.js';
import { type GameAttachOptions, GameManager } from './facade/games.js';
import {
  askNaturalLanguage,
  askWithDerivation,
  consolidateLearning,
  contradicts,
  getModelWithFallback,
  initializeLMRules,
  initializeTools,
  injectBootstrapGoals,
} from './facade/index.js';
import { createOptionalSubsystems } from './facade/optional-subsystems.js';
import { StatePersister } from './facade/persistence.js';
import type { SystemOneRuntime } from './facade/system-one.js';
import type { FocusBag } from './focus/FocusBag.js';
import type { GameFocus, GameFocusOptions, ReflexBindable } from './focus/GameFocus.js';
import type { ConversationGame } from './game/impls/ConversationGame.js';
import type { SelfMetaGameImpl } from './game/impls/SelfMetaGame.js';
import type { SelfMetaGameEvidence } from './governance/pipeline.js';
import { GovernanceResolver } from './governance/pipeline.js';
import { ControlBudgets } from './kernel/control-budgets.js';
import { createGateRegistry, type GateRegistry } from './kernel/GateRegistry.js';
import { createDefaultReasoningBudget, type KernelBudgetGate } from './kernel/KernelBudgetGate.js';
import { SchemaInductor } from './learning/schema-induction.js';
import type { LMService, SeNARSRegistry } from './lm';
import { LMRules } from './lm';
import { embeddingRuntime } from './lm/embedding-runtime.js';
import type { EmbeddingCache } from './lm/system-one/embedding-cache.js';
import type { MiningBag } from './lm/system-one/hard-negatives.js';
import { createSystemOneLMRuleAdapter } from './lm/system-one/rule-adapter.js';
import { createNarTelemetrySinks, createTelemetryEmitter } from './lm/system-one/telemetry.js';
import type { TraceGradeInput, TraceGradeResult } from './lm/system-one/trace-grader.js';
import type { CognitiveDispatcher, JudgmentManifold } from './lm/system-one/types.js';
import type { Concept } from './memory';
import { Memory } from './memory';
import { createEmbeddingGenerator, type EmbeddingGenerator } from './memory/embedding.js';
import type { EpisodeConsolidator } from './memory/episode-consolidator.js';
import type { ProofMettaProposer } from './meta/index.js';
import { MetricsCollector } from './metrics';
import { NARExecution } from './nar-execution';
import { NARIO } from './nar-io';
import { NARLM } from './nar-lm';
import { PROPOSAL_LOG_CAPACITY } from './proposal/lifecycle.js';
import { LMProposalProducer } from './proposal/lm-rule-producer.js';
import { type Answer, QueryAPI, ReasoningTrace } from './query';
import type { Reflex } from './reflex/Reflex.js';
import type { RLFPLearner } from './rlfp';
import { loadBuiltinTable, RuleProcessor, type RuleTableStore } from './rules';
import { ProofStreamRing } from './rules/impls/recorder.js';
import { ReasoningAboutReasoning } from './self';
import { StreamReasoner } from './stream/reasoner.js';
import { wireSystemOne } from './system-one-wiring.js';
import { TaskManager } from './task';
import type { Term } from './terms';
import {
  containsSubterm,
  fromNarsese,
  getSubject,
  Truth,
  type TruthType,
  termsEqual,
} from './terms';
import type { Tool, ToolResult } from './tools';
import { discoverTools, ToolManager } from './tools';
import { ConfigurationError, DEFAULT_CONFIG, NarEventBus, type Task, type TaskType } from './types';
import type { RandomSource } from './types/primitives.js';

/** Bounded derivation-chain ring per AIKR (no I/O on the hot path). */
const DERIVATION_RING_CAP = 256;

export type {
  NARConfig,
  RLFPConfig,
  SystemOneConfig,
  SystemOneFileConfig,
  SystemOneRuntimeConfig,
} from './facade/config.js';

export class NAR extends BaseComponent {
  readonly id = 'nar';
  readonly memory: Memory;
  readonly taskManager: TaskManager;
  readonly query: QueryAPI;
  readonly traceAPI: ReasoningTrace;
  readonly tools: ToolManager;
  self?: ReasoningAboutReasoning;
  rlfp?: RLFPLearner;
  readonly cognitiveController: CognitiveController;
  /** TODO25 follow-on: bounded derivation-chain ring, fuel for SchemaInductor; Phase D live ProofStream source. */
  #proofRing = new ProofStreamRing<readonly Task[]>(DERIVATION_RING_CAP);
  #schemaInductor?: SchemaInductor;
  /** Phase B (REFACTOR.todo2): episodic consolidation process — created only when config opts in. */
  #episodeConsolidator?: EpisodeConsolidator;
  /** Phase D (REFACTOR.todo2): bounded hard-negative mining bag — created only when config opts in. */
  #miningBag?: MiningBag;
  #sourceReputation?: import('./kernel/source-reputation.js').SourceReputation;
  /** Phase E: ProofMettaProposer for learning MeTTa rules from proof stream. */
  #proofMettaProposer?: ProofMettaProposer;
  /** Phase E: GovernanceResolver for self-improvement proposals (schema promotion, etc.). */
  #governanceResolver?: GovernanceResolver;
  driveManager?: DriveManager;
  private readonly systemEventBus: NarEventBus;
  /** Restores the process id source this NAR installed (TODO28 §7.3). */
  #restoreIdSource?: () => void;

  private readonly io: NARIO;
  private execution: NARExecution;
  private readonly lm: NARLM;
  private readonly config: NARConfig;
  private readonly processor: RuleProcessor;
  /**
   * The loaded rule table (TODO29.a §5.10). The processor dispatches from its
   * projection; this owns the artifact, so the rule set is a loaded, versioned
   * thing rather than a property of the import graph.
   */
  private readonly ruleTable: RuleTableStore;
  /** The proposal seam this NAR's producers stage into (TODO29.a A1). */
  readonly proposals: LMProposalProducer;
  /** The seam's own bounded log — a proposal that never reached a gate has no gate log. */
  private readonly proposalLog = new BoundedRing<CognitiveEvent>(PROPOSAL_LOG_CAPACITY);
  private readonly _metricsCollector: MetricsCollector;
  private readonly _lmService?: LMService;
  private readonly _registry?: SeNARSRegistry;
  private _lmInitialized = false;
  private _toolsInitialized = false;
  private _constitution: Task[] = [];
  /** TODO19 F2: per-instance kernel gates — isolated per NAR, injected or created. */
  readonly gates: GateRegistry;
  /** TODO29.a §5.7: the declared control budgets, over this NAR's own gate. */
  private readonly controlBudgets: ControlBudgets;
  private readonly budgetGate: KernelBudgetGate;

  // Extracted subsystems (M2)
  private readonly systemOne: SystemOneRuntime;
  private readonly games: GameManager;
  private readonly persister: StatePersister;

  constructor(config: NARConfig = DEFAULT_CONFIG) {
    const eventBus = config.eventBus ?? new NarEventBus();
    const logger = createLogger({ scope: 'NAR' });
    const metrics = new MetricsCollector();

    super({ logger, eventBus });

    this.config = { ...validateNarConfig(config) };
    this.gates = config.gateRegistry ?? createGateRegistry();
    this.budgetGate = this.gates.getBudgetGate() as KernelBudgetGate;
    this.controlBudgets = new ControlBudgets(this.budgetGate, config.controlBudgets);
    // A NAR always has a registry and a parameter graph: the registry has no
    // external dependencies, so "no strategy config" is not a state a NAR can be
    // in. Everything below reads from these two and nothing else decides.
    const registry = config.strategyRegistry ?? createDefaultRegistry({ rng: config.rng });
    const cognitiveParams = config.cognitiveParams ?? DEFAULT_COGNITIVE_PARAMETERS;
    // The `attention` slot is resolved by the controller, which owns every slot;
    // memory starts on the null model and is given the resolved one there.
    this.memory = new Memory({
      ...this.config,
      bag: resolveBagSlot(cognitiveParams.strategies.bag, config.rng),
      embeddingGenerator: config.embeddingGenerator ?? createEmbeddingGenerator(embeddingRuntime),
    });
    this.ruleTable = loadBuiltinTable();
    this.processor = new RuleProcessor(undefined, this.ruleTable.index());
    this.processor.setConfig({
      memory: this.memory,
      host: this,
      budgets: this.controlBudgets,
      recorderEnabled: true,
    });
    this.processor.setEventBus(eventBus);
    this.taskManager = new TaskManager(this.memory, { gateRegistry: this.gates });
    this.query = new QueryAPI(this.memory);
    this.traceAPI = new ReasoningTrace(this.memory);
    this.tools = new ToolManager({
      eventBus,
      feedbackObserver: config.feedbackObserver,
      rng: config.rng,
    });
    this._lmService = this.config.lmService;
    this._registry = this.config.providerRegistry;

    const optional = createOptionalSubsystems(this.config, config.rng);
    this.rlfp = optional.rlfp;
    this.#episodeConsolidator = optional.episodeConsolidator;
    this.#miningBag = optional.miningBag;
    this.#proofMettaProposer = optional.proofMettaProposer;

    this.cognitiveController = new CognitiveController(
      registry,
      this.memory,
      this.processor,
      metrics,
      this.rlfp,
      cognitiveParams,
      config.adaptationInterval,
      this.controlBudgets
    );
    this.cognitiveController.onDerivation((chain) => this.#recordDerivationChain(chain));

    // System One must initialize before gateRegistry.initialize: it supplies
    // the perception config, or the absence of one.
    const { systemOne, perceptionConfig } = wireSystemOne({
      config: this.config,
      lmService: this._lmService,
      onJudgmentResolved: (proposition, query) => this.emitJudgmentResolved(proposition, query),
      reputation: () => this.#sourceReputation,
      budgetGate: this.budgetGate,
    });
    this.systemOne = systemOne;

    this.gates.initialize({
      initialBudget: createDefaultReasoningBudget(),
      initialAutonomyMode: this.config.initialAutonomyMode ?? 'observe-only',
      perceptionConfig,
    });
    // Phase E: reputation consulted lazily at admission/seeding time (C1 default-neutral).
    if (this.#sourceReputation) this.gates.setReputation(this.#sourceReputation);

    this.io = new NARIO(this.memory, this.taskManager, this.config, this.gates);
    this.io.setEventBus(eventBus);
    this.io.setCognitiveParams(cognitiveParams);
    this.io.setRLFP(this.rlfp);
    this.systemEventBus = new NarEventBus();
    this.io.setSystemEventBus(this.systemEventBus);
    this.emitJudgmentResolved = createTelemetryEmitter(
      createNarTelemetrySinks(this.systemEventBus)
    );
    this.games = new GameManager(
      this.systemOne,
      config.rng,
      config.proposals,
      this.systemEventBus,
      this.#proofMettaProposer,
      this.gates
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
    // TODO29.a A1: the cycle's only route to a provider. The seam holds this
    // NAR's gates — not the process global — and the processor stages work into
    // it rather than awaiting a rule, so `propose` cannot open inside `reason`.
    // A3: a proposal that reads a term memory no longer holds is rejected at the
    // boundary rather than salvaged — so the seam resolves against the store.
    this.proposals = new LMProposalProducer(
      new StreamReasoner({ gates: this.gates, backendTimeoutMs: cognitiveParams.lm.callTimeoutMs }),
      this.processor,
      {
        resolves: (narsese) => this.resolves(narsese),
        record: (event) => this.recordProposal(event),
        // A10: a rule proposal that clears the lifecycle becomes a table entry at
        // the revision the committing event stated. The table rebuilds the
        // processor's index, so dispatch and the artifact cannot disagree.
        admitRule: {
          admit: (declaration, admitted) =>
            this.ruleTable.admit(declaration, admitted.revision, admitted.baseRevision, {
              proposalId: admitted.proposalId,
            }),
        },
      }
    );
    this.processor.setModelRuleWorkSink(this.proposals);
    this.execution = new NARExecution({
      memory: this.memory,
      taskManager: this.taskManager,
      config: this.config,
      rlfp: this.rlfp,
      policyOptimizer: this.rlfp?.policyOptimizerPublic,
      cognitiveController: this.cognitiveController,
      driveManager: this.driveManager,
      systemEventBus: this.systemEventBus,
      self: this.self,
      toolGoalExecutor: async (goalTerm) => this.tools.executeToolGoal(goalTerm),
      gates: this.gates,
      budgets: this.controlBudgets,
      proposals: this.proposals,
      onCycleEnd: (cycleCount, config) => this.maybeConsolidateLearning(cycleCount, config),
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
      },
      this.gates
    );
    this._metricsCollector = metrics;

    this.initializeOptionalFeatures();
  }

  override async initialize(): Promise<void> {
    // Ids are minted deep in the gates, the task manager and the concept store,
    // none of which receives a config, so the source is installed process-wide
    // for this NAR's lifetime rather than threaded to 38 call sites.
    if (this.config.ids) this.#restoreIdSource ??= installIdSource(this.config.ids);
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
    this.#restoreIdSource?.();
    this.#restoreIdSource = undefined;
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

  async input(
    input: string | Term,
    type: TaskType = 'belief',
    truth?: TruthType,
    correlationId?: string
  ): Promise<void> {
    return this.io.input(input, type, truth, correlationId);
  }

  async believe(input: string | Term, truth?: TruthType, correlationId?: string): Promise<void> {
    return this.io.believe(input, truth, correlationId);
  }

  async goal(input: string | Term, truth?: TruthType, correlationId?: string): Promise<void> {
    return this.io.goal(input, truth, correlationId);
  }

  async question(input: string | Term, correlationId?: string): Promise<void> {
    return this.io.question(input, correlationId);
  }

  async run(steps = 1, signal?: AbortSignal, correlationId?: string): Promise<number> {
    return this.execution.run(steps, signal, correlationId);
  }

  async *runStream(
    steps = 1,
    maxResults = 100,
    signal?: AbortSignal,
    correlationId?: string
  ): AsyncGenerator<Task> {
    yield* this.execution.runStream(steps, maxResults, signal, correlationId);
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

  /** The instance's randomness — the one stream memory bags, link layers and strategies draw from. */
  get rng(): RandomSource {
    return this.config.rng ?? ambientRng;
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

  /** Phase E: ProofMettaProposer for learning MeTTa rules from proof stream. */
  getProofMettaProposer(): ProofMettaProposer | undefined {
    return this.#proofMettaProposer;
  }

  /** Phase E: GovernanceResolver for self-improvement proposals (schema promotion, etc.). */
  getGovernanceResolver(): GovernanceResolver {
    if (!this.#governanceResolver) {
      const metaGame = this.games.getSelfMetaGame();
      this.#governanceResolver = new GovernanceResolver(metaGame);
    }
    return this.#governanceResolver;
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

  /** Phase E: Get JudgmentPipeline for comprehensive manifold evaluation (ADR-008). */
  getSystemOneJudgmentPipeline():
    | import('./lm/system-one/judgment-pipeline.js').JudgmentPipeline
    | undefined {
    return this.systemOne.judgmentPipeline;
  }

  /** Get the unified decision facade (TODO23): decide/choose with provenance. */
  getSystemOneDecider(): import('./lm/system-one/decide.js').Decider | undefined {
    return this.systemOne.decider;
  }

  /** Get System One groundedness gate (for egress filtering). */
  getSystemOneGroundednessGate(): SystemOneRuntime['groundednessGate'] {
    return this.systemOne.groundednessGate;
  }

  /** Get System One trace grader (E4 agent-trace grading; undefined when disabled). */
  getSystemOneTraceGrader(): ((trace: TraceGradeInput) => Promise<TraceGradeResult>) | undefined {
    return this.systemOne.traceGrader;
  }

  /** CLM contrastive exemplar memory (zero-shot scoring; undefined when disabled). */
  getSystemOneContrastive(
    correlationId = 'default'
  ): import('./lm/system-one/contrastive.js').ContrastiveMemory | undefined {
    return this.systemOne.enabled ? this.systemOne.getContrastive(correlationId) : undefined;
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
  /** Phase C (REFACTOR.todo1): periodic learning consolidation with interval check. */
  private async maybeConsolidateLearning(cycleCount: number, config: NARConfig): Promise<void> {
    const lc = config.learningConsolidation;
    if (!lc?.enabled || cycleCount % (lc.interval ?? 1) !== 0) return;
    await this.consolidateLearning({ budget: lc.budget });
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

  /**
   * Whether a term a proposal read is still resident. A reference that no longer
   * resolves is a rejection at the boundary, not a partially-applied proposal —
   * salvaging what still resolves would land a claim whose evidence is gone.
   */
  private resolves(narsese: string): boolean {
    const term = fromNarsese(narsese);
    return term != null && this.memory.getConcept(term) !== undefined;
  }

  /**
   * Append a seam event to the proposing origin's own bounded log. Kept off the
   * kernel's rings deliberately: a proposal that never reached a gate did not
   * pass one, and recording it in a gate's log would say otherwise.
   */
  private recordProposal(event: CognitiveEvent): void {
    this.proposalLog.push(event);
  }

  /** The loaded rule table: enumerable, versioned, revertable (TODO29.a §5.10). */
  getRuleTable(): RuleTableStore {
    return this.ruleTable;
  }

  /** The seam's committed admissions and rejections, oldest evicted first. */
  getProposalLog(): readonly CognitiveEvent[] {
    return this.proposalLog.toArray();
  }

  /** Emit a judgment.resolved kernel event + Prometheus metric for a resolved proposition. */
  private readonly emitJudgmentResolved: ReturnType<typeof createTelemetryEmitter>;

  attachManifoldReflex(gameFocus: ReflexBindable): Reflex | undefined {
    return this.systemOne.attachManifoldReflex(gameFocus);
  }

  getFocusBag(): FocusBag {
    return this.games.getFocusBag();
  }

  attachGame(game: GameFocusOptions['game'], options: GameAttachOptions = {}): GameFocus {
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
  attachConversationGame(options: GameAttachOptions = {}): {
    focus: GameFocus;
    game: ConversationGame;
  } {
    return this.games.attachConversationGame(options);
  }

  /** Self-meta-game (TODO17b D20): lazy — focus step reports route improvement proposals. */
  getSelfMetaGame(): SelfMetaGameImpl {
    return this.games.getSelfMetaGame();
  }

  /** Bind an LMReflex (TODO17 C1): undefined when the System One dispatcher is disabled. */
  attachLMReflex(
    gameFocus: ReflexBindable,
    options: { maxCandidates?: number } = {}
  ): Reflex | undefined {
    return this.systemOne.attachLMReflex(gameFocus, options);
  }

  getMetricsCollector(): MetricsCollector {
    return this._metricsCollector;
  }

  /**
   * Replace the whole parameter graph. The live `CognitiveController` and its
   * `InferenceController` are reconfigured in place — nothing is rebuilt, so
   * every holder of a reference (this NAR, `NARExecution`, the stream pipeline)
   * sees the new strategies on its next cycle rather than after a swap.
   */
  reconfigure(params: CognitiveParameters): void {
    this.cognitiveController.reconfigure(params);
    this.io.setCognitiveParams(params);
  }

  setRLFP(rlfp: RLFPLearner): void {
    this.rlfp = rlfp;
  }

  /**
   * Provide external reward feedback to update policy.
   * Goes through the RewardGate (epistemic firewall) and if accepted, updates the RLFPLearner.
   * @param reward - Reward value between -1 and 1
   * @param context - Optional context about what the reward is for
   */
  async reward(
    reward: number,
    context?: string
  ): Promise<import('@senars/core/schemas').RewardGateOutput> {
    return this.io.reward(reward, context);
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

  getLMClientStats() {
    return this._lmService?.getStats?.();
  }

  getModelRuleExecutionLog() {
    return this.processor.getModelRuleExecutionLog();
  }

  clearModelRuleExecutionLog() {
    this.processor.clearModelRuleExecutionLog();
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
    const top = selectTopN(concepts, 20, (c) => c.priority).map((c) => ({
      term: c.term.toString(),
      priority: c.priority,
    }));
    return { concepts: top, total: concepts.length };
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
    truth: BeliefTruth;
    stampId: string;
    timestamp: number;
    source: 'input' | 'derivation' | 'revision' | 'inference';
  }> {
    return this.memory.getRevisionHistory(term);
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

  /** Ask a question and attach a verified derivation trace when one exists (M8). */
  async askWithDerivation(question: string | Term): Promise<Answer> {
    return askWithDerivation(this, question as string);
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

  recordDerivations(count?: number) {
    this._metricsCollector.recordDerivations(count);
  }

  recordSteps(count?: number) {
    this._metricsCollector.recordSteps(count);
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
    if (this.config.lmService) this.initializeLMRules(this.config.lmService);
    if (this.config.enableTools) this.initializeTools();
    if (this.config.enableSelf) this.self = new ReasoningAboutReasoning(this, {});
  }
  private async injectBootstrapGoals(): Promise<void> {
    return injectBootstrapGoals(this);
  }
  private initializeLMRules(lmService: LMService): void {
    initializeLMRules(
      this,
      LMRules.createAll(lmService as never, {
        callTimeoutMs: this.cognitiveController.getParams().lm.callTimeoutMs,
      })
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
