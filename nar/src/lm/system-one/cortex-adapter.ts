import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { LMService } from '../lm-service.js';
import type {
  CognitiveContext,
  CortexHealth,
  GenerativeCortex,
  SynthesisProposition,
  SynthesisQuery,
} from './types.js';

export interface LMServiceCortexConfig {
  lmService: LMService;
  grammar?: string;
  temperature?: number;
  /** H2/X16: explicit model id binding (e.g. 'cloud:quality') for all Cortex calls. */
  model?: string;
}

export class LMServiceCortex implements GenerativeCortex {
  readonly #lmService: LMService;
  readonly #defaultGrammar: string;
  readonly #temperature: number;
  readonly #model?: string;

  constructor(config: LMServiceCortexConfig) {
    this.#lmService = config.lmService;
    this.#defaultGrammar = config.grammar ?? 'narsese-term';
    this.#temperature = config.temperature ?? 0;
    this.#model = config.model;
  }

  async *synthesize(
    context: CognitiveContext,
    query: SynthesisQuery,
    _budget: ReasoningBudget
  ): AsyncGenerator<SynthesisProposition> {
    const maxCandidates = query.maxCandidates ?? 3;
    const grammar = query.grammar ?? this.#defaultGrammar;

    const prompt =
      query.promptOverride ?? this.buildPrompt(context, query.instruction, maxCandidates);

    try {
      const text = await this.#lmService.generateText(prompt, {
        temperature: this.#temperature,
        grammar,
        model: this.#model,
      });

      const candidates = this.parseCandidates(text, maxCandidates);

      yield {
        kind: 'synthesize',
        candidates,
        cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
      };
    } catch (_error) {
      const stubCandidates = Array.from({ length: maxCandidates }, (_, i) => `candidate_${i + 1}`);
      yield {
        kind: 'synthesize',
        candidates: stubCandidates,
        cost: { tokensIn: 0, tokensOut: 0, computeMs: 0, memoryMb: 0 },
      };
    }
  }

  health(): CortexHealth {
    return { provider: 'lm-service', breakerOpen: false };
  }

  private buildPrompt(
    context: CognitiveContext,
    instruction: string,
    maxCandidates: number
  ): string {
    const beliefs = context.topBeliefs.slice(0, 5).join('\n');
    const goals = context.topGoals.slice(0, 3).join('\n');
    const wm = context.workingMemory.slice(0, 3).join('\n');

    return `Top Beliefs:
${beliefs || '(none)'}

Top Goals:
${goals || '(none)'}

Working Memory:
${wm || '(none)'}

Instruction: ${instruction}

Generate up to ${maxCandidates} Narsese candidates. One per line, no extra text.`;
  }

  private parseCandidates(text: string, maxCandidates: number): string[] {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

    const candidates: string[] = [];
    for (const line of lines) {
      if (candidates.length >= maxCandidates) break;
      // Strip potential markdown code fences
      const cleaned = line
        .replace(/^```\w*\n?/, '')
        .replace(/\n?```$/, '')
        .trim();
      if (cleaned) candidates.push(cleaned);
    }

    while (candidates.length < maxCandidates) {
      candidates.push(`candidate_${candidates.length + 1}`);
    }

    return candidates.slice(0, maxCandidates);
  }
}

export function createLMServiceCortex(config: LMServiceCortexConfig): GenerativeCortex {
  return new LMServiceCortex(config);
}
