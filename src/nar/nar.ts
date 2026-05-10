/**
 * NAR - Neural Associative Reasoner
 * Core reasoning engine with pluggable capabilities
 */

import type {Concept} from './memory';
import {Memory, type MemoryStatistics} from './memory';
import {BagStrategy, Reasoner, type Strategy} from './reason';
import {TaskManager} from './task';
import {RuleProcessor} from './rules';
import {
    ConfigurationError,
    type CoreConfig,
    createBudget,
    createTask,
    DEFAULT_CONFIG,
    EventBus,
    getBudgetValue,
    type Task,
    type TaskType,
    type TruthFilter
} from './types';
import type {Term} from './terms';
import {termParser, Truth} from './terms';
import type {Truth as TruthType} from './terms/truth.js';
import type {LMClient} from './lm';
import {LMRules} from './lm';
import {type Answer, QueryAPI, type QueryResult, ReasoningTrace} from './query';
import {MetricsCollector} from './metrics';
import {createLogger} from './logger';
import type {Tool, ToolResult} from './tools';
import {
  CalculateTool,
  HTTPTool,
  ReadFileTool,
  SleepTool,
  ToolManager,
  WriteFileTool,
  SearchTool,
  ReasonTool,
  ExplainTool,
  LearnTool,
  TimerTool,
  ProcessTool
} from './tools';
import {BaseComponent} from './lifecycle';
import {ReasoningAboutReasoning} from './self';
import {RLFPLearner} from './rlfp';
import {createPipeline, MemoryPremiseSource} from './stream';
import {BidirectionalFeedbackLoop, ProactiveEnricher, StreamingLMClient} from './lm';

interface SerializedNARState {
    concepts: Array<{ term: string; priority: number }>;
    config: NARConfig;
    timestamp: string;
}

export interface RLFPConfig {
  optimizeInterval?: number;
}

export interface NARConfig extends CoreConfig {
  lmClient?: LMClient;
  enableLMRules?: boolean;
  enableTools?: boolean;
  enableSelf?: boolean;
  enableRLFP?: boolean;
  rlfp?: RLFPConfig;
  enableBidirectionalFeedback?: boolean;
  enableProactiveEnrichment?: boolean;
  enableLMStreaming?: boolean;
}

export class NAR extends BaseComponent {
  readonly memory: Memory;
  readonly taskManager: TaskManager;
  readonly reasoner: Reasoner;
  readonly query: QueryAPI;
  readonly traceAPI: ReasoningTrace;
  readonly tools: ToolManager;
  readonly self?: ReasoningAboutReasoning;
  readonly rlfp?: RLFPLearner;
  readonly feedbackLoop?: BidirectionalFeedbackLoop;
  readonly enricher?: ProactiveEnricher;
  readonly streamingClient?: StreamingLMClient;

  private readonly processor: RuleProcessor;
  private readonly config: NARConfig;
  private _lmClient?: LMClient;
  private _lmInitialized: boolean = false;
  private _toolsInitialized: boolean = false;
  private _cycleCount: number = 0;

  constructor(config: NARConfig = DEFAULT_CONFIG) {
    const eventBus = new EventBus();
    const logger = createLogger({scope: 'NAR'});
    const metrics = new MetricsCollector();

    super({logger, metrics, eventBus});

    this.config = this.validateConfig(config);
    this.memory = new Memory(this.config);
    this.processor = new RuleProcessor();
    this.processor.setEventBus(eventBus);
    this.reasoner = new Reasoner(this.memory, this.processor, BagStrategy, this.config);
    this.taskManager = new TaskManager(this.memory);
    this.query = new QueryAPI(this.memory);
    this.traceAPI = new ReasoningTrace(this.memory);
    this.tools = new ToolManager();
    this._lmClient = this.config.lmClient;

    if (this.config.enableLMRules && this.config.lmClient) {
      this.initializeLMRules(this.config.lmClient);
    }

    if (this.config.enableTools) {
      this.initializeTools();
    }

    if (this.config.enableSelf) {
      this.self = new ReasoningAboutReasoning(this, {});
    }

    if (this.config.enableRLFP) {
      this.rlfp = new RLFPLearner({});
    }

    if (this.config.lmClient) {
      if (this.config.enableBidirectionalFeedback) {
        this.feedbackLoop = new BidirectionalFeedbackLoop(this.memory, this.config.lmClient);
      }
      if (this.config.enableProactiveEnrichment) {
        this.enricher = new ProactiveEnricher(this.memory, this.config.lmClient);
      }
      if (this.config.enableLMStreaming) {
        this.streamingClient = new StreamingLMClient(this.config.lmClient);
      }
    }
  }

  override async initialize(): Promise<void> {
    await super.initialize();
    this.logger.info('NAR initialized');
  }

  override async start(): Promise<void> {
    await super.start();
    this.self?.start();
    this.enricher?.start();
    this.logger.info('NAR started');
  }

  override async stop(): Promise<void> {
    this.self?.stop();
    this.enricher?.stop();
    this.streamingClient?.cancelAllStreams();
    await super.stop();
    this.logger.info('NAR stopped');
  }

  override async dispose(): Promise<void> {
    this.self?.shutdown();
    this.enricher?.stop();
    this.streamingClient?.cancelAllStreams();
    await super.dispose();
    this.logger.info('NAR disposed');
  }

    async input(input: string | Term, type: TaskType = 'belief', truth?: TruthType): Promise<void> {
        const {term: parsedTerm, truth: parsedTruth} = typeof input === 'string'
            ? termParser.parseWithTruth(input)
            : {term: input, truth: undefined};

        this.addTask(parsedTerm, type, truth ?? parsedTruth ?? Truth.NEUTRAL);
    }

    async believe(input: string | Term, truth?: TruthType): Promise<void> {
        return this.input(input, 'belief', truth);
    }

    async goal(input: string | Term, truth?: TruthType): Promise<void> {
        return this.input(input, 'goal', truth);
    }

    async question(input: string | Term): Promise<void> {
        return this.input(input, 'question');
    }

  async run(steps = 1): Promise<number> {
    let derived = 0;

    for (let i = 0; i < steps; i++) {
      this._cycleCount++;
      const processed = await this.taskManager.processPending();
      derived += processed.length;

      const results = await this.reasoner.step();
      derived += results.length;

      for (const task of results) {
        this.memory.addTask(task.term, task.type, task.truth, getBudgetValue(task.budget));
        this.taskManager.addTask(task);
      }

      if (this.rlfp && this._cycleCount % (this.config.rlfp?.optimizeInterval ?? 100) === 0) {
        this.rlfp.optimize();
        this.rlfp.updateModel([]);
      }
    }

    this.memory.consolidate();
    return derived;
  }

  async* runStream(steps = 1, maxResults = 100): AsyncGenerator<Task> {
    const source = new MemoryPremiseSource(this.memory, 'priority-weighted');
    const pipeline = createPipeline(source, this.memory, BagStrategy, {
      maxDepth: this.config.maxDerivationDepth,
      maxQueueSize: 1000,
      maxDerivationsPerStep: maxResults,
      cpuThrottleMs: this.config.cpuThrottleMs
    });

    let count = 0;
    for await (const task of pipeline) {
      yield task;
      this.taskManager.addTask(task);
      if (++count >= steps) break;
    }
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

    getStatistics(): MemoryStatistics {
        return this.memory.getStatistics();
    }

    getConfig(): NARConfig {
        return {...this.config};
    }

    setConfig(updates: Partial<NARConfig>): void {
        Object.assign(this.config, updates);
        this.memory.setConfig(updates);
    }

    getLMClient(): LMClient | undefined {
        return this._lmClient;
    }

    private _constitution: Task[] = [];

    setConstitution(beliefs: Task[]): void {
        this._constitution = beliefs.map(b => ({
            ...b,
            stamp: {...b.stamp, source: 'CONSTITUTION' as const}
        }));
    }

    getConstitution(): Task[] {
        return [...this._constitution];
    }

    checkConstitutionViolation(belief: Task): boolean {
        return this._constitution.some(c => 
            this.contradicts(belief.term, c.term)
        );
    }

    private contradicts(a: Term, b: Term): boolean {
        const aStr = a.toString();
        const bStr = b.toString();
        return aStr === bStr || aStr === this.invert(bStr);
    }

    private invert(term: string): string {
        return term.replace(/-->/g, '<--').replace(/<--/g, '-->');
    }

    attentionReport(): {concepts: Array<{term: string; priority: number}>; total: number} {
        const concepts = this.memory.listConcepts();
        const sorted = concepts
            .map(c => ({term: c.term.toString(), priority: c.priority}))
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 20);
        return {concepts: sorted, total: concepts.length};
    }

    loadDomain(domain: {name: string; beliefs: string[]}): void {
        for (const belief of domain.beliefs) {
            this.input(belief);
        }
    }

    async askNaturalLanguage(question: string): Promise<string> {
        const lm = this._lmClient;
        if (!lm) {
            return 'LM client not configured';
        }

        const translatePrompt = `Convert this natural language question to Narsese query format. 
Only output the Narsese, nothing else.
Question: "${question}"`;

        const narsese = await lm.generateText(translatePrompt);
        const cleaned = narsese.trim().replace(/^<|>$/g, '').trim();

        await this.input(cleaned + '?');
        await this.run(5);

        const beliefs = this.getBeliefs();
        const relevant = beliefs.filter(b => 
            b.term.toString().toLowerCase().includes(cleaned.split('-->')[0]?.trim() || '')
        );

        if (relevant.length === 0) {
            return "I don't have enough knowledge to answer that.";
        }

        const best = relevant[0]!;
        const result = `${best.term.toString()} (f=${best.truth.f.toFixed(2)}, c=${best.truth.c.toFixed(2)})`;

        const explainPrompt = `Convert this Narsese result to a natural language answer.
Narsese: ${result}
Question: "${question}"
Only output the answer, nothing else.`;

        const nlAnswer = await lm.generateText(explainPrompt);
        return nlAnswer.trim();
    }

    getBeliefs(filter?: Record<string, unknown>): Task[] {
        return this.query.getBeliefs(filter);
    }

    getGoals(filter?: TruthFilter): Task[] {
        return this.query.getGoals(filter as any);
    }

    getQuestions(filter?: TruthFilter): Task[] {
        return this.query.getQuestions(filter as any);
    }

    queryTerm(term: Term, filter?: Record<string, unknown>): QueryResult {
        return this.query.query(term, filter);
    }

    ask(question: string | Term): Promise<Answer> {
        return this.query.ask(question);
    }

    getDerivationHistory = (task: Task) => this.traceAPI.getDerivationHistory(task);
    traceTerm = (term: Term) => this.traceAPI.trace(term);
    explain = (conclusion: Task) => this.traceAPI.explain(conclusion);

    recordRuleExecution = (ruleId: string, success: boolean, duration: number) => {
        this.metrics.recordRuleExecution(ruleId, success, duration);
    };

    incrementDerivations = (count?: number) => {
        this.metrics.incrementDerivations(count);
    };

    incrementSteps = (count?: number) => {
        this.metrics.incrementSteps(count);
    };

    getMetrics = () => this.metrics.getSummary();

  async initializeLM(): Promise<void> {
    if (this._lmInitialized || !this.config.lmClient) {
      return;
    }

    this.initializeLMRules(this.config.lmClient);
  }

    async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
        return this.tools.execute(name, args);
    }

    listTools(): Tool[] {
        return this.tools.list();
    }

    export(): SerializedNARState {
        return {
            concepts: this.memory.listConcepts().map(c => ({
                term: c.term.toString(),
                priority: c.priority
            })),
            config: this.config,
            timestamp: new Date().toISOString()
        };
    }

    import(data: SerializedNARState): void {
        if (!data.concepts || !Array.isArray(data.concepts)) {
            throw new Error('Invalid import data');
        }

        for (const concept of data.concepts) {
            if (concept.term) {
                this.input(concept.term);
            }
        }
    }

    async saveToFile(filename: string): Promise<void> {
        const {promises: fs} = await import('fs');
        const data = this.export();
        await fs.writeFile(filename, JSON.stringify(data, null, 2));
    }

    async loadFromFile(filename: string): Promise<void> {
        const {promises: fs} = await import('fs');
        const content = await fs.readFile(filename, 'utf-8');
        const data = JSON.parse(content);
        this.import(data);
    }

    async getMemoryState(): Promise<SerializedNARState> {
        return this.export();
    }

  async loadMemoryState(state: SerializedNARState): Promise<void> {
    if (state.concepts) {
      this.import(state);
    }
  }

  async processHypothesisWithFeedback(hypothesis: Task): Promise<boolean> {
    if (!this.feedbackLoop) {
      return false;
    }
    const result = await this.feedbackLoop.processHypothesis(hypothesis);
    return result !== null;
  }

  async enrichMemoryWithLM(): Promise<void> {
    if (!this.enricher) {
      return;
    }
    await this.enricher.runEnrichmentCycle();
  }

  async streamResponse(prompt: string, onToken: (token: string) => void): Promise<string> {
    if (!this.streamingClient || !this.config.lmClient) {
      const lm = this.config.lmClient;
      if (!lm) {
        throw new Error('LM client not configured');
      }
      return lm.generateText(prompt);
    }
    return this.streamingClient.streamGenerateText(prompt, onToken);
  }

  cancelLMStream(streamId: string): boolean {
    if (!this.streamingClient) {
      return false;
    }
    return this.streamingClient.cancelStream(streamId);
  }

  getEnrichmentStats(): { cycles: number; conceptsEnriched: number; hypothesesGenerated: number } | null {
    if (!this.enricher) {
      return null;
    }
    const stats = this.enricher.getStats();
    return {
      cycles: stats.enrichmentCycles,
      conceptsEnriched: stats.totalConceptsEnriched,
      hypothesesGenerated: stats.totalHypothesesGenerated
    };
  }

  getFeedbackStats(): { pendingValidations: number } | null {
    if (!this.feedbackLoop) {
      return null;
    }
    return {
      pendingValidations: this.feedbackLoop.getPendingValidations().length
    };
  }

  getLMStreamingStats(): { activeStreams: number; totalStreams: number } | null {
    if (!this.streamingClient) {
      return null;
    }
    const manager = this.streamingClient.getStreamManager();
    return manager.getStats();
  }

  private validateConfig(config: NARConfig): NARConfig {
        if (config.maxConcepts <= 0) {
            throw new ConfigurationError('maxConcepts must be positive', {maxConcepts: config.maxConcepts});
        }
        if (config.priorityThreshold < 0 || config.priorityThreshold > 1) {
            throw new ConfigurationError('priorityThreshold must be between 0 and 1', {priorityThreshold: config.priorityThreshold});
        }
        return config;
    }

    private initializeLMRules(lmClient: LMClient): void {
        const lmRules = [
            LMRules.createNarseseTranslationRule(lmClient),
            LMRules.createBeliefRevisionRule(lmClient),
            LMRules.createGoalDecompositionRule(lmClient),
            LMRules.createHypothesisGenerationRule(lmClient),
            LMRules.createExplanationGenerationRule(lmClient),
            LMRules.createAnalogicalReasoningRule(lmClient),
            LMRules.createMetaReasoningGuidanceRule(lmClient),
            LMRules.createUncertaintyCalibrationRule(lmClient),
            LMRules.createSchemaInductionRule(lmClient),
            LMRules.createTemporalCausalModelingRule(lmClient),
            LMRules.createVariableGroundingRule(lmClient),
            LMRules.createConceptElaborationRule(lmClient),
            LMRules.createInteractiveClarificationRule(lmClient)
        ];

        for (const rule of lmRules) {
            this.processor.registerLMRule(rule);
        }

        this._lmInitialized = true;
    }

private initializeTools(): void {
  if (this._toolsInitialized) {
    return;
  }

  this.tools.register(new CalculateTool());
  this.tools.register(new SleepTool());
  this.tools.register(new ReadFileTool());
  this.tools.register(new WriteFileTool());
  this.tools.register(new HTTPTool());
  this.tools.register(new SearchTool(this.memory));
  this.tools.register(new ReasonTool(this));
  this.tools.register(new ExplainTool(this.memory));
  this.tools.register(new LearnTool(this.memory));
  this.tools.register(new TimerTool());
  this.tools.register(new ProcessTool());

  this._toolsInitialized = true;
}

    private addTask(term: Term, type: TaskType, truth: TruthType = Truth.NEUTRAL): void {
        const budget = createBudget(truth.f * truth.c);
        const task = createTask(term, type, truth, budget);
        this.taskManager.addTask(task);
        this.memory.addTask(term, type, truth, budget);
    }
}
