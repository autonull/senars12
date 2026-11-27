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
import { asBeliefTruth } from '@senars/types/truth';
import { makeId } from '@senars/util/id';
import { parseTaskTolerant } from '../terms';
import { defaultFirewall } from './firewall';
import { NLGenerationService, } from './generation';
import { normalizeNarsese } from './normalize';
import { detectAmbiguityFlags, locateSpan, NLUnderstandingService, } from './understanding';
/** Where an interpretation came from — the D17 tag a proposal carries. */
export const PERCEIVED_ORIGINS = ['user', 'llm-proposed'];
/** The `TaskBagKind` a candidate's task type maps to for the firewall's kind check. */
const firewallKindOf = (taskType) => taskType === 'command' ? 'goal' : taskType;
/**
 * The one validation gate before admission: term well-formedness, truth-value
 * ranges and syntactic validity (the firewall's own checks). Invalid candidates
 * are dropped with a reason rather than admitted — the kernel only ever sees a
 * candidate that parsed under the same rules it re-parses with.
 */
export const validateInterpretation = (interpretation, firewall = defaultFirewall) => {
    const accepted = [];
    const rejected = [];
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
const EMPTY_INTERPRETATION = (text, createdBy, provider) => ({
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
export class StructuredFormalizer {
    provider = 'structured';
    firewall;
    generation;
    constructor(firewall = defaultFirewall) {
        this.firewall = firewall;
        this.generation = new NLGenerationService(null);
    }
    async nlToFormal(text) {
        const base = EMPTY_INTERPRETATION(text, 'user', this.provider);
        const result = this.structuredCandidate(text);
        return 'candidate' in result
            ? { ...base, candidates: [result.candidate] }
            : { ...base, rejection: result.reason };
    }
    formalToNl(input) {
        return this.generation.generate(input);
    }
    /**
     * A structured candidate is a task the grammar already parses. Two ingresses
     * needed "is this Narsese?" and neither could reach the other, so the answer
     * is `parseTaskTolerant` — the same reader the perception gate uses — rather
     * than a second guess. A refusal names which gate refused it (D15).
     */
    structuredCandidate(text) {
        const trimmed = text.trim();
        const parsed = parseTaskTolerant(trimmed);
        if (!parsed)
            return { reason: 'not Narsese (no LM configured to formalize natural language)' };
        // The firewall reads the surface utterance with its sentence mark, and the
        // utterance may already carry that mark (`term;`). Appending again yields
        // `term;;`, which no grammar accepts — this is how an explicitly-marked
        // `command` came to be unreachable through the deterministic path.
        const marked = trimmed.endsWith(parsed.punctuation)
            ? trimmed
            : `${trimmed}${parsed.punctuation}`;
        const verdict = this.firewall.check(marked, firewallKindOf(parsed.taskType));
        if (!verdict.allowed)
            return { reason: `firewall: ${verdict.reason ?? 'rejected'}` };
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
export class LmFormalizer {
    provider;
    understanding;
    generation;
    constructor(lm) {
        this.provider = lm.provider ?? 'lm';
        this.understanding = new NLUnderstandingService(lm, undefined, { structuredOnly: true });
        this.generation = new NLGenerationService(lm);
    }
    async nlToFormal(text, ctx) {
        const batch = await this.understanding.understandCandidates(text, ctx);
        if (!batch)
            return {
                ...EMPTY_INTERPRETATION(text, 'llm-proposed', this.provider),
                rejection: 'LM produced no formalization',
            };
        const interpretation = {
            ...batch,
            createdBy: 'llm-proposed',
            provider: this.provider,
        };
        return batch.candidates.length === 0
            ? { ...interpretation, rejection: 'LM produced no admissible candidates' }
            : interpretation;
    }
    formalToNl(input) {
        return this.generation.generate(input);
    }
}
/**
 * The formalizer for a runtime: the hosted provider when an LM is configured,
 * the deterministic provider otherwise. This is the D10 boundary — an absent LM
 * is a valid configuration, not a degraded one.
 */
export const createFormalizer = (lm) => lm ? new LmFormalizer(lm) : new StructuredFormalizer();
