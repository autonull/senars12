import { z } from 'zod';
import { BoundedRing, formatTruth } from '@senars/util';
import { parseJsonWith } from './json.js';
import { createLogger } from '@senars/core/logger';
import type { Memory } from '../memory';
import type { Term } from '../terms';
import { TermMap, Truth } from '../terms';
import { createBudget, createTask, type Task } from '../types';
import { clamp01, errMsg } from '../utils';
import { admitTasks } from './admit.js';
import { topBeliefTasks } from './context.js';
import { parseEnrichmentResponse } from './enrichment.js';
import type { LMService } from './lm-service.js';

/** Drop-oldest bound on the pattern history kept for later LM context. */
const RECENT_PATTERN_LIMIT = 20;

const ValidationSchema = z.object({
  verdict: z.enum(['valid', 'invalid', 'uncertain']),
  novelty: z.number().optional(),
  utility: z.number().optional(),
  explanation: z.string().optional(),
  revisedTruth: z.object({ f: z.number(), c: z.number() }).optional(),
});

const ContradictionSchema = z.object({
  explanation: z.string().optional(),
  resolution: z.enum(['merge', 'reject-one', 'keep-both', 'revise']),
  revisedNarsese: z.string().optional(),
  revisedTruth: z.object({ f: z.number(), c: z.number() }).optional(),
});

const PatternsSchema = z.object({
  patterns: z.array(
    z.object({
      pattern: z.string(),
      type: z.string(),
      confidence: z.number().optional(),
      examples: z.array(z.string()).optional(),
    })
  ),
});

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
  private pendingValidations: TermMap<ValidationFeedback> = new TermMap();
  private readonly recentPatterns = new BoundedRing<ExtractedPattern>(RECENT_PATTERN_LIMIT);

  private recordPatterns(patterns: ExtractedPattern[]): void {
    for (const pattern of patterns) this.recentPatterns.push(pattern);
  }

  constructor(memory: Memory, lmService: LMService, config: Partial<FeedbackConfig> = {}) {
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

  async processHypothesis(hypothesis: Task): Promise<ValidationFeedback | null> {
    if (!this.config.enableBidirectionalFeedback || !this.config.enableValidation) {
      return null;
    }

    const context = this.getContextBeliefs();
    const validationPrompt = this.buildStructuredValidationPrompt(hypothesis, context);

    try {
      const obj = await this.lmService.generateObject(validationPrompt, ValidationSchema, {
        task: 'structured',
      });
      const validation = this.applyValidation(obj, hypothesis, context);

      if (validation) {
        await this.injectValidationResult(validation);
        this.pendingValidations.set(hypothesis.term, validation);
      }

      return validation;
    } catch {
      try {
        const response = await this.lmService.generateText(validationPrompt);
        const validation = this.parseStructuredValidation(response, hypothesis, context);

        if (validation) {
          await this.injectValidationResult(validation);
          this.pendingValidations.set(hypothesis.term, validation);
        }

        return validation;
      } catch (error) {
        this.logger.warn(`Failed to validate hypothesis: ${errMsg(error)}`);
        return null;
      }
    }
  }

  private applyValidation(
    obj: z.infer<typeof ValidationSchema>,
    hypothesis: Task,
    context: Task[]
  ): ValidationFeedback | null {
    let result: 'confirmed' | 'contradicted' | 'inconclusive' = 'inconclusive';
    if (obj.verdict === 'valid') result = 'confirmed';
    else if (obj.verdict === 'invalid') result = 'contradicted';

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

  private reviseTruth(
    revised: { f: number; c: number } | undefined,
    current: Truth | undefined,
    result: 'confirmed' | 'contradicted' | 'inconclusive'
  ): Truth | undefined {
    if (revised) return Truth.create(clamp01(revised.f), clamp01(revised.c));
    if (!current) return undefined;
    if (result === 'confirmed')
      return Truth.create(Math.min(current.f * 1.1, 1.0), Math.min(current.c + 0.1, 1.0));
    if (result === 'contradicted')
      return Truth.create(Math.max(current.f * 0.9, 0.0), Math.min(current.c + 0.1, 1.0));
    return undefined;
  }

  async explainContradiction(
    beliefA: Task,
    beliefB: Task
  ): Promise<ContradictionExplanation | null> {
    if (!this.config.enableContradictionExplanation) return null;

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

    try {
      const obj = await this.lmService.generateObject(prompt, ContradictionSchema, {
        task: 'structured',
      });
      return this.applyContradiction(obj, beliefA, beliefB);
    } catch {
      try {
        const response = await this.lmService.generateText(prompt);
        return this.parseContradictionExplanation(response, beliefA, beliefB);
      } catch (error) {
        this.logger.warn(`Failed to explain contradiction: ${errMsg(error)}`);
        return null;
      }
    }
  }

  private applyContradiction(
    obj: z.infer<typeof ContradictionSchema>,
    beliefA: Task,
    beliefB: Task
  ): ContradictionExplanation | null {
    let revisedBelief: Task | undefined;
    if (obj.revisedNarsese && obj.revisedTruth) {
      revisedBelief = createTask(
        { kind: 'atom' as const, symbol: obj.revisedNarsese } as Term,
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
      resolutionStrategy: obj.resolution,
    };
  }

  async extractPatterns(derivations: Task[]): Promise<ExtractedPattern[]> {
    if (!this.config.enablePatternExtraction || derivations.length < 3) return [];

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

    try {
      const obj = await this.lmService.generateObject(prompt, PatternsSchema, {
        task: 'structured',
      });
      const patterns = this.applyPatterns(obj.patterns);
      this.recordPatterns(patterns);
      return patterns;
    } catch {
      try {
        const response = await this.lmService.generateText(prompt);
        const patterns = this.parsePatterns(response);
        this.recordPatterns(patterns);
        return patterns;
      } catch (error) {
        this.logger.warn(`Failed to extract patterns: ${errMsg(error)}`);
        return [];
      }
    }
  }

  private applyPatterns(
    patterns: Array<{ pattern: string; type: string; confidence?: number; examples?: string[] }>
  ): ExtractedPattern[] {
    return patterns
      .filter((p) => typeof p.pattern === 'string' && typeof p.type === 'string')
      .map((p) => ({
        pattern: p.pattern,
        type: p.type,
        confidence: clamp01(p.confidence ?? 0.5),
        examples: p.examples ?? [],
      }));
  }

  async enrichContextWithDerivations(derivations: Task[]): Promise<void> {
    if (!this.config.enableContextEnrichment || derivations.length === 0) {
      return;
    }

    for (const derivation of derivations.slice(0, this.config.maxContextConcepts)) {
      try {
        const concept = this.memory.getConcept(derivation.term);
        if (!concept) continue;
        const connectionCount =
          concept.beliefBag.size() + concept.questionBag.size() + concept.goalBag.size();
        if (connectionCount >= 3) continue;

        const enrichmentPrompt = this.buildEnrichmentPrompt(derivation.term, derivations);
        const response = await this.lmService.generateText(enrichmentPrompt, {
          task: 'structured',
        });
        const bridgingHypotheses = parseEnrichmentResponse(response).hypotheses;

        await admitTasks(this.memory, bridgingHypotheses, 'llm');
      } catch (error) {
        this.logger.warn(`Failed to enrich context for concept: ${errMsg(error)}`);
      }
    }
  }

  getPendingValidations(): ValidationFeedback[] {
    return Array.from(this.pendingValidations.values());
  }

  getRecentPatterns(): ExtractedPattern[] {
    return this.recentPatterns.toArray();
  }

  clearPendingValidations(): void {
    this.pendingValidations.clear();
  }

  private getContextBeliefs(): Task[] {
    return topBeliefTasks(this.memory, {
      limit: this.config.maxContextConcepts,
      minConfidence: this.config.minConfidenceForFeedback,
    });
  }

  private buildStructuredValidationPrompt(hypothesis: Task, context: Task[]): string {
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

  private parseStructuredValidation(
    response: string,
    hypothesis: Task,
    context: Task[]
  ): ValidationFeedback | null {
    try {
      const parsed = parseJsonWith(response, ValidationSchema);
      if (!parsed) return this.parseLegacyValidation(response, hypothesis, context);
      return this.applyValidation(parsed, hypothesis, context);
    } catch {
      return this.parseLegacyValidation(response, hypothesis, context);
    }
  }
  private parseLegacyValidation(
    response: string,
    hypothesis: Task,
    context: Task[]
  ): ValidationFeedback | null {
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
      derivationChain: [hypothesis.term.toString()],
    };
  }

  private parseContradictionExplanation(
    response: string,
    beliefA: Task,
    beliefB: Task
  ): ContradictionExplanation | null {
    try {
      const parsed = parseJsonWith(response, ContradictionSchema);
      return parsed ? this.applyContradiction(parsed, beliefA, beliefB) : null;
    } catch {
      return null;
    }
  }

  private parsePatterns(response: string): ExtractedPattern[] {
    try {
      const parsed = parseJsonWith(response, PatternsSchema);
      if (!parsed || !Array.isArray(parsed.patterns)) return [];
      return this.applyPatterns(parsed.patterns);
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
      await admitTasks(this.memory, [revisedTask], 'llm');
    }
  }

  private buildEnrichmentPrompt(term: Term, derivations: Task[]): string {
    const derivationStr = derivations.map((d) => d.term.toString()).join(', ');

    return `Given the concept "${term.toString()}" and related derivations: ${derivationStr}

Suggest 1-3 bridging hypotheses that could connect this concept to other concepts in the system.
Respond in Narsese format, one per line.`;
  }
}

export const createBidirectionalFeedbackLoop = (
  memory: Memory,
  lmService: LMService,
  config?: Partial<FeedbackConfig>
): BidirectionalFeedbackLoop => {
  return new BidirectionalFeedbackLoop(memory, lmService, config);
};
