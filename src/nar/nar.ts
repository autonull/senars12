import { Memory, type MemoryConfig } from './memory/memory.js';
import { Reasoner, type ReasonerConfig } from './reason/reasoner.js';
import { TaskManager } from './task/manager.js';
import { RuleProcessor } from './rules/processor.js';
import { BagStrategy } from './reason/strategy.js';
import { createTask, type TaskType } from './task/task.js';
import { atom, type Term } from './terms/types.js';
import { Truth, type Truth as TruthType } from './terms/truth.js';

export interface NARConfig extends MemoryConfig, ReasonerConfig {}

const DEFAULT_CONFIG: NARConfig = {
    maxConcepts: 1000,
    priorityThreshold: 0.5,
    activationDecayRate: 0.01,
    consolidationInterval: 10,
    cpuThrottleMs: 10,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 1000
};

export class NAR {
    readonly memory: Memory;
    readonly taskManager: TaskManager;
    readonly reasoner: Reasoner;

    private processor: RuleProcessor;

    constructor(config: NARConfig = DEFAULT_CONFIG) {
        this.memory = new Memory(config);
        this.processor = new RuleProcessor();
        this.reasoner = new Reasoner(
            this.memory,
            this.processor,
            BagStrategy,
            config
        );
        this.taskManager = new TaskManager(this.memory);
    }

    async input(input: string | Term, type: TaskType = 'belief', truth?: TruthType): Promise<void> {
        const term = typeof input === 'string' ? atom(input) : input;

        const taskTruth = truth ?? Truth.NEUTRAL;
        const task = createTask(term, type, taskTruth, taskTruth.f * taskTruth.c);
        this.taskManager.addTask(task);
        this.memory.addTask(term, type, taskTruth, task.budget);
    }

    async run(steps = 1): Promise<number> {
        let derived = 0;
        for (let i = 0; i < steps; i++) {
            const results = await this.reasoner.step();
            derived += results.length;

            for (const task of results) {
                this.memory.addTask(task.term, task.type, task.truth, task.budget);
                this.taskManager.addTask(task);
            }
        }
        this.memory.consolidate();
        return derived;
    }

    getConcept(term: Term) {
        return this.memory.getConcept(term);
    }
}