import { degrade } from '@senars/util/error';
import { BoundedRing } from '@senars/util/collections';
import { clamp01 } from '@senars/util/numeric';
import { createLogger } from '@senars/util/logger';
import { formatTruth } from '@senars/types/truth';
import { TermTruthSchema } from '@senars/util/truth-schema';
import { z } from 'zod';
import { TermMap, Truth } from '../terms';
import { createTask } from '../types';
import { admitTasks } from './admit';
import { topBeliefTasks } from './context';
import { parseEnrichmentResponse } from './enrichment';
import { lmTaskWeight } from './task-weights';
/** Drop-oldest bound on the pattern history kept for later LM context. */
const RECENT_PATTERN_LIMIT = 20;
const ValidationSchema = z.object({
    verdict: z.enum(['valid', 'invalid', 'uncertain']),
    novelty: z.number().optional(),
    utility: z.number().optional(),
    explanation: z.string().optional(),
    revisedTruth: TermTruthSchema.optional(),
});
const ContradictionSchema = z.object({
    explanation: z.string().optional(),
    resolution: z.enum(['merge', 'reject-one', 'keep-both', 'revise']),
    revisedNarsese: z.string().optional(),
    revisedTruth: TermTruthSchema.optional(),
});
const PatternsSchema = z.object({
    patterns: z.array(z.object({
        pattern: z.string(),
        type: z.string(),
        confidence: z.number().optional(),
        examples: z.array(z.string()).optional(),
    })),
});
export class BidirectionalFeedbackLoop {
    gates;
    memory;
    lmService;
    config;
    logger;
    pendingValidations = new TermMap();
    recentPatterns = new BoundedRing(RECENT_PATTERN_LIMIT);
    recordPatterns(patterns) {
        for (const pattern of patterns)
            this.recentPatterns.push(pattern);
    }
    constructor(memory, lmService, gates, config = {}) {
        this.gates = gates;
        this.memory = memory;
        this.lmService = lmService;
        this.logger = createLogger({ scope: 'lm:feedback' });
        this.config = {
            enableBidirectionalFeedback: true,
            enableValidation: true,
            enableContextEnrichment: true,
            enableContradictionExplanation: true,
            enablePatternExtraction: true,
            maxContextConcepts: 5,
            minConfidenceForFeedback: 0.6,
            maxContradictionAttempts: 3,
            ...config,
        };
    }
    /**
     * The one structured-output ladder, which is why each site below says only
     * `generateObject`: `LMService.generateObject` already retries structured
     * output as a JSON-mode text round trip when a provider's native path fails,
     * so the `catch → generateText → reparse` arm each of these three sites
     * spelled out was a third layer over it — a weaker parser, and an extra
     * provider call on every failure. What is left to express is the last resort
     * only validation has: reading a verdict out of prose.
     *
     * The try covers the call and nothing else. Before, a throw from a local
     * transform on the way out was caught here and answered with a second LM call
     * through a different parser.
     */
    async structured(prompt, schema, onFailure) {
        return degrade(this.logger, onFailure, () => this.lmService.generateObject(prompt, schema, { task: 'structured' }), () => null);
    }
    /** The prose last resort: read a verdict out of a reply that ignored the schema. */
    async legacyValidation(prompt, hypothesis, context) {
        const response = await degrade(this.logger, 'Failed to validate hypothesis (degraded)', () => this.lmService.generateText(prompt), () => null);
        return response === null ? null : this.parseLegacyValidation(response, hypothesis, context);
    }
    async processHypothesis(hypothesis) {
        if (!this.config.enableBidirectionalFeedback || !this.config.enableValidation) {
            return null;
        }
        const context = this.getContextBeliefs();
        const validationPrompt = this.buildStructuredValidationPrompt(hypothesis, context);
        const obj = await this.structured(validationPrompt, ValidationSchema, 'Failed to validate hypothesis');
        const validation = obj
            ? this.applyValidation(obj, hypothesis, context)
            : await this.legacyValidation(validationPrompt, hypothesis, context);
        if (validation) {
            await this.injectValidationResult(validation);
            this.pendingValidations.set(hypothesis.term, validation);
        }
        return validation;
    }
    applyValidation(obj, hypothesis, context) {
        let result = 'inconclusive';
        if (obj.verdict === 'valid')
            result = 'confirmed';
        else if (obj.verdict === 'invalid')
            result = 'contradicted';
        return {
            originalHypothesis: hypothesis,
            validationResult: result,
            evidence: context,
            revisedTruth: this.reviseTruth(obj.revisedTruth, hypothesis.truth, result),
            derivationChain: [hypothesis.term.toString()],
            explanation: obj.explanation,
            novelty: obj.novelty,
            utility: obj.utility,
        };
    }
    reviseTruth(revised, current, result) {
        if (revised)
            return Truth.normalize(revised.f, revised.c);
        if (!current)
            return undefined;
        if (result === 'confirmed')
            return Truth.reinforce(current);
        if (result === 'contradicted')
            return Truth.contradict(current);
        return undefined;
    }
    async explainContradiction(beliefA, beliefB) {
        if (!this.config.enableContradictionExplanation)
            return null;
        const prompt = `Two beliefs in memory appear contradictory. Analyze and explain.

Belief A: ${beliefA.term.toString()} ${beliefA.truth ? formatTruth(beliefA.truth) : ''}
Belief B: ${beliefB.term.toString()} ${beliefB.truth ? formatTruth(beliefB.truth) : ''}

Provide a JSON response:
{
  "explanation": "Why these contradict and which is more likely correct",
  "resolution": "merge|reject-one|keep-both|revise",
  "revisedNarsese": "If revision needed, the revised Narsese statement",
  "revisedTruth": {"f": 0.8, "c": 0.7}
}`;
        const obj = await this.structured(prompt, ContradictionSchema, 'Failed to explain contradiction');
        return obj ? this.applyContradiction(obj, beliefA, beliefB) : null;
    }
    applyContradiction(obj, beliefA, beliefB) {
        let revisedBelief;
        if (obj.revisedNarsese && obj.revisedTruth) {
            revisedBelief = createTask({ kind: 'atom', symbol: obj.revisedNarsese }, 'belief', Truth.create(obj.revisedTruth.f, obj.revisedTruth.c), lmTaskWeight('revision'));
        }
        return {
            beliefA,
            beliefB,
            explanation: obj.explanation ?? 'Contradiction analyzed',
            revisedBelief,
            resolutionStrategy: obj.resolution,
        };
    }
    async extractPatterns(derivations) {
        if (!this.config.enablePatternExtraction || derivations.length < 3)
            return [];
        const chainStr = derivations.map((d) => d.term.toString()).join(' → ');
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
        const obj = await this.structured(prompt, PatternsSchema, 'Failed to extract patterns');
        if (!obj)
            return [];
        const patterns = this.applyPatterns(obj.patterns);
        this.recordPatterns(patterns);
        return patterns;
    }
    applyPatterns(patterns) {
        return patterns
            .filter((p) => typeof p.pattern === 'string' && typeof p.type === 'string')
            .map((p) => ({
            pattern: p.pattern,
            type: p.type,
            confidence: clamp01(p.confidence ?? 0.5),
            examples: p.examples ?? [],
        }));
    }
    async enrichContextWithDerivations(derivations) {
        if (!this.config.enableContextEnrichment || derivations.length === 0) {
            return;
        }
        for (const derivation of derivations.slice(0, this.config.maxContextConcepts)) {
            const concept = this.memory.getConcept(derivation.term);
            if (!concept)
                continue;
            const connectionCount = concept.beliefBag.size + concept.questionBag.size + concept.goalBag.size;
            if (connectionCount >= 3)
                continue;
            const enrichmentPrompt = this.buildEnrichmentPrompt(derivation.term, derivations);
            const response = await degrade(this.logger, `Failed to enrich context for concept: ${derivation.term}`, () => this.lmService.generateText(enrichmentPrompt, { task: 'structured' }), () => null);
            if (response === null)
                continue;
            await admitTasks(this.memory, parseEnrichmentResponse(response).hypotheses, 'llm', this.gates);
        }
    }
    getPendingValidations() {
        return Array.from(this.pendingValidations.values());
    }
    getRecentPatterns() {
        return this.recentPatterns.toArray();
    }
    clearPendingValidations() {
        this.pendingValidations.clear();
    }
    getContextBeliefs() {
        return topBeliefTasks(this.memory, {
            limit: this.config.maxContextConcepts,
            minConfidence: this.config.minConfidenceForFeedback,
        });
    }
    buildStructuredValidationPrompt(hypothesis, context) {
        const contextStr = context
            .map((t) => `${t.term.toString()}: ${formatTruth(t.truth)}`)
            .join('\n');
        return `You are validating a hypothesis against known context.

Context beliefs:
${contextStr}

Hypothesis: ${hypothesis.term.toString()} ${hypothesis.truth ? formatTruth(hypothesis.truth) : ''}

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
    parseLegacyValidation(response, hypothesis, context) {
        const normalized = response.trim().toUpperCase();
        const result = normalized.startsWith('VALID')
            ? 'confirmed'
            : normalized.startsWith('INVALID')
                ? 'contradicted'
                : 'inconclusive';
        return {
            originalHypothesis: hypothesis,
            validationResult: result,
            evidence: context,
            revisedTruth: this.reviseTruth(undefined, hypothesis.truth, result),
            derivationChain: [hypothesis.term.toString()],
        };
    }
    async injectValidationResult(validation) {
        if (validation.revisedTruth && validation.originalHypothesis.truth) {
            const revisedTask = createTask(validation.originalHypothesis.term, 'belief', validation.revisedTruth, lmTaskWeight('revision'));
            await admitTasks(this.memory, [revisedTask], 'llm', this.gates);
        }
    }
    buildEnrichmentPrompt(term, derivations) {
        const derivationStr = derivations.map((d) => d.term.toString()).join(', ');
        return `Given the concept "${term.toString()}" and related derivations: ${derivationStr}

Suggest 1-3 bridging hypotheses that could connect this concept to other concepts in the system.
Respond in Narsese format, one per line.`;
    }
}
export const createBidirectionalFeedbackLoop = (memory, lmService, gates, config) => {
    return new BidirectionalFeedbackLoop(memory, lmService, gates, config);
};
