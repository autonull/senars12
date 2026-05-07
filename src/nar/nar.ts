/**
 * NAR - Neural Associative Reasoner
 * Core reasoning engine with pluggable capabilities
 */

import {Memory} from './memory';
import {Reasoner} from './reason';
import {TaskManager} from './task';
import {RuleProcessor} from './rules';
import {BagStrategy} from './reason';
import {createBudget, createTask, getBudgetValue, type TaskType, type Task} from './types';
import type {Term} from './terms';
import type {Truth as TruthType} from './terms/truth.js';
import {Truth} from './terms';
import {EventBus} from './types';
import type {LMClient} from './lm';
import {LMRules} from './lm';
import {termParser} from './terms';
import {ConfigurationError, type CoreConfig, DEFAULT_CONFIG} from './types';

export interface NARConfig extends CoreConfig {
  lmClient?: LMClient;
  enableLMRules?: boolean;
}

export class NAR {
  readonly memory: Memory;
  readonly taskManager: TaskManager;
  readonly reasoner: Reasoner;
  readonly eventBus: EventBus;

  private readonly processor: RuleProcessor;
  private readonly config: NARConfig;
  private _lmInitialized: boolean = false;

  constructor(config: NARConfig = DEFAULT_CONFIG) {
    this.config = this.validateConfig(config);
    this.eventBus = new EventBus();
    this.memory = new Memory(this.config);
    this.processor = new RuleProcessor();
    this.processor.setEventBus(this.eventBus);
    this.reasoner = new Reasoner(this.memory, this.processor, BagStrategy, this.config);
    this.taskManager = new TaskManager(this.memory);

    if (this.config.enableLMRules && this.config.lmClient) {
      this.initializeLMRules(this.config.lmClient);
    }
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

  getConcept(term: Term) {
    return this.memory.getConcept(term);
  }

  listConcepts() {
    return this.memory.listConcepts();
  }

  clearMemory() {
    this.memory.clear();
  }

  getStatistics() {
    return this.memory.getStatistics();
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

  enableLMRules(lmClient: LMClient): void {
    if (this._lmInitialized) {
      return;
    }
    
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
  
  private initializeLMRules(lmClient: LMClient): void {
    this.enableLMRules(lmClient);
  }

  private addTask(term: Term, type: TaskType, truth: TruthType = Truth.NEUTRAL): void {
    const budget = createBudget(truth.f * truth.c);
    const task = createTask(term, type, truth, budget);
    this.taskManager.addTask(task);
    this.memory.addTask(term, type, truth, budget);
  }

  export(): Record<string, any> {
    return {
      concepts: this.memory.listConcepts().map(c => ({
        term: c.term.toString(),
        priority: c.priority
      })),
      config: this.config,
      timestamp: new Date().toISOString()
    };
  }

  import(data: Record<string, any>): void {
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
    const { promises: fs } = await import('fs');
    const data = this.export();
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
  }

  async loadFromFile(filename: string): Promise<void> {
    const { promises: fs } = await import('fs');
    const content = await fs.readFile(filename, 'utf-8');
    const data = JSON.parse(content);
    this.import(data);
  }
}
