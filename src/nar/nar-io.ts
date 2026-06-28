import type {Term} from './terms';
import {termParser, Truth, validateTaskTerm} from './terms';
import type {Truth as TruthType} from './terms/truth.js';
import type {TaskType} from './types';
import {createBudget, EventBus} from './types';
import type {NARConfig} from './nar';
import type {TaskManager} from './task';
import type {Memory} from './memory';
import type {CognitiveParameters} from './config/cognitive-parameters.js';
import {promises as fs} from 'node:fs';
import type {EventBus as AgentEventBus} from '../agent/EventBus.js';

interface SerializedNARState {
    concepts: Array<{ term: string; priority: number }>;
    config: NARConfig;
    timestamp: string;
}

export class NARIO {
    private _eventBus: EventBus | null = null;
    private _systemEventBus: AgentEventBus | null = null;
    private cognitiveParams?: CognitiveParameters;

    constructor(
        private readonly memory: Memory,
        private readonly taskManager: TaskManager,
        private readonly config: NARConfig
    ) {
    }

    setcognitiveParams(params: CognitiveParameters): void {
        this.cognitiveParams = params;
    }

    setEventBus(eventBus: EventBus): void {
        this._eventBus = eventBus;
    }

    setSystemEventBus(bus: AgentEventBus): void {
        this._systemEventBus = bus;
    }

    async input(input: string | Term, type: TaskType = 'belief', truth?: TruthType): Promise<void> {
        const {term: parsedTerm, truth: parsedTruth} = typeof input === 'string'
            ? termParser.parseWithTruth(input)
            : {term: input, truth: undefined};

        const validation = validateTaskTerm(parsedTerm);
        if (!validation.valid) {
            this._eventBus?.emit('warning', {message: validation.reason, term: parsedTerm.toString()});
            return;
        }

        this.addTask(parsedTerm, type, truth ?? parsedTruth ?? Truth.TRUE);
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
                this.memory.addConcept(termParser.parse(concept.term));
            }
        }
    }

    async saveToFile(filename: string): Promise<void> {
        const data = this.export();
        await fs.writeFile(filename, JSON.stringify(data, null, 2));
    }

    async loadFromFile(filename: string): Promise<void> {
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
        const wasNew = !this.memory.getConcept(term);
        this.memory.addTask(term, type, truth, budget);

        if (wasNew && this._eventBus) {
            this._eventBus.emit('concept:created', {
                term,
                priority: budget.priority
            });
            this._systemEventBus?.emit('nar:derivation', {
                term: term.toString(),
                confidence: truth.f,
                timestamp: Date.now(),
            });
        }

        if (this.cognitiveParams?.attention.autoPrime ?? true) {
            this.primeAttention(term);
        }
    }

    private primeAttention(term: Term): void {
        const params = this.cognitiveParams;
        const primeBoost = params?.attention.primeBoost ?? 0.3;
        const relatedBoost = params?.attention.relatedBoost ?? 0.15;
        const maxPriority = params?.priority.maxPriority ?? 1.0;

// Boost priority of the concept itself
        const concept = this.memory.getConcept(term);
        if (concept) {
            concept.priority = Math.min(maxPriority, concept.priority + primeBoost);
        }

// Also boost concepts that share terms (simple relevance propagation)
        if (params?.attention.structuralSimilarity ?? true) {
            const termStr = term.toString();
            for (const c of this.memory.listConcepts()) {
                const cStr = c.term.toString();
                // Boost if concepts share atoms or are structurally related
                if (cStr !== termStr && this.areTermsRelated(termStr, cStr)) {
                    c.priority = Math.min(maxPriority, c.priority + relatedBoost);
                }
            }
        }
    }

    private areTermsRelated(term1: string, term2: string): boolean {
// Extract atoms from inheritance terms like (bird --> animal)
        const match1 = term1.match(/\((\w+)\s+-->\s+(\w+)\)/);
        const match2 = term2.match(/\((\w+)\s+-->\s+(\w+)\)/);

        if (match1 && match2) {
            const [, s1, p1] = match1;
            const [, s2, p2] = match2;
            // Related if they share subject or predicate
            return s1 === s2 || s1 === p2 || p1 === s2 || p1 === p2;
        }
        return false;
    }
}
