import type {LMClient} from './types.js';
import type {Memory} from '../memory';
import type {Term} from '../terms';
import {Truth} from '../terms';
import {createTask, type Task} from '../types';
import {createBudget} from '../types';
import {LMResponseParser} from './parser.js';

export interface FeedbackConfig {
    enableBidirectionalFeedback: boolean;
    enableValidation: boolean;
    enableContextEnrichment: boolean;
    maxContextConcepts: number;
    minConfidenceForFeedback: number;
    maxContradictionAttempts: number;
}

export interface ValidationFeedback {
    originalHypothesis: Task;
    validationResult: 'confirmed' | 'contradicted' | 'inconclusive';
    evidence: Task[];
    revisedTruth?: Truth;
    derivationChain: string[];
}

export class BidirectionalFeedbackLoop {
    private readonly memory: Memory;
    private readonly lmClient: LMClient;
    private readonly config: FeedbackConfig;
    private pendingValidations: Map<string, ValidationFeedback> = new Map();

    constructor(memory: Memory, lmClient: LMClient, config: Partial<FeedbackConfig> = {}) {
        this.memory = memory;
        this.lmClient = lmClient;
        this.config = {
            enableBidirectionalFeedback: true,
            enableValidation: true,
            enableContextEnrichment: true,
            maxContextConcepts: 5,
            minConfidenceForFeedback: 0.6,
            maxContradictionAttempts: 3,
            ...config
        };
    }

    async processHypothesis(hypothesis: Task): Promise<ValidationFeedback | null> {
        if (!this.config.enableBidirectionalFeedback || !this.config.enableValidation) {
            return null;
        }

        const context = await this.gatherContext(hypothesis.term);
        const validationPrompt = this.buildValidationPrompt(hypothesis, context);

        try {
            const response = await this.lmClient.generateText(validationPrompt);
            const validation = await this.parseValidation(response, hypothesis, context);

            if (validation) {
                await this.injectValidationResult(validation);
                this.pendingValidations.set(hypothesis.term.toString(), validation);
            }

            return validation;
        } catch (error) {
            console.warn('Failed to validate hypothesis:', error);
            return null;
        }
    }

    async enrichContextWithDerivations(derivations: Task[]): Promise<void> {
        if (!this.config.enableContextEnrichment || derivations.length === 0) {
            return;
        }

        const underconnectedConcepts = this.findUnderconnectedConcepts(derivations);

        for (const concept of underconnectedConcepts.slice(0, this.config.maxContextConcepts)) {
            try {
                const enrichmentPrompt = this.buildEnrichmentPrompt(concept.term, derivations);
                const response = await this.lmClient.generateText(enrichmentPrompt);
                const bridgingHypotheses = await this.parseEnrichmentResponse(response, concept.term);

                for (const hyp of bridgingHypotheses) {
                    this.memory.addTask(hyp.term, hyp.type, hyp.truth, hyp.budget);
                }
            } catch (error) {
                console.warn('Failed to enrich context for concept:', concept.term, error);
            }
        }
    }

    getPendingValidations(): ValidationFeedback[] {
        return Array.from(this.pendingValidations.values());
    }

    clearPendingValidations(): void {
        this.pendingValidations.clear();
    }

    private async gatherContext(term: Term): Promise<Task[]> {
        const concept = this.memory.getConcept(term);
        if (!concept) {
            return [];
        }

        const context: Task[] = [];
        const concepts = this.memory.listConcepts().slice(0, this.config.maxContextConcepts);

        for (const related of concepts) {
            if (related.beliefBag.size > 0) {
                const belief = related.beliefBag.peek();
                if (belief && belief.truth) {
                    const confidence = belief.truth.f * (belief.truth.c ?? 0);
                    if (confidence >= this.config.minConfidenceForFeedback) {
                        context.push({
                            term: related.term,
                            type: 'belief',
                            truth: belief.truth,
                            budget: createBudget(0.5, 0.8),
                            stamp: (belief as any).stamp ?? {
                                id: 'context',
                                creationTime: Date.now(),
                                source: 'MEMORY' as const,
                                derivations: [],
                                depth: 0
                            },
                            occurrenceTime: Date.now(),
                            derived: false
                        });
                    }
                }
            }
        }

        return context;
    }

    private buildValidationPrompt(hypothesis: Task, context: Task[]): string {
        const contextStr = context.map(t => `${t.term.toString()}: ${t.truth?.f ?? 0}`).join('\n');

        return `Given the following context and hypothesis, validate whether the hypothesis is consistent with the context.
Context:
${contextStr}

Hypothesis: ${hypothesis.term.toString()} (confidence: ${hypothesis.truth?.f ?? 0})

Respond with:
- "VALID" if the hypothesis is consistent with context
- "INVALID" if the hypothesis contradicts context
- "UNCERTAIN" if there's insufficient evidence

Then provide a revised confidence value if different from current.`;
    }

    private async parseValidation(response: string, hypothesis: Task, context: Task[]): Promise<ValidationFeedback | null> {
        const normalized = response.trim().toUpperCase();
        let result: 'confirmed' | 'contradicted' | 'inconclusive' = 'inconclusive';
        let revisedTruth: Truth | undefined;

        if (normalized.startsWith('VALID')) {
            result = 'confirmed';
            const t = hypothesis.truth!;
            revisedTruth = Truth.create(Math.min(t.f * 1.1, 1.0), Math.min(t.c + 0.1, 1.0));
        } else if (normalized.startsWith('INVALID')) {
            result = 'contradicted';
            const t = hypothesis.truth!;
            revisedTruth = Truth.create(Math.max(t.f * 0.9, 0.0), Math.min(t.c + 0.1, 1.0));
        }

        return {
            originalHypothesis: hypothesis,
            validationResult: result,
            evidence: context,
            revisedTruth,
            derivationChain: [hypothesis.term.toString()]
        };
    }

    private async injectValidationResult(validation: ValidationFeedback): Promise<void> {
        if (validation.revisedTruth && validation.originalHypothesis.truth) {
            const revisedTask = createTask(
                validation.originalHypothesis.term,
                'belief',
                validation.revisedTruth,
                createBudget(0.7, 0.8)
            );
            this.memory.addTask(revisedTask.term, revisedTask.type, revisedTask.truth, revisedTask.budget);
        }
    }

    private findUnderconnectedConcepts(derivations: Task[]): Array<{ term: Term; connections: number }> {
        const conceptConnections: Map<string, { term: Term; connections: number }> = new Map();

        for (const task of derivations) {
            const concept = this.memory.getConcept(task.term);
            if (concept) {
                const connectionCount = concept.beliefBag.size + concept.questionBag.size + concept.goalBag.size;
                conceptConnections.set(task.term.toString(), {
                    term: task.term,
                    connections: connectionCount
                });
            }
        }

        const sorted = Array.from(conceptConnections.values())
            .sort((a, b) => a.connections - b.connections);

        return sorted;
    }

    private buildEnrichmentPrompt(term: Term, derivations: Task[]): string {
        const derivationStr = derivations.map(d => d.term.toString()).join(', ');

        return `Given the concept "${term.toString()}" and related derivations: ${derivationStr}

Suggest 1-3 bridging hypotheses that could connect this concept to other concepts in the system.
Respond in Narsese format, one per line.`;
    }

    private async parseEnrichmentResponse(response: string, _term: Term): Promise<Task[]> {
        const lines = response.split('\n').filter(l => l.trim());
        const tasks: Task[] = [];

        for (const line of lines) {
            const parsed = LMResponseParser.parse(line);
            if (parsed.valid && parsed.term) {
                const truth = parsed.truth ?? Truth.NEUTRAL;
                const task = createTask(parsed.term, 'belief', truth, createBudget(0.5, 0.8));
                tasks.push(task);
            }
        }

        return tasks;
    }
}

export const createBidirectionalFeedbackLoop = (memory: Memory, lmClient: LMClient, config?: Partial<FeedbackConfig>): BidirectionalFeedbackLoop => {
    return new BidirectionalFeedbackLoop(memory, lmClient, config);
};
