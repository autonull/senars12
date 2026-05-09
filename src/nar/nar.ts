/**
 * NAR - Neural Associative Reasoner
 * Core reasoning engine with pluggable capabilities
 */

import type {Concept} from './memory';
import {Memory, type MemoryStatistics} from './memory';
import {BagStrategy, Reasoner} from './reason';
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
import {CalculateTool, HTTPTool, ReadFileTool, SleepTool, ToolManager, WriteFileTool} from './tools';
import {BaseComponent} from './lifecycle';

interface SerializedNARState {
    concepts: Array<{ term: string; priority: number }>;
    config: NARConfig;
    timestamp: string;
}

export interface NARConfig extends CoreConfig {
    lmClient?: LMClient;
    enableLMRules?: boolean;
    enableTools?: boolean;
}

export class NAR extends BaseComponent {
    readonly memory: Memory;
    readonly taskManager: TaskManager;
    readonly reasoner: Reasoner;
    readonly query: QueryAPI;
    readonly traceAPI: ReasoningTrace;
    readonly tools: ToolManager;

    private readonly processor: RuleProcessor;
    private readonly config: NARConfig;
    private _lmInitialized: boolean = false;
    private _toolsInitialized: boolean = false;

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

        if (this.config.enableLMRules && this.config.lmClient) {
            this.initializeLMRules(this.config.lmClient);
        }

        if (this.config.enableTools) {
            this.initializeTools();
        }
    }

    override async initialize(): Promise<void> {
        await super.initialize();
        this.logger.info('NAR initialized');
    }

    override async start(): Promise<void> {
        await super.start();
        this.logger.info('NAR started');
    }

    override async stop(): Promise<void> {
        await super.stop();
        this.logger.info('NAR stopped');
    }

    override async dispose(): Promise<void> {
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
            const results = await this.reasoner.step();
            derived += results.length;

            for (const task of results) {
                this.memory.addTask(task.term, task.type, task.truth, getBudgetValue(task.budget));
                this.taskManager.addTask(task);
            }
        }

        this.memory.consolidate();
        return derived;
    }

    async* runStream(steps = 1, maxResults = 100): AsyncGenerator<Task> {
        for (let i = 0; i < steps; i++) {
            for await (const task of this.reasoner.run(undefined, maxResults)) {
                yield task;
                this.memory.addTask(task.term, task.type, task.truth, getBudgetValue(task.budget));
                this.taskManager.addTask(task);
            }
            this.memory.consolidate();
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

        const lmRules = [
            LMRules.createNarseseTranslationRule(this.config.lmClient),
            LMRules.createBeliefRevisionRule(this.config.lmClient),
            LMRules.createGoalDecompositionRule(this.config.lmClient),
            LMRules.createHypothesisGenerationRule(this.config.lmClient),
            LMRules.createExplanationGenerationRule(this.config.lmClient),
            LMRules.createAnalogicalReasoningRule(this.config.lmClient),
            LMRules.createMetaReasoningGuidanceRule(this.config.lmClient),
            LMRules.createUncertaintyCalibrationRule(this.config.lmClient),
            LMRules.createSchemaInductionRule(this.config.lmClient),
            LMRules.createTemporalCausalModelingRule(this.config.lmClient),
            LMRules.createVariableGroundingRule(this.config.lmClient),
            LMRules.createConceptElaborationRule(this.config.lmClient),
            LMRules.createInteractiveClarificationRule(this.config.lmClient)
        ];

        for (const rule of lmRules) {
            this.processor.registerLMRule(rule);
        }

        this._lmInitialized = true;
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

        this._toolsInitialized = true;
    }

    private addTask(term: Term, type: TaskType, truth: TruthType = Truth.NEUTRAL): void {
        const budget = createBudget(truth.f * truth.c);
        const task = createTask(term, type, truth, budget);
        this.taskManager.addTask(task);
        this.memory.addTask(term, type, truth, budget);
    }
}
