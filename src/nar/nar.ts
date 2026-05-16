import type {Concept} from './memory';
import {Memory} from './memory';
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
    CalculateTool,
    ExplainTool,
    HTTPTool,
    LearnTool,
    ProcessTool,
    ReadFileTool,
    ReasonTool,
    SearchTool,
    SleepTool,
    TimerTool,
    ToolManager,
    WriteFileTool
} from './tools';
import {BaseComponent} from './lifecycle';
import {ReasoningAboutReasoning} from './self';
import {RLFPLearner} from './rlfp';
import {NARIO} from './nar-io';
import {NARExecution} from './nar-execution';
import {NARLM} from './nar-lm';

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
}

interface ToolDependency {
    memory: Memory;
    nar: NAR;
}

interface ToolDefinition<T extends Tool = Tool> {
    readonly name: string;
    readonly factory: (deps: ToolDependency) => T;
    readonly dependencies: (keyof ToolDependency)[];
}

const TOOL_DEFS: ToolDefinition[] = [
    {name: 'Calculate', factory: () => new CalculateTool(), dependencies: []},
    {name: 'Sleep', factory: () => new SleepTool(), dependencies: []},
    {name: 'ReadFile', factory: () => new ReadFileTool(), dependencies: []},
    {name: 'WriteFile', factory: () => new WriteFileTool(), dependencies: []},
    {name: 'HTTP', factory: () => new HTTPTool(), dependencies: []},
    {name: 'Search', factory: (deps) => new SearchTool(deps.memory), dependencies: ['memory']},
    {name: 'Reason', factory: (deps) => new ReasonTool(deps.nar), dependencies: ['nar']},
    {name: 'Explain', factory: (deps) => new ExplainTool(deps.memory), dependencies: ['memory']},
    {name: 'Learn', factory: (deps) => new LearnTool(deps.memory), dependencies: ['memory']},
    {name: 'Timer', factory: () => new TimerTool(), dependencies: []},
    {name: 'Process', factory: () => new ProcessTool(), dependencies: []}
];

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
    private readonly config: NARConfig;
    private readonly processor: RuleProcessor;
    private readonly _metricsCollector: MetricsCollector;
    private readonly _lmClient?: LMClient;
    private readonly _registry?: SeNARSRegistry;
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
        this._registry = this.config.providerRegistry;

        if (this.config.enableRLFP) this.rlfp = new RLFPLearner({});

        this.io = new NARIO(this.memory, this.taskManager, this.config);
        this.execution = new NARExecution(this.memory, this.taskManager, this.reasoner, this.config, this.rlfp);
        this.lm = new NARLM(this.memory, this._registry, this.config.lmClient, this.config.enableBidirectionalFeedback, this.config.enableProactiveEnrichment, this.config.enableLMStreaming);
        this._metricsCollector = metrics;

        this.initializeOptionalFeatures();
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
        this.stopLM();
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

    private stopLM(): void {
        this.lm.getEnricher()?.stop();
        this.lm.getStreamingClient()?.cancelAllStreams();
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
        if (this._toolsInitialized) return;

        const toolDeps: ToolDependency = {memory: this.memory, nar: this};
        for (const toolDef of TOOL_DEFS) {
            this.tools.register(toolDef.factory(toolDeps));
        }
        this._toolsInitialized = true;
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
