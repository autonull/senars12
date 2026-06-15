import type {Concept} from './memory';
import {Memory} from './memory';
import {WorkingMemory} from './memory/WorkingMemory.js';
import {BagStrategy, Reasoner} from './reason';
import {TaskManager} from './task';
import {RuleProcessor} from './rules';
import {ConfigurationError, type CoreConfig, DEFAULT_CONFIG, EventBus, type Task, type TaskType} from './types';
import type {Term} from './terms';
import {termsEqual} from './terms';
import type {Truth as TruthType} from './terms/truth.js';
import type {LMClient} from './lm';
import {LMRules} from './lm';
import type {SeNARSRegistry} from './lm/providers.js';
import {QueryAPI, ReasoningTrace} from './query';
import {MetricsCollector} from './metrics';
import {createLogger} from './logger';
import type {Tool, ToolResult} from './tools';
import {
    ToolManager,
    discoverTools
} from './tools';
import {BaseComponent} from './lifecycle';
import {ReasoningAboutReasoning} from './self';
import {RLFPLearner} from './rlfp';
import {CognitiveController} from './cognitive/controller';
import type {CognitiveRegistry} from './cognitive/registry';
import type {CognitiveParameters} from './config/cognitive-parameters';
import type {AttentionModel} from './strategies/types.js';
import {SimpleAttention} from './strategies/attention/index.js';
import {NARIO} from './nar-io';
import {NARExecution} from './nar-execution';
import {NARLM} from './nar-lm';
import {DriveManager, createBootstrapTasks} from './drives/index.js';
import {SystemEventBus} from '../agent/SystemEventBus.js';

export interface RLFPConfig {
    optimizeInterval?: number;
}

export interface NARConfig extends CoreConfig {
    lmClient?: LMClient;
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

    /** Cognitive architecture configuration (Phase 3+) */
    cognitiveParams?: CognitiveParameters;
    strategyRegistry?: CognitiveRegistry;
    adaptationInterval?: number;
}

export class NAR extends BaseComponent {
  readonly memory: Memory;
  readonly workingMemory!: WorkingMemory;
  readonly taskManager: TaskManager;
  readonly reasoner: Reasoner;
  readonly query: QueryAPI;
  readonly traceAPI: ReasoningTrace;
  readonly tools: ToolManager;
  readonly self?: ReasoningAboutReasoning;
  rlfp?: RLFPLearner;
  cognitiveController?: CognitiveController;
  private driveManager?: DriveManager;
  private readonly systemEventBus: SystemEventBus;

  private readonly io: NARIO;
  private execution: NARExecution;
  private readonly lm: NARLM;
  private readonly config: NARConfig;
  private readonly processor: RuleProcessor;
  private readonly _metricsCollector: MetricsCollector;
    private readonly _lmClient?: LMClient;
    private readonly _registry?: SeNARSRegistry;
    private _lmInitialized = false;
    private _toolsInitialized = false;
    private _constitution: Task[] = [];

  constructor(config: NARConfig & { eventBus?: EventBus } = DEFAULT_CONFIG) {
    const eventBus = config.eventBus ?? new EventBus();
    const logger = createLogger({scope: 'NAR'});
    const metrics = new MetricsCollector();

    super({logger, metrics, eventBus});

    this.config = this.validateConfig(config);
    this.memory = new Memory(this.config, { attentionModel: this.createAttentionModel(config) });
    this.processor = new RuleProcessor();
    this.processor.setConfig({memory: this.memory});
    this.processor.setEventBus(eventBus);
    this.reasoner = new Reasoner(this.memory, this.processor, BagStrategy, this.config);
    this.taskManager = new TaskManager(this.memory);
    this.query = new QueryAPI(this.memory);
    this.traceAPI = new ReasoningTrace(this.memory);
    this.tools = new ToolManager({ eventBus });
        this.workingMemory = new WorkingMemory();
        this._lmClient = this.config.lmClient;
        this._registry = this.config.providerRegistry;

        if (this.config.enableRLFP) this.rlfp = new RLFPLearner({});

        // Cognitive architecture — wire CognitiveController when params + registry are provided
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

        this.io = new NARIO(this.memory, this.taskManager, this.config);
        this.io.setEventBus(eventBus);
        this.systemEventBus = new SystemEventBus();
        this.systemEventBus.wrapNarEventBus(eventBus);
        this.execution = new NARExecution(this.memory, this.taskManager, this.reasoner, this.config, this.rlfp, this.cognitiveController, this.driveManager);
        this.lm = new NARLM(this.memory, this._registry, this.config.lmClient, this.config.enableBidirectionalFeedback, this.config.enableProactiveEnrichment);
        this._metricsCollector = metrics;

        this.driveManager = new DriveManager(this as any);

        this.initializeOptionalFeatures();
    }

    override async initialize(): Promise<void> {
        await super.initialize();
        this.logger.info('NAR initialized');
    }

    private getStatePath(filename: string): string {
        const path = require('path');
        const base = this.config.statePath ?? '.cache/nar-state';
        return path.resolve(base, filename);
    }

    private async saveState(): Promise<void> {
        if (!this.config.persistState) return;
        try {
            const fs = require('fs').promises;
            const path = require('path');

            const beliefs = this.query.getBeliefs().map(b => ({
                term: b.term.toString(),
                truth: b.truth ? {f: b.truth.f, c: b.truth.c} : undefined,
                stamp: b.stamp,
            }));
            const goals = this.query.getGoals().map(g => ({
                term: g.term.toString(),
                truth: g.truth ? {f: g.truth.f, c: g.truth.c} : undefined,
                stamp: g.stamp,
            }));
            const questions = this.query.getQuestions().map(q => ({
                term: q.term.toString(),
                truth: q.truth ? {f: q.truth.f, c: q.truth.c} : undefined,
                stamp: q.stamp,
            }));
            const attention = this.attentionReport();
            const driveStates = this.driveManager?.getAllStates() ?? [];
            const drives: Record<string, number> = {};
            for (const ds of driveStates) {
                drives[ds.spec.id] = ds.currentIntensity;
            }

            const baseDir = path.dirname(this.getStatePath('beliefs.json'));
            await fs.mkdir(baseDir, {recursive: true});
            await fs.writeFile(this.getStatePath('beliefs.json'), JSON.stringify(beliefs, null, 2), 'utf-8');
            await fs.writeFile(this.getStatePath('goals.json'), JSON.stringify(goals, null, 2), 'utf-8');
            await fs.writeFile(this.getStatePath('questions.json'), JSON.stringify(questions, null, 2), 'utf-8');
            await fs.writeFile(this.getStatePath('attention.json'), JSON.stringify(attention, null, 2), 'utf-8');
            await fs.writeFile(this.getStatePath('drives.json'), JSON.stringify(drives, null, 2), 'utf-8');

            // Save LM Rule state
            const lmRuleState = this.processor.serializeLMRules();
            await fs.writeFile(this.getStatePath('lm-rules.json'), JSON.stringify(lmRuleState, null, 2), 'utf-8');
        } catch (e) {
            this.logger.warn('NAR state save failed', {error: e instanceof Error ? e.message : String(e)});
        }
    }

    private async loadState(): Promise<void> {
        if (!this.config.persistState) return;
        try {
            const fs = require('fs').promises;
            const path = require('path');

            const {termParser} = await import('./terms/index.js');
            const {Truth} = await import('./terms/truth.js');
            const {Stamp} = await import('./terms/stamp.js');

            const baseDir = path.dirname(this.getStatePath('beliefs.json'));

            // Load beliefs
            const beliefsPath = this.getStatePath('beliefs.json');
            if (await fs.access(beliefsPath).then(() => true).catch(() => false)) {
                const content = await fs.readFile(beliefsPath, 'utf-8');
                const beliefs = JSON.parse(content);
                for (const b of beliefs) {
                    const parsed = termParser.parse(b.term);
                    if (parsed) {
                        const task = {
                            term: parsed,
                            type: 'belief' as const,
                            truth: b.truth ?? Truth.NEUTRAL,
                            budget: {priority: 0.5, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
                            stamp: b.stamp ?? Stamp.createInput(),
                            occurrenceTime: Date.now(),
                            derived: false,
                        };
                        this.taskManager.addTask(task);
                    }
                }
            }

            // Load goals
            const goalsPath = this.getStatePath('goals.json');
            if (await fs.access(goalsPath).then(() => true).catch(() => false)) {
                const content = await fs.readFile(goalsPath, 'utf-8');
                const goals = JSON.parse(content);
                for (const g of goals) {
                    const parsed = termParser.parse(g.term);
                    if (parsed) {
                        const task = {
                            term: parsed,
                            type: 'goal' as const,
                            truth: g.truth ?? Truth.NEUTRAL,
                            budget: {priority: 0.5, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
                            stamp: g.stamp ?? Stamp.createInput(),
                            occurrenceTime: Date.now(),
                            derived: false,
                        };
                        this.taskManager.addTask(task);
                    }
                }
            }

            // Load questions
            const questionsPath = this.getStatePath('questions.json');
            if (await fs.access(questionsPath).then(() => true).catch(() => false)) {
                const content = await fs.readFile(questionsPath, 'utf-8');
                const questions = JSON.parse(content);
                for (const q of questions) {
                    const parsed = termParser.parse(q.term);
                    if (parsed) {
                        const task = {
                            term: parsed,
                            type: 'question' as const,
                            truth: q.truth ?? Truth.NEUTRAL,
                            budget: {priority: 0.5, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
                            stamp: q.stamp ?? Stamp.createInput(),
                            occurrenceTime: Date.now(),
                            derived: false,
                        };
                        this.taskManager.addTask(task);
                    }
                }
            }

            // Load drives
            const drivesPath = this.getStatePath('drives.json');
            if (await fs.access(drivesPath).then(() => true).catch(() => false)) {
                const content = await fs.readFile(drivesPath, 'utf-8');
                const drives = JSON.parse(content);
                if (this.driveManager && drives) {
                    for (const [driveId, value] of Object.entries(drives)) {
                        const currentState = this.driveManager.getState(driveId);
                        const currentIntensity = currentState?.currentIntensity ?? 0;
                        const targetIntensity = Number(value);
                        const diff = targetIntensity - currentIntensity;
                        this.driveManager.stimulate(driveId, diff);
                    }
                }
            }

            this.logger.info('NAR state loaded');

            // Load LM Rule state
            const lmRulesPath = this.getStatePath('lm-rules.json');
            if (await fs.access(lmRulesPath).then(() => true).catch(() => false)) {
                const content = await fs.readFile(lmRulesPath, 'utf-8');
                const lmRuleState = JSON.parse(content);
                this.processor.deserializeLMRules(lmRuleState);
            }
        } catch (e) {
            this.logger.warn('NAR state load failed', {error: e instanceof Error ? e.message : String(e)});
        }
    }

    override async start(): Promise<void> {
        await super.start();
        await this.loadState();
        this.self?.start();
        this.lm.getEnricher()?.start();
        await this.injectBootstrapGoals();
        this.logger.info('NAR started');
    }

    override async stop(): Promise<void> {
        this.self?.stop();
        this.stopLM();
        await this.saveState();
        await super.stop();
        this.logger.info('NAR stopped');
    }

    override async dispose(): Promise<void> {
        this.self?.shutdown();
        this.stopLM();
        await super.dispose();
        this.logger.info('NAR disposed');
    }

    // Input methods
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

    // Execution
    async run(steps = 1): Promise<number> {
        return this.execution.run(steps);
    }

    async* runStream(steps = 1, maxResults = 100): AsyncGenerator<Task> {
        yield* this.execution.runStream(steps, maxResults);
    }

    // Memory access
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

    // Configuration
    getConfig(): NARConfig {
        return {...this.config};
    }

    setConfig(updates: Partial<NARConfig>): void {
        Object.assign(this.config, updates);
        this.memory.setConfig(updates);
    }

// Component accessors
getLMClient(): LMClient | undefined {
  return this._lmClient;
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

getController(): CognitiveController | undefined {
  return this.cognitiveController;
}

getDriveManager(): DriveManager | undefined {
  return this.driveManager;
}

getSystemEventBus(): SystemEventBus {
  return this.systemEventBus;
}

getMetricsCollector(): MetricsCollector {
  return this._metricsCollector;
}

reconfigure(params: CognitiveParameters): void {
  if (!this.cognitiveController) {
    throw new Error('NAR was not created with cognitive architecture enabled');
  }
  const registry = this.config.strategyRegistry;
  if (!registry) {
    throw new Error('NAR has no strategy registry — cannot reconfigure');
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
    this.memory, this.taskManager, this.reasoner,
    this.config, this.rlfp, this.cognitiveController, this.driveManager
  );
}

setRLFP(rlfp: RLFPLearner): void {
  this.rlfp = rlfp;
}

inputTask(task: Task): void {
  this.taskManager.addTask(task);
}

getPhaseTimer() {
  return this.execution.getPhaseTimer();
}

getLMClientStats() {
  return this._lmClient?.getStats?.();
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

    // Constitution
    setConstitution(beliefs: Task[]): void {
        this._constitution = beliefs.map(b => ({...b, stamp: {...b.stamp, source: 'CONSTITUTION' as const}}));
    }

    getConstitution(): Task[] {
        return [...this._constitution];
    }

    checkConstitutionViolation(belief: Task): boolean {
        return this._constitution.some(c => this.contradicts(belief.term, c.term));
    }

    // Attention
    attentionReport(): { concepts: Array<{ term: string; priority: number }>; total: number } {
        const concepts = this.memory.listConcepts();
        const sorted = concepts.map(c => ({
            term: c.term.toString(),
            priority: c.priority
        })).sort((a, b) => b.priority - a.priority).slice(0, 20);
        return {concepts: sorted, total: concepts.length};
    }

    // Domain loading
    loadDomain(domain: { name: string; beliefs: string[] }): void {
        for (const belief of domain.beliefs) this.io.input(belief);
    }

    // Natural language processing
    async askNaturalLanguage(question: string): Promise<string> {
        const lm = this._lmClient;
        if (!lm) return 'LM client not configured';

        const translatePrompt = `Convert this natural language question to Narsese query format. Only output the Narsese, nothing else. Question: "${question}"`;
        const narsese = await lm.generateText(translatePrompt);
        const cleaned = narsese.trim().replace(/^<|>$/g, '').trim();

        await this.io.input(cleaned + '?');
        await this.run(5);

        const beliefs = this.query.getBeliefs();
        const relevant = beliefs.filter(b => b.term.toString().toLowerCase().includes(cleaned.split('-->')[0]?.trim() || ''));

        if (relevant.length === 0) return "I don't have enough knowledge to answer that.";

        const best = relevant[0]!;
        const result = `${best.term.toString()} (f=${best.truth.f.toFixed(2)}, c=${best.truth.c.toFixed(2)})`;
        const explainPrompt = `Convert this Narsese result to a natural language answer. Narsese: ${result} Question: "${question}" Only output the answer, nothing else.`;

        return lm.generateText(explainPrompt);
    }

    // Query API delegation
    getBeliefs(filter?: Record<string, unknown>): Task[] {
        return this.query.getBeliefs(filter);
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

    // Trace API delegation
    getDerivationHistory(task: Task) {
        return this.traceAPI.getDerivationHistory(task);
    }

    traceTerm(term: Term) {
        return this.traceAPI.trace(term);
    }

    explain(conclusion: Task) {
        return this.traceAPI.explain(conclusion);
    }

    // Metrics
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

    // LM initialization
    async initializeLM(): Promise<void> {
        if (this._lmInitialized || !this.config.lmClient) return;
        this.initializeLMRules(this.config.lmClient);
    }

    // Tool execution
    async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
        return this.tools.execute(name, args);
    }

    listTools(): Tool[] {
        return this.tools.list();
    }

    // Serialization
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

    // LM methods
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
        return this._registry?.languageModel(`cloud:${prefix}`)
            ?? this._registry?.languageModel(`local:${prefix}`)
            ?? this._registry?.languageModel('builtin:compact');
    }

    private initializeOptionalFeatures(): void {
        if (this.config.enableLMRules && this.config.lmClient) {
            this.initializeLMRules(this.config.lmClient);
        }
        if (this.config.enableTools) {
            this.initializeTools();
        }
        if (this.config.enableSelf) {
            Object.assign(this, {self: new ReasoningAboutReasoning(this, {})});
        }
    }

    private async injectBootstrapGoals(): Promise<void> {
        const tasks = createBootstrapTasks();
        for (const task of tasks) {
            await this.io.input(task.term, task.type, task.truth);
        }
    }

    private validateConfig(config: NARConfig): NARConfig {
        if (config.maxConcepts <= 0) {
            throw new ConfigurationError('maxConcepts must be positive', {maxConcepts: config.maxConcepts});
        }
        return config;
    }

    private initializeLMRules(lmClient: LMClient): void {
        const lmRules = LMRules.createAll(lmClient);
        const structuredModel = this._registry
            ? this._registry.languageModel('cloud:quality')
                ?? this._registry.languageModel('local:quality')
            : undefined;
        for (const rule of lmRules) {
            if (structuredModel) rule.setStructuredModel(structuredModel as never);
            rule.setSystemEventBus(this.systemEventBus);
            rule.setNAR(this);
            this.processor.registerLMRule(rule);
        }
        this._lmInitialized = true;
    }

    private initializeTools(): void {
        if (this._toolsInitialized) return;

        const toolDeps = {memory: this.memory, nar: this} as Record<string, unknown>;
        const tools = discoverTools(toolDeps);
        for (const tool of tools) {
            this.tools.register(tool);
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
        if (a.kind === 'negation') {
            const [aArg] = a.args;
            return !!aArg && termsEqual(aArg, b);
        }
        if (b.kind === 'negation') {
            const [bArg] = b.args;
            return !!bArg && termsEqual(bArg, a);
        }
        return false;
    }
}
