import type { Term } from './types.ts';
/**
 * One NAL rewrite, declared and enumerable (TODO29.a §5.12).
 *
 * Two obligations make a reducer a reducer rather than a `case` in the factory:
 * `applies` is false for every canonical term, so canonicalising one costs a
 * single pass and allocates nothing; and reducers commute, which the fixed point
 * below is what tests. A reducer that cannot see its own effect from a canonical
 * term does not terminate.
 *
 * **Admissibility (TODO30 §2.4):** a reducer may fire only when the two terms are
 * the **same claim** — same readback (serialised form), same injectivity class
 * (`termKey`), and for Boolean laws, an exact structural identity rather than a
 * truth-function coincidence. A reducer that fires "usually" is a heuristic in a
 * place the architecture promised it would not be one.
 */
export interface TermReducer {
    readonly id: string;
    /** Human-readable justification citing the NAL identity or reference rule. */
    readonly justification: string;
    applies(term: Term): boolean;
    reduce(term: Term): Term;
}
export declare const TERM_REDUCERS: readonly TermReducer[];
export declare const canonicalTerm: (term: Term) => Term;
//# sourceMappingURL=reduce.d.ts.map