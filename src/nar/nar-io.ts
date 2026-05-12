import type {Term} from './terms';
import {termParser, Truth} from './terms';
import type {Truth as TruthType} from './terms/truth.js';
import type {TaskType} from './types';
import {createBudget, createTask} from './types';
import type {NARConfig} from './nar';
import type {TaskManager} from './task';
import type {Memory} from './memory';

interface SerializedNARState {
    concepts: Array<{ term: string; priority: number }>;
    config: NARConfig;
    timestamp: string;
}

export class NARIO {
    constructor(
        private readonly memory: Memory,
        private readonly taskManager: TaskManager,
        private readonly config: NARConfig
    ) {
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
        const budget = createBudget(concept.priority ?? 0.5);
        this.memory.addConcept(
          termParser.parse(concept.term),
          budget
        );
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

    private addTask(term: Term, type: TaskType, truth: TruthType = Truth.NEUTRAL): void {
        const budget = createBudget(truth.f * truth.c);
        const task = createTask(term, type, truth, budget);
        this.taskManager.addTask(task);
        this.memory.addTask(term, type, truth, budget);
    }
}
