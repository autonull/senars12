import { type BeliefTruth, formatTruth, stableStringify, unique } from '@senars/util';
import { getModelForTask } from '../lm';
import type { ILMService } from '../lm/interfaces.js';
import { buildGenerationPrompt } from './prompts/generation-v1.js';
import { GenerationOutputSchema } from './schemas.js';
import { SingleFlight } from './singleflight.js';

export interface BeliefInfo {
  term: string;
  truth?: BeliefTruth;
}

export interface DerivationTrace {
  steps: number;
  beliefs: BeliefInfo[];
  newBeliefs: BeliefInfo[];
}

export interface ConflictInfo {
  belief: BeliefInfo;
  conflictWith: BeliefInfo;
  type: 'direct' | 'frequency' | 'implication';
}

export interface GenerationInput {
  query: string;
  derivation: DerivationTrace | null;
  beliefs: BeliefInfo[];
  conflicts: ConflictInfo[];
  userProfile?: { expertise: 'lay' | 'technical'; verbosity: 'concise' | 'detailed' };
}

export interface GenerationOutput {
  response: string;
  confidence: number;
  suggestedFollowups: string[];
  meta: {
    reasoningType: string;
    keyPremises: string[];
    gaps: string[];
  };
}

function classifyReasoning(derivation: DerivationTrace | null): string {
  if (!derivation || derivation.steps === 0) return 'direct observation';
  if (derivation.steps <= 2) return 'simple deduction';
  if (derivation.steps <= 5) return 'multi-step reasoning';
  return 'deep reasoning';
}

function findKnowledgeGaps(beliefs: BeliefInfo[]): string[] {
  const gaps: string[] = [];
  for (const b of beliefs) {
    if (b.truth && b.truth.confidence < 0.6) {
      gaps.push(`more evidence about ${b.term}`);
    }
  }
  return unique(gaps).slice(0, 3);
}

export class NLGenerationService {
  private readonly lm: ILMService | null;
  private readonly flight = new SingleFlight();

  constructor(lm: ILMService | null) {
    this.lm = lm;
  }

  async generate(input: GenerationInput): Promise<GenerationOutput> {
    let key = '';
    try {
      key = stableStringify(input);
    } catch {
      key = `${Date.now()}:${Math.random()}`;
    }
    return this.flight.run(key, () => this.generateInner(input));
  }

  private async generateInner(input: GenerationInput): Promise<GenerationOutput> {
    if (!this.lm) {
      return this.fallbackGenerate(input);
    }

    const derivation = input.derivation;
    const reasoningType = classifyReasoning(derivation);
    const keyPremises = derivation?.newBeliefs.slice(0, 3).map((b) => b.term) ?? [];
    const gaps = findKnowledgeGaps(input.beliefs);

    const prompt = buildGenerationPrompt({
      query: input.query,
      beliefs: derivation?.newBeliefs ?? input.beliefs,
      conflicts: input.conflicts,
      derivationSteps: derivation?.steps,
      reasoningType,
      keyPremises,
      gaps,
      userProfile: input.userProfile,
    });

    try {
      const object = await this.lm.generateObject(prompt, GenerationOutputSchema, {
        task: 'structured',
      });

      return {
        response: object.response,
        confidence: object.confidence,
        suggestedFollowups: object.suggestedFollowups,
        meta: {
          reasoningType: object.meta.reasoningType || reasoningType,
          keyPremises: object.meta.keyPremises.length > 0 ? object.meta.keyPremises : keyPremises,
          gaps: object.meta.gaps.length > 0 ? object.meta.gaps : gaps,
        },
      };
    } catch {
      return this.fallbackGenerate(input);
    }
  }

  private fallbackGenerate(input: GenerationInput): GenerationOutput {
    const derivation = input.derivation;
    if (!derivation || derivation.newBeliefs.length === 0) {
      return {
        response: `I don't have enough information about "${input.query}".`,
        confidence: 0.2,
        suggestedFollowups: [],
        meta: {
          reasoningType: 'no derivation',
          keyPremises: [],
          gaps: [`knowledge about ${input.query}`],
        },
      };
    }

    const best = derivation.newBeliefs[0]!;
    const truth = best.truth ? ` ${formatTruth(best.truth)}` : '';

    return {
      response: `Based on reasoning: ${best.term}${truth}`,
      confidence: best.truth?.confidence ?? 0.5,
      suggestedFollowups: [],
      meta: {
        reasoningType: classifyReasoning(derivation),
        keyPremises: derivation.newBeliefs.slice(0, 3).map((b) => b.term),
        gaps: findKnowledgeGaps(input.beliefs),
      },
    };
  }
}
