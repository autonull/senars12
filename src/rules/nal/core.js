import { TermBuilder, termsEqual } from '../../terms';
import { buildBinaryInhRule } from '../impls/rule-builder';
/** `S1--P1, P1--P2 ⊢ S1--P2` — the first predicate chains into the second subject. */
export const deduction = buildBinaryInhRule(([s1, p1], [s2, p2]) => termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined);
/** `S--P, S--P ⊢ S<->P` — the shared pair, in either argument order. */
export const similarity = buildBinaryInhRule(([s1, p1], [s2, p2]) => (termsEqual(s1, s2) && termsEqual(p1, p2)) || (termsEqual(s1, p2) && termsEqual(p1, s2))
    ? TermBuilder.similarity(s1, p1)
    : undefined);
/** `S1--P1, S2--P1 ⊢ S1--P2` — a shared subject generalises the predicate. */
export const induction = buildBinaryInhRule(([s1, p1], [s2, p2]) => termsEqual(s1, s2) ? TermBuilder.inheritance(p1, p2) : undefined);
/** `S1--P1, S2--P1 ⊢ S1--S2` — a shared predicate links the two subjects. */
export const abduction = buildBinaryInhRule(([s1, p1], [s2, p2]) => termsEqual(p1, p2) ? TermBuilder.inheritance(s1, s2) : undefined);
