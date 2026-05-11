import type {Concept} from './memory';
import {Memory} from './memory';
import {BagStrategy, Reasoner} from './reason';
import {TaskManager} from './task';
import {RuleProcessor} from './rules';
import {
  ConfigurationError,
  DEFAULT_CONFIG,
  EventBus,
  type CoreConfig,
  type Task,
  type TaskType,
  type TruthFilter
} from './types';
import type {Term} from './terms';
import {termParser, termsEqual, Truth} from './terms';
import type {Truth as TruthType} from './terms/truth.js';
import type {LMClient} from './lm';
import {LMRules} from './lm';
import {QueryAPI, ReasoningTrace} from './query';
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
import {NARIO} from './nar-io';
import {NARExecution} from './nar-execution';
import {NARLM} from './nar-lm';
import {NARFacade} from './nar-facade';

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

interface MemoryConfig {
  maxConcepts?: number;
  priorityThreshold?: number;
}

interface SerializedNARState {
  concepts: Array<{ term: string; priority: number }>;
  config: NARConfig;
  timestamp: string;
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

  private readonly io: NARIO;
  private readonly execution: NARExecution;
  private readonly lm: NARLM;
  private readonly facade: NARFacade;
  private readonly config: NARConfig;
  private readonly processor: RuleProcessor;
  private _lmClient?: LMClient;
  private _lmInitialized = false;
  private _toolsInitialized = false;
  private _constitution: Task[] = [];

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

    this.io = new NARIO(this.memory, this.taskManager, this.config);
    this.execution = new NARExecution(this.memory, this.taskManager, this.reasoner, this.config, this.rlfp);
    this.lm = new NARLM(this.memory, this.config.lmClient, this.config.enableBidirectionalFeedback, this.config.enableProactiveEnrichment, this.config.enableLMStreaming);
    this.facade = new NARFacade(this.memory, this.query, this.traceAPI, this.tools, metrics);

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
  }

  override async initialize(): Promise<void> {
    await super.initialize();
    this.logger.info('NAR initialized');
  }

  override async start(): Promise<void> {
    await super.start();
    this.self?.start();
    this.lm.getEnricher()?.start();
    this.logger.info('NAR started');
  }

  override async stop(): Promise<void> {
    this.self?.stop();
    this.lm.getEnricher()?.stop();
    this.lm.getStreamingClient()?.cancelAllStreams();
    await super.stop();
    this.logger.info('NAR stopped');
  }

  override async dispose(): Promise<void> {
    this.self?.shutdown();
    this.lm.getEnricher()?.stop();
    this.lm.getStreamingClient()?.cancelAllStreams();
    await super.dispose();
    this.logger.info('NAR disposed');
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

  async run(steps = 1): Promise<number> {
    return this.execution.run(steps);
  }

  async* runStream(steps = 1, maxResults = 100): AsyncGenerator<Task> {
    yield* this.execution.runStream(steps, maxResults);
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
    return {...this.config};
  }

  setConfig(updates: Partial<NARConfig>): void {
    Object.assign(this.config, updates);
    this.memory.setConfig(updates);
  }

  getLMClient(): LMClient | undefined {
    return this._lmClient;
  }

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
    return this._constitution.some(c => this.contradicts(belief.term, c.term));
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
      this.io.input(belief);
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

    await this.io.input(cleaned + '?');
    await this.run(5);

    const beliefs = this.facade.getBeliefs();
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

    return lm.generateText(explainPrompt);
  }

  getBeliefs(filter?: Record<string, unknown>): Task[] {
    return this.facade.getBeliefs(filter);
  }

  getGoals(filter?: Record<string, unknown>): Task[] {
    return this.facade.getGoals(filter);
  }

  getQuestions(filter?: Record<string, unknown>): Task[] {
    return this.facade.getQuestions(filter);
  }

  queryTerm(term: Term, filter?: Record<string, unknown>) {
    return this.facade.queryTerm(term, filter);
  }

  ask(question: string | Term) {
    return this.facade.ask(question);
  }

  getDerivationHistory(task: Task) {
    return this.facade.getDerivationHistory(task);
  }

  traceTerm(term: Term) {
    return this.facade.traceTerm(term);
  }

  explain(conclusion: Task) {
    return this.facade.explain(conclusion);
  }

  recordRuleExecution(ruleId: string, success: boolean, duration: number) {
    this.facade.recordRuleExecution(ruleId, success, duration);
  }

  incrementDerivations(count?: number) {
    this.facade.incrementDerivations(count);
  }

  incrementSteps(count?: number) {
    this.facade.incrementSteps(count);
  }

  getMetrics() {
    return this.facade.getMetrics();
  }

  async initializeLM(): Promise<void> {
    if (this._lmInitialized || !this.config.lmClient) {
      return;
    }
    this.initializeLMRules(this.config.lmClient);
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    return this.facade.executeTool(name, args);
  }

  listTools(): Tool[] {
    return this.facade.listTools();
  }

  export() {
    return this.io.export();
  }

  import(data: SerializedNARState) {
    return this.io.import(data);
  }

  async saveToFile(filename: string): Promise<void> {
    await this.io.saveToFile(filename);
  }

  async loadFromFile(filename: string): Promise<void> {
    await this.io.loadFromFile(filename);
  }

  async getMemoryState(): Promise<SerializedNARState> {
    return this.io.getMemoryState();
  }

  async loadMemoryState(state: SerializedNARState): Promise<void> {
    await this.io.loadMemoryState(state);
  }

  async processHypothesisWithFeedback(hypothesis: Task): Promise<boolean> {
    return this.lm.processHypothesisWithFeedback(hypothesis);
  }

  async enrichMemoryWithLM(): Promise<void> {
    await this.lm.enrichMemory();
  }

  async streamResponse(prompt: string, onToken: (token: string) => void): Promise<string> {
    return this.lm.streamResponse(prompt, onToken, this._lmClient);
  }

  cancelLMStream(streamId: string): boolean {
    return this.lm.cancelStream(streamId);
  }

  getEnrichmentStats() {
    return this.lm.getEnrichmentStats();
  }

  getFeedbackStats() {
    return this.lm.getFeedbackStats();
  }

  getLMStreamingStats() {
    return this.lm.getStreamingStats();
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
    const lmRules = LMRules.createAll(lmClient);
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

  private contradicts(a: Term, b: Term): boolean {
    if (termsEqual(a, b)) return true;
    if (a.kind === 'negation' && a.args[0] && termsEqual(a.args[0], b)) return true;
    if (b.kind === 'negation' && b.args[0] && termsEqual(b.args[0], a)) return true;
    return false;
  }
}
