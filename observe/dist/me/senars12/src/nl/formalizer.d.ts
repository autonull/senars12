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
import type { FormalizationBatch, TaskAdmittedEvent } from '@senars/schemas';
import type { ILMService } from '../lm/interfaces';
import { SymbolicFirewall } from './firewall';
import { type GenerationInput, type GenerationOutput } from './generation';
import { type NLContext } from './understanding';
/** Where an interpretation came from — the D17 tag a proposal carries. */
export declare const PERCEIVED_ORIGINS: readonly ['user', 'llm-proposed'];
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
    rejected: Array<{
        candidateId: string;
        reason: string;
    }>;
}
/** What a `perceive` round-trip returns: the interpretation and the gate's verdict. */
export interface PerceivedAdmission {
    interpretation: PerceivedInterpretation;
    admitted: TaskAdmittedEvent['payload'][];
    rejected: Array<{
        candidateId: string;
        reason: string;
    }>;
}
/**
 * The one validation gate before admission: term well-formedness, truth-value
 * ranges and syntactic validity (the firewall's own checks). Invalid candidates
 * are dropped with a reason rather than admitted — the kernel only ever sees a
 * candidate that parsed under the same rules it re-parses with.
 */
export declare const validateInterpretation: (interpretation: PerceivedInterpretation, firewall?: SymbolicFirewall) => InterpretationValidation;
/**
 * The deterministic (null) provider. No LM: an utterance is Narsese or it is
 * nothing, and nothing is invented. `formalToNl` runs the same generation
 * fallback the hosted provider falls back to, so the no-key narrative is the
 * one both providers agree on (D10).
 */
export declare class StructuredFormalizer implements Formalizer {
    readonly provider = "structured";
    private readonly firewall;
    private readonly generation;
    constructor(firewall?: SymbolicFirewall);
    nlToFormal(text: string): Promise<PerceivedInterpretation>;
    formalToNl(input: GenerationInput): Promise<GenerationOutput>;
    /**
     * A structured candidate is a task the grammar already parses. Two ingresses
     * needed "is this Narsese?" and neither could reach the other, so the answer
     * is `parseTaskTolerant` — the same reader the perception gate uses — rather
     * than a second guess. A refusal names which gate refused it (D15).
     */
    private structuredCandidate;
}
/**
 * The hosted provider: the existing safe NL→batch pipeline behind the one
 * contract. `createdBy` is `llm-proposed` — every candidate is a proposal the
 * perception gate must admit (D17).
 */
export declare class LmFormalizer implements Formalizer {
    readonly provider: string;
    private readonly understanding;
    private readonly generation;
    constructor(lm: ILMService);
    nlToFormal(text: string, ctx?: NLContext): Promise<PerceivedInterpretation>;
    formalToNl(input: GenerationInput): Promise<GenerationOutput>;
}
/**
 * The formalizer for a runtime: the hosted provider when an LM is configured,
 * the deterministic provider otherwise. This is the D10 boundary — an absent LM
 * is a valid configuration, not a degraded one.
 */
export declare const createFormalizer: (lm: ILMService | null | undefined) => Formalizer;
//# sourceMappingURL=formalizer.d.ts.map