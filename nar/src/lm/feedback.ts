import {LMService} from './lm-service.js';
import type {Memory} from '../memory';
import type {Term} from '../terms';
import {Truth} from '../terms';
import {createBudget, createTask, type Task} from '../types';
import {createLogger} from '../logger';
import {clamp01, errMsg} from '../utils';
import {parseEnrichmentResponse} from './enrichment.js';

export interface FeedbackConfig {
    enableBidirectionalFeedback: boolean;
    enableValidation: boolean;
    enableContextEnrichment: boolean;
    enableContradictionExplanation: boolean;
    enablePatternExtraction: boolean;
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
    explanation?: string;
    novelty?: number;
    utility?: number;
}

export interface ContradictionExplanation {
    beliefA: Task;
    beliefB: Task;
    explanation: string;
    revisedBelief?: Task;
    resolutionStrategy: 'merge' | 'reject-one' | 'keep-both' | 'revise';
}

export interface ExtractedPattern {
    pattern: string;
    confidence: number;
    examples: string[];
    type: string;
}

export class BidirectionalFeedbackLoop {
    private readonly memory: Memory;
    private readonly lmService: LMService;
    private readonly config: FeedbackConfig;
    private readonly logger: ReturnType<typeof createLogger>;
    private pendingValidations: Map<string, ValidationFeedback> = new Map();
    private recentPatterns: ExtractedPattern[] = [];

    constructor(memory: Memory, lmService: LMService, config: Partial<FeedbackConfig> = {}) {
        this.memory = memory;
        this.lmService = lmService;
        this.logger = createLogger({scope: 'lm:feedback'});
        this.config = {
            enableBidirectionalFeedback: true,
            enableValidation: true,
            enableContextEnrichment: true,
            enableContradictionExplanation: true,
            enablePatternExtraction: true,
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

        const context = this.getContextBeliefs();
        const validationPrompt = this.buildStructuredValidationPrompt(hypothesis, context);

        try {
            const response = await this.lmService.generateText(validationPrompt);
            const validation = this.parseStructuredValidation(response, hypothesis, context);

            if (validation) {
                await this.injectValidationResult(validation);
                this.pendingValidations.set(hypothesis.term.toString(), validation);
            }

            return validation;
        } catch (error) {
            this.logger.warn(`Failed to validate hypothesis: ${errMsg(error)}`);
            return null;
        }
    }

    async explainContradiction(beliefA: Task, beliefB: Task): Promise<ContradictionExplanation | null> {
        if (!this.config.enableContradictionExplanation) return null;

        const prompt = `Two beliefs in memory appear contradictory. Analyze and explain.

Belief A: ${beliefA.term.toString()} (f=${beliefA.truth?.f.toFixed(2)}, c=${beliefA.truth?.c.toFixed(2)})
Belief B: ${beliefB.term.toString()} (f=${beliefB.truth?.f.toFixed(2)}, c=${beliefB.truth?.c.toFixed(2)})

Provide a JSON response:
{
  "explanation": "Why these contradict and which is more likely correct",
  "resolution": "merge|reject-one|keep-both|revise",
  "revisedNarsese": "If revision needed, the revised Narsese statement",
  "revisedTruth": {"f": 0.8, "c": 0.7}
}`;

        try {
            const response = await this.lmService.generateText(prompt);
            return this.parseContradictionExplanation(response, beliefA, beliefB);
        } catch (error) {
            this.logger.warn(`Failed to explain contradiction: ${errMsg(error)}`);
            return null;
        }
    }

    async extractPatterns(derivations: Task[]): Promise<ExtractedPattern[]> {
        if (!this.config.enablePatternExtraction || derivations.length < 3) return [];

        const chainStr = derivations.map(d => d.term.toString()).join(' → ');
        const prompt = `Analyze this derivation chain and extract reusable reasoning patterns.

Chain: ${chainStr}

Identify 1-3 patterns that could be applied to similar problems.
Respond with JSON:
{
  "patterns": [
    {
      "pattern": "description of the pattern",
      "type": "transitivity|analogy|causal|induction|deduction",
      "confidence": 0.8,
      "examples": ["example application"]
    }
  ]
}`;

        try {
            const response = await this.lmService.generateText(prompt);
            const patterns = this.parsePatterns(response);
            this.recentPatterns.push(...patterns);
            if (this.recentPatterns.length > 20) {
                this.recentPatterns = this.recentPatterns.slice(-20);
            }
            return patterns;
        } catch (error) {
            this.logger.warn(`Failed to extract patterns: ${errMsg(error)}`);
            return [];
        }
    }

async enrichContextWithDerivations(derivations: Task[]): Promise<void> {
		if (!this.config.enableContextEnrichment || derivations.length === 0) {
			return;
		}

		for (const derivation of derivations.slice(0, this.config.maxContextConcepts)) {
			try {
				const concept = this.memory.getConcept(derivation.term);
				if (!concept) continue;
				const connectionCount = concept.beliefBag.size + concept.questionBag.size + concept.goalBag.size;
				if (connectionCount >= 3) continue;

				const enrichmentPrompt = this.buildEnrichmentPrompt(derivation.term, derivations);
				const response = await this.lmService.generateText(enrichmentPrompt, {task: 'structured'});
				const bridgingHypotheses = parseEnrichmentResponse(response).hypotheses;

				for (const hyp of bridgingHypotheses) {
					this.memory.addTask(hyp.term, hyp.type, hyp.truth, hyp.budget, hyp.stamp);
				}
			} catch (error) {
				this.logger.warn(`Failed to enrich context for concept: ${errMsg(error)}`);
			}
		}
	}

    getPendingValidations(): ValidationFeedback[] {
        return Array.from(this.pendingValidations.values());
    }

    getRecentPatterns(): ExtractedPattern[] {
        return [...this.recentPatterns];
    }

    clearPendingValidations(): void {
        this.pendingValidations.clear();
    }

    private getContextBeliefs(): Task[] {
        return this.memory.listConcepts().slice(0, this.config.maxContextConcepts).map(c => {
            const belief = c.beliefBag.peek();
            if (!belief?.truth || !belief.stamp) return null;
            const confidence = belief.truth.f * belief.truth.c;
            if (confidence < this.config.minConfidenceForFeedback) return null;
            return {
                term: c.term,
                type: 'belief' as const,
                truth: belief.truth,
                budget: createBudget(0.5, 0.8),
                stamp: belief.stamp,
                occurrenceTime: Date.now(),
                derived: false
            };
        }).filter(t => t !== null) as Task[];
    }

    private buildStructuredValidationPrompt(hypothesis: Task, context: Task[]): string {
        const contextStr = context.map(t => `${t.term.toString()}: f=${t.truth.f.toFixed(2)} c=${t.truth.c.toFixed(2)}`).join('\n');

        return `You are validating a hypothesis against known context.

Context beliefs:
${contextStr}

Hypothesis: ${hypothesis.term.toString()} (f=${hypothesis.truth?.f.toFixed(2)}, c=${hypothesis.truth?.c.toFixed(2)})

Evaluate on three dimensions:
1. Validity: Is it consistent with context?
2. Novelty: Does it provide new information beyond existing beliefs?
3. Utility: Is it useful for reasoning?

Respond with JSON:
{
  "verdict": "valid|invalid|uncertain",
  "novelty": 0.7,
  "utility": 0.8,
  "explanation": "Brief explanation",
  "revisedTruth": {"f": 0.85, "c": 0.75}
}`;
    }

    private parseStructuredValidation(response: string, hypothesis: Task, context: Task[]): ValidationFeedback | null {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return this.parseLegacyValidation(response, hypothesis, context);

            const obj = JSON.parse(jsonMatch[0]);
            let result: 'confirmed' | 'contradicted' | 'inconclusive' = 'inconclusive';
            let revisedTruth: Truth | undefined;

            if (obj.verdict === 'valid') {
                result = 'confirmed';
            } else if (obj.verdict === 'invalid') {
                result = 'contradicted';
            }

            if (obj.revisedTruth) {
                revisedTruth = Truth.create(
                    clamp01(obj.revisedTruth.f),
                    clamp01(obj.revisedTruth.c)
                );
            } else if (hypothesis.truth) {
                const t = hypothesis.truth;
                if (result === 'confirmed') {
                    revisedTruth = Truth.create(Math.min(t.f * 1.1, 1.0), Math.min(t.c + 0.1, 1.0));
                } else if (result === 'contradicted') {
                    revisedTruth = Truth.create(Math.max(t.f * 0.9, 0.0), Math.min(t.c + 0.1, 1.0));
                }
            }

            return {
                originalHypothesis: hypothesis,
                validationResult: result,
                evidence: context,
                revisedTruth,
                derivationChain: [hypothesis.term.toString()],
                explanation: obj.explanation,
                novelty: obj.novelty,
                utility: obj.utility,
            };
        } catch {
            return this.parseLegacyValidation(response, hypothesis, context);
        }
    }

    private parseLegacyValidation(response: string, hypothesis: Task, context: Task[]): ValidationFeedback | null {
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

    private parseContradictionExplanation(response: string, beliefA: Task, beliefB: Task): ContradictionExplanation | null {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;

            const obj = JSON.parse(jsonMatch[0]);
            const strategy = obj.resolution as ContradictionExplanation['resolutionStrategy'];
            if (!['merge', 'reject-one', 'keep-both', 'revise'].includes(strategy)) return null;

            let revisedBelief: Task | undefined;
            if (obj.revisedNarsese && obj.revisedTruth) {
                revisedBelief = createTask(
                    {kind: 'atom' as const, symbol: obj.revisedNarsese} as Term,
                    'belief',
                    Truth.create(obj.revisedTruth.f, obj.revisedTruth.c),
                    createBudget(0.7, 0.8)
                );
            }

            return {
                beliefA,
                beliefB,
                explanation: obj.explanation ?? 'Contradiction analyzed',
                revisedBelief,
                resolutionStrategy: strategy,
            };
        } catch {
            return null;
        }
    }

    private parsePatterns(response: string): ExtractedPattern[] {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return [];

            const obj = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(obj.patterns)) return [];

            return obj.patterns
                .filter((p: unknown): p is { pattern: string; type: string; confidence: number; examples: string[] } =>
                    typeof p === 'object' && p !== null && 'pattern' in p && 'type' in p
                )
                .map((p: { pattern: string; type: string; confidence?: number; examples?: string[] }) => ({
                    pattern: p.pattern,
                    type: p.type,
                    confidence: clamp01(p.confidence ?? 0.5),
                    examples: p.examples ?? [],
                }));
        } catch {
            return [];
        }
    }

    private async injectValidationResult(validation: ValidationFeedback): Promise<void> {
        if (validation.revisedTruth && validation.originalHypothesis.truth) {
            const revisedTask = createTask(
                validation.originalHypothesis.term,
                'belief',
                validation.revisedTruth,
                createBudget(0.7, 0.8)
            );
            this.memory.addTask(revisedTask.term, revisedTask.type, revisedTask.truth, revisedTask.budget, revisedTask.stamp);
        }
    }

    private buildEnrichmentPrompt(term: Term, derivations: Task[]): string {
        const derivationStr = derivations.map(d => d.term.toString()).join(', ');

        return `Given the concept "${term.toString()}" and related derivations: ${derivationStr}

Suggest 1-3 bridging hypotheses that could connect this concept to other concepts in the system.
Respond in Narsese format, one per line.`;
    }
}

export const createBidirectionalFeedbackLoop = (memory: Memory, lmService: LMService, config?: Partial<FeedbackConfig>): BidirectionalFeedbackLoop => {
    return new BidirectionalFeedbackLoop(memory, lmService, config);
};
