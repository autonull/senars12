import type {LMClient} from './types.js';
import type {Memory} from '../memory';
import type {Term} from '../terms';
import {Truth} from '../terms';
import {createBudget, createTask, type Task} from '../types';
import {LMResponseParser} from './parser.js';

export interface EnricherConfig {
    enableProactiveEnrichment: boolean;
    enrichmentIntervalMs: number;
    maxConceptsPerCycle: number;
    minConnectionsForEnrichment: number;
    enableExplanationGeneration: boolean;
    enableQAService: boolean;
}

export interface EnrichmentResult {
    concept: Term;
    hypotheses: Task[];
    bridges: Task[];
    explanations: string[];
}

export class ProactiveEnricher {
    private readonly memory: Memory;
    private readonly lmClient: LMClient;
    private readonly config: EnricherConfig;
    private enrichmentTimer?: NodeJS.Timeout;
    private enrichmentCycle: number = 0;
    private results: EnrichmentResult[] = [];

    constructor(memory: Memory, lmClient: LMClient, config: Partial<EnricherConfig> = {}) {
        this.memory = memory;
        this.lmClient = lmClient;
        this.config = {
            enableProactiveEnrichment: true,
            enrichmentIntervalMs: 60000,
            maxConceptsPerCycle: 10,
            minConnectionsForEnrichment: 2,
            enableExplanationGeneration: true,
            enableQAService: true,
            ...config
        };
    }

    start(): void {
        if (this.config.enableProactiveEnrichment) {
            this.enrichmentTimer = setInterval(
                () => this.runEnrichmentCycle(),
                this.config.enrichmentIntervalMs
            );
        }
    }

    stop(): void {
        if (this.enrichmentTimer) {
            clearInterval(this.enrichmentTimer);
            this.enrichmentTimer = undefined;
        }
    }

    async runEnrichmentCycle(): Promise<EnrichmentResult[]> {
        const cycleResults: EnrichmentResult[] = [];
        this.enrichmentCycle++;

        const underconnectedConcepts = this.findUnderconnectedConcepts();

        for (const conceptData of underconnectedConcepts.slice(0, this.config.maxConceptsPerCycle)) {
            try {
                const result = await this.enrichConcept(conceptData.term);
                if (result.hypotheses.length > 0 || result.bridges.length > 0) {
                    cycleResults.push(result);
                    this.results.push(result);
                }
            } catch (error) {
                console.warn('Failed to enrich concept:', conceptData.term, error);
            }
        }

        return cycleResults;
    }

    async generateExplanation(derivationChain: Task[]): Promise<string> {
        if (!this.config.enableExplanationGeneration) {
            return '';
        }

        const chainStr = derivationChain.map(t => t.term.toString()).join(' -> ');
        const prompt = `Explain the following reasoning chain in natural language:
${chainStr}

Provide a clear, concise explanation of what was derived and why.`;

        try {
            const response = await this.lmClient.generateText(prompt);
            return response.trim();
        } catch (error) {
            console.warn('Failed to generate explanation:', error);
            return '';
        }
    }

    async answerQuestion(question: string, _context?: Task[]): Promise<string> {
        if (!this.config.enableQAService) {
            return '';
        }

        const memoryContext = this.getRelevantMemoryContext(question);
        const contextStr = memoryContext.map(t => `${t.term.toString()}: ${t.truth?.f ?? 0}`).join('\n');

        const prompt = `Given the following knowledge from memory:
${contextStr}

Question: ${question}

Answer the question based on the available knowledge. If the answer cannot be determined from the context, say "I don't have enough information to answer this."`;

        try {
            const response = await this.lmClient.generateText(prompt);
            return response.trim();
        } catch (error) {
            console.warn('Failed to answer question:', error);
            return '';
        }
    }

    getEnrichmentHistory(): EnrichmentResult[] {
        return this.results;
    }

    clearHistory(): void {
        this.results = [];
    }

    getStats(): {
        enrichmentCycles: number;
        totalConceptsEnriched: number;
        totalHypothesesGenerated: number;
        totalBridgesCreated: number;
    } {
        const totalHypotheses = this.results.reduce((sum, r) => sum + r.hypotheses.length, 0);
        const totalBridges = this.results.reduce((sum, r) => r.bridges.length, 0);

        return {
            enrichmentCycles: this.enrichmentCycle,
            totalConceptsEnriched: this.results.length,
            totalHypothesesGenerated: totalHypotheses,
            totalBridgesCreated: totalBridges
        };
    }

    private findUnderconnectedConcepts(): Array<{ term: Term; connections: number }> {
        const concepts = this.memory.listConcepts();
        const conceptConnections: Array<{ term: Term; connections: number }> = [];

        for (const concept of concepts) {
            const connectionCount =
                concept.beliefBag.size +
                concept.questionBag.size +
                concept.goalBag.size;

            if (connectionCount < this.config.minConnectionsForEnrichment) {
                conceptConnections.push({
                    term: concept.term,
                    connections: connectionCount
                });
            }
        }

        return conceptConnections.sort((a, b) => a.connections - b.connections);
    }

    private async enrichConcept(term: Term): Promise<EnrichmentResult> {
        const hypotheses: Task[] = [];
        const bridges: Task[] = [];
        const explanations: string[] = [];

        const hypothesisPrompt = this.buildHypothesisPrompt(term);
        try {
            const response = await this.lmClient.generateText(hypothesisPrompt);
            const parsed = this.parseEnrichmentResponse(response, term);
            hypotheses.push(...parsed.hypotheses);
            bridges.push(...parsed.bridges);
        } catch (error) {
            console.warn('Failed to generate hypotheses for term:', term, error);
        }

        for (const hyp of hypotheses) {
            this.memory.addTask(hyp.term, hyp.type, hyp.truth, hyp.budget);
        }

        for (const bridge of bridges) {
            this.memory.addTask(bridge.term, bridge.type, bridge.truth, bridge.budget);
        }

        return {
            concept: term,
            hypotheses,
            bridges,
            explanations
        };
    }

    private buildHypothesisPrompt(term: Term): string {
        return `Given the concept "${term.toString()}", suggest:
1. One bridging hypothesis that connects this concept to other concepts
2. One property or implication involving this concept

Respond in Narsese format, one statement per line.`;
    }

    private parseEnrichmentResponse(response: string, _term: Term): { hypotheses: Task[]; bridges: Task[] } {
        const lines = response.split('\n').filter(l => l.trim());
        const hypotheses: Task[] = [];
        const bridges: Task[] = [];

        for (const line of lines) {
            const parsed = LMResponseParser.parse(line);
            if (parsed.valid && parsed.term) {
                const truth = parsed.truth ?? Truth.create(0.5, 0.3);
                const task = createTask(parsed.term, 'belief', truth, createBudget(0.4, 0.8));

                if (line.includes('-->') || line.includes('<->')) {
                    hypotheses.push(task);
                } else {
                    bridges.push(task);
                }
            }
        }

        return {hypotheses, bridges};
    }

    private getRelevantMemoryContext(question: string): Task[] {
        const questionLower = question.toLowerCase();
        const concepts = this.memory.listConcepts();
        const relevant: Task[] = [];

        for (const concept of concepts.slice(0, 20)) {
            const symbol = concept.term.toString().toLowerCase();
            if (questionLower.includes(symbol) || symbol.includes(questionLower)) {
                if (concept.beliefBag.size > 0) {
                    const belief = concept.beliefBag.peek();
                    if (belief) {
                        relevant.push({
                            term: concept.term,
                            type: 'belief',
                            truth: belief.truth ?? Truth.NEUTRAL,
                            budget: createBudget(0.5),
                            stamp: (belief as any).stamp ?? {
                                id: 'qa',
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

        return relevant;
    }
}

export const createProactiveEnricher = (memory: Memory, lmClient: LMClient, config?: Partial<EnricherConfig>): ProactiveEnricher => {
    return new ProactiveEnricher(memory, lmClient, config);
};
