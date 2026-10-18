/**
 * CORE.19 C6 — the neuro-symbolic voice.
 *
 * One `Formalizer` contract, one null (deterministic) provider, one hosted
 * provider, and one validation gate. A `Formalizer` turns an utterance into a
 * `PerceivedInterpretation` — a formalization batch plus its provenance
 * (`createdBy`, `provider`) — and turns a derivation/conflict back into text.
 *
 * The null provider is the D10 path: with no LM configured, structured Narsese
 * still formalizes deterministically and nothing else is invented. The hosted
 * provider *is* the existing safe pipeline (`NLUnderstandingService`, which runs
 * the {@link SymbolicFirewall}), so there is no second translation path to keep
 * in step (C6.3).
 *
 * Admission is never here. A caller validates the interpretation with
 * {@link validateInterpretation} and hands it to `KernelPerceptionGate`, the one
 * place a task is admitted (C6.2).
 */

import type {
  FormalizationCandidate,
  FormalizationBatch,
  TaskAdmittedEvent,
} from '@senars/core/schemas';
import { asBeliefTruth, makeId } from '@senars/util';
import type { ILMService } from '../lm/interfaces.js';
import { parseTaskTolerant } from '../terms';
import { defaultFirewall, SymbolicFirewall } from './firewall.js';
import {
  type GenerationInput,
  type GenerationOutput,
  NLGenerationService,
} from './generation.js';
import { normalizeNarsese } from './normalize.js';
import {
  detectAmbiguityFlags,
  locateSpan,
  NLUnderstandingService,
  type NLContext,
} from './understanding.js';

/** Where an interpretation came from — the D17 tag a proposal carries. */
export const PERCEIVED_ORIGINS = ['user', 'llm-proposed'] as const;

export type PerceivedOrigin = (typeof PERCEIVED_ORIGINS)[number];

/**
 * A formalization the kernel perceived, plus the provenance the candidates
 * themselves cannot carry. It *is* a `FormalizationBatch` (so it feeds the
 * perception gate directly) with its origin and the provider that produced it.
 */
export interface PerceivedInterpretation extends FormalizationBatch {
  createdBy: PerceivedOrigin;
  provider: string;
  /** Why the provider produced no usable candidate — a declared gap, not a silence (D15). */
  rejection?: string;
}

export interface Formalizer {
  readonly provider: string;
  /** Natural language (or Narsese) → a perceived interpretation. */
  nlToFormal(text: string, ctx?: NLContext): Promise<PerceivedInterpretation>;
  /** A derivation/conflict/question → natural language, engine facts distinct from paraphrase. */
  formalToNl(input: GenerationInput): Promise<GenerationOutput>;
}

export interface InterpretationValidation {
  interpretation: PerceivedInterpretation;
  rejected: Array<{ candidateId: string; reason: string }>;
}

/** What a `perceive` round-trip returns: the interpretation and the gate's verdict. */
export interface PerceivedAdmission {
  interpretation: PerceivedInterpretation;
  admitted: TaskAdmittedEvent['payload'][];
  rejected: Array<{ candidateId: string; reason: string }>;
}

/** The `TaskBagKind` a candidate's task type maps to for the firewall's kind check. */
const firewallKindOf = (taskType: FormalizationCandidate['taskType']) =>
  taskType === 'command' ? ('goal' as const) : taskType;

/**
 * The one validation gate before admission: term well-formedness, truth-value
 * ranges and syntactic validity (the firewall's own checks). Invalid candidates
 * are dropped with a reason rather than admitted — the kernel only ever sees a
 * candidate that parsed under the same rules it re-parses with.
 */
export const validateInterpretation = (
  interpretation: PerceivedInterpretation,
  firewall: SymbolicFirewall = defaultFirewall
): InterpretationValidation => {
  const accepted: FormalizationCandidate[] = [];
  const rejected: Array<{ candidateId: string; reason: string }> = [];
  for (const candidate of interpretation.candidates) {
    const verdict = firewall.check(candidate.narsese, firewallKindOf(candidate.taskType));
    if (!verdict.allowed) {
      rejected.push({ candidateId: candidate.candidateId, reason: verdict.reason ?? 'rejected' });
      continue;
    }
    if (candidate.truth) {
      const truth = firewall.checkTruth(candidate.truth.frequency, candidate.truth.confidence);
      if (!truth.allowed) {
        rejected.push({
          candidateId: candidate.candidateId,
          reason: truth.reason ?? 'truth outside [0,1]',
        });
        continue;
      }
    }
    accepted.push(candidate);
  }
  return { interpretation: { ...interpretation, candidates: accepted }, rejected };
};

const EMPTY_INTERPRETATION = (
  text: string,
  createdBy: PerceivedOrigin,
  provider: string
): PerceivedInterpretation => ({
  batchId: makeId(),
  sourceText: text,
  candidates: [],
  detectedIntent: 'learning',
  globalAmbiguities: [],
  createdBy,
  provider,
});

/**
 * The deterministic (null) provider. No LM: an utterance is Narsese or it is
 * nothing, and nothing is invented. `formalToNl` runs the same generation
 * fallback the hosted provider falls back to, so the no-key narrative is the
 * one both providers agree on (D10).
 */
export class StructuredFormalizer implements Formalizer {
  readonly provider = 'structured';
  private readonly firewall: SymbolicFirewall;
  private readonly generation: NLGenerationService;

  constructor(firewall: SymbolicFirewall = defaultFirewall) {
    this.firewall = firewall;
    this.generation = new NLGenerationService(null);
  }

  async nlToFormal(text: string): Promise<PerceivedInterpretation> {
    const base = EMPTY_INTERPRETATION(text, 'user', this.provider);
    const result = this.structuredCandidate(text);
    return 'candidate' in result
      ? { ...base, candidates: [result.candidate] }
      : { ...base, rejection: result.reason };
  }

  formalToNl(input: GenerationInput): Promise<GenerationOutput> {
    return this.generation.generate(input);
  }

  /**
   * A structured candidate is a task the grammar already parses. Two ingresses
   * needed "is this Narsese?" and neither could reach the other, so the answer
   * is `parseTaskTolerant` — the same reader the perception gate uses — rather
   * than a second guess. A refusal names which gate refused it (D15).
   */
  private structuredCandidate(
    text: string
  ): { candidate: FormalizationCandidate } | { reason: string } {
    const trimmed = text.trim();
    const parsed = parseTaskTolerant(trimmed);
    if (!parsed)
      return { reason: 'not Narsese (no LM configured to formalize natural language)' };
    const verdict = this.firewall.check(
      `${trimmed}${parsed.punctuation}`,
      firewallKindOf(parsed.taskType)
    );
    if (!verdict.allowed) return { reason: `firewall: ${verdict.reason ?? 'rejected'}` };
    return {
      candidate: {
        candidateId: makeId(),
        narsese: normalizeNarsese(parsed.term.toString()),
        taskType: parsed.taskType,
        ...(parsed.truth ? { truth: asBeliefTruth(parsed.truth) } : {}),
        confidence: 1,
        sourceSpans: [locateSpan(text, trimmed)],
        ambiguityFlags: detectAmbiguityFlags(trimmed),
      },
    };
  }
}

/**
 * The hosted provider: the existing safe NL→batch pipeline behind the one
 * contract. `createdBy` is `llm-proposed` — every candidate is a proposal the
 * perception gate must admit (D17).
 */
export class LmFormalizer implements Formalizer {
  readonly provider: string;
  private readonly understanding: NLUnderstandingService;
  private readonly generation: NLGenerationService;

  constructor(lm: ILMService) {
    this.provider = lm.provider ?? 'lm';
    this.understanding = new NLUnderstandingService(lm, undefined, { structuredOnly: true });
    this.generation = new NLGenerationService(lm);
  }

  async nlToFormal(text: string, ctx?: NLContext): Promise<PerceivedInterpretation> {
    const batch = await this.understanding.understandCandidates(text, ctx);
    if (!batch)
      return {
        ...EMPTY_INTERPRETATION(text, 'llm-proposed', this.provider),
        rejection: 'LM produced no formalization',
      };
    const interpretation: PerceivedInterpretation = {
      ...batch,
      createdBy: 'llm-proposed',
      provider: this.provider,
    };
    return batch.candidates.length === 0
      ? { ...interpretation, rejection: 'LM produced no admissible candidates' }
      : interpretation;
  }

  formalToNl(input: GenerationInput): Promise<GenerationOutput> {
    return this.generation.generate(input);
  }
}

/**
 * The formalizer for a runtime: the hosted provider when an LM is configured,
 * the deterministic provider otherwise. This is the D10 boundary — an absent LM
 * is a valid configuration, not a degraded one.
 */
export const createFormalizer = (lm: ILMService | null | undefined): Formalizer =>
  lm ? new LmFormalizer(lm) : new StructuredFormalizer();
