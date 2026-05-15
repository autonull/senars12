import type {Term} from '../terms';
import {termParser} from '../terms';
import type {Task, TaskType, TermFilter} from '../types';
import type {Concept} from '../memory';
import {createLogger} from '../logger';

const logger = createLogger({scope: 'QueryAPI'});

export interface QueryResult {
    beliefs: Task[];
    questions: Task[];
    concepts: Concept[];
}

export interface Answer {
    question: string;
    answer?: string;
    confidence: number;
    evidence: Task[];
    derivationPath?: string[];
}

export interface MemoryRef {
    getConcept: (term: Term) => Concept | undefined;
    findSimilarConcepts: (term: Term, limit?: number) => Concept[];
    listConcepts: () => Concept[];
}

export class QueryAPI {
    private readonly memory: MemoryRef;

    constructor(memory: MemoryRef) {
        this.memory = memory;
    }

    getBeliefs(filter?: TermFilter): Task[] {
        return this.queryByType('belief', filter);
    }

    getGoals(filter?: TermFilter): Task[] {
        return this.queryByType('goal', filter);
    }

    getQuestions(filter?: TermFilter): Task[] {
        return this.queryByType('question', filter);
    }

    query(term: Term, filter?: Omit<TermFilter, 'pattern'>): QueryResult {
        const concepts = this.memory.findSimilarConcepts(term);
        const beliefs: Task[] = [];
        const questions: Task[] = [];

        for (const concept of concepts) {
            if (concept.beliefBag.size > 0) {
                const beliefTasks = this.extractTasks(concept, 'belief');
                beliefs.push(...this.applyFilters(beliefTasks, filter));
            }
            if (concept.questionBag && concept.questionBag.size > 0) {
                questions.push(...this.extractTasks(concept, 'question'));
            }
        }

        return {
            beliefs: this.limitResults(beliefs, filter?.limit),
            questions: this.limitResults(questions, filter?.limit),
            concepts
        };
    }

    async ask(question: string | Term): Promise<Answer> {
        const questionStr = typeof question === 'string' ? question : question.toString();
        const questionTerm = typeof question === 'string' ? this.parseQuestion(question) : question;

        if (!questionTerm) {
            return {question: questionStr, confidence: 0, evidence: []};
        }

        const concept = this.memory.getConcept(questionTerm);
        if (concept) {
            const belief = concept.beliefBag.peek();
            if (belief?.truth) {
                const confidence = belief.truth.f * belief.truth.c;
                if (confidence >= 0.5) {
                    return {
                        question: questionStr,
                        answer: questionTerm.toString(),
                        confidence,
                        evidence: [this.createTaskFromBelief(questionTerm, belief, concept.priority)],
                        derivationPath: this.extractDerivationPath(belief.stamp)
                    };
                }
            }
        }

        const relatedConcepts = this.memory.findSimilarConcepts(questionTerm, 5);
        for (const related of relatedConcepts) {
            const belief = related.beliefBag.peek();
            if (belief?.truth) {
                const confidence = belief.truth.f * belief.truth.c;
                if (confidence >= 0.5) {
                    return {
                        question: questionStr,
                        answer: related.term.toString(),
                        confidence,
                        evidence: [this.createTaskFromBelief(related.term, belief, related.priority)],
                        derivationPath: this.extractDerivationPath(belief.stamp)
                    };
                }
            }
        }

        return {question: questionStr, confidence: 0, evidence: []};
    }

    private createTaskFromBelief(term: Term, belief: {truth?: {f: number; c: number}; stamp?: import('../types').Stamp}, priority: number): Task {
        return {
            term,
            type: 'belief',
            truth: belief.truth!,
            budget: {priority, durability: 0.8, quality: 0.9, cycles: 0, depth: 0},
            stamp: belief.stamp ?? {id: '', creationTime: 0, source: 'INPUT' as const, derivations: [], depth: 0},
            occurrenceTime: 0,
            derived: false
        };
    }

    private extractDerivationPath(stamp?: import('../types').Stamp): string[] {
        const path: string[] = [];
        let currentStamp: import('../types').Stamp | undefined = stamp;

        while (currentStamp && path.length < 10) {
            path.push(currentStamp.id);
            const derivations = currentStamp.derivations;
            if (!derivations || derivations.length === 0) break;
            currentStamp = undefined;
        }

        return path;
    }

    private parseQuestion(question: string): Term | null {
        try {
            if (question.includes('-->') || question.includes('<->') || question.includes('=>')) {
                return termParser.parse(question);
            }
            return null;
        } catch (error) {
            logger.warn(`Failed to parse question: ${question} - ${error}`);
            return null;
        }
    }

    private queryByType(type: TaskType, filter?: TermFilter): Task[] {
        const tasks = this.memory.listConcepts().flatMap(concept => this.extractTasks(concept, type));
        return this.limitResults(this.applyFilters(tasks, filter), filter?.limit);
    }

    private extractTasks(concept: Concept, type: TaskType): Task[] {
        const bag = type === 'belief' ? concept.beliefBag : type === 'goal' ? concept.goalBag : type === 'question' ? concept.questionBag : null;
        if (!bag) return [];

        return bag.toArray().map(item => ({
            term: concept.term,
            type,
            truth: item.truth,
            budget: typeof item.budget === 'number' ? {priority: item.budget, durability: 0.8, quality: 0.9, cycles: 0, depth: 0} : item.budget,
            stamp: item.stamp ?? {id: '', creationTime: 0, source: 'INPUT' as const, derivations: [], depth: 0},
            occurrenceTime: item.occurrenceTime || Date.now(),
            derived: item.derived || false
        } as Task));
    }

    private applyFilters(tasks: Task[], filter?: TermFilter): Task[] {
        if (!filter) return tasks;

        return tasks.filter(task => {
            if (filter.pattern && task.term.toString() !== filter.pattern.toString()) return false;
            if (filter.truthRange) {
                const [min, max] = filter.truthRange;
                const confidence = task.truth.f * task.truth.c;
                if (confidence < min || confidence > max) return false;
            }
            if (filter.recency && Date.now() - task.occurrenceTime > filter.recency) return false;
            if (filter.type && task.type !== filter.type) return false;
            return true;
        });
    }

    private matchesPattern(task: Task, pattern: string): boolean {
        return task.term.toString() === pattern;
    }

    private limitResults(tasks: Task[], limit?: number): Task[] {
        if (!limit || limit >= tasks.length) return tasks;
        return tasks.slice(0, limit);
    }
}

export const createQueryAPI = (memory: MemoryRef): QueryAPI => {
    return new QueryAPI(memory);
};