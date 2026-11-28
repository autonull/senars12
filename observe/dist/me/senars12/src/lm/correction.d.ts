/**
 * Bidirectional correction: when a contradiction is traceable to a model
 * translation, reparse the source under the Narsese grammar.
 *
 * Lives in the layer rather than in `cognitive/impls/analyzers` because it is a
 * provider call with a layer-owned grammar, and because it has no production
 * caller: the only one is `scripts/fundamentals-bench.ts`. The cycle path naming
 * it was the last value import of `lm/` from core (TODO29.a §5.2), and it was
 * carrying the edge for a bench script alone.
 */
import type { Term } from '../terms/index';
/** The narrowest seam: a call that may return nothing. */
type TextProposer = {
    tryGenerateText(prompt: string, opts?: unknown): Promise<string | null>;
};
/** Returns null on model failure (escalation exhausted) — caller keeps the symbolic side. */
export declare const attemptLMCorrection: (lm: Pick<TextProposer, 'tryGenerateText'> | null, sourceText: string, wrongNarsese: string, contradictingNarsese: string) => Promise<Term | null>;
export {};
//# sourceMappingURL=correction.d.ts.map