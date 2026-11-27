/**
 * Structural extended NAL rules: structural inheritance, structural reduction.
 */
import { binaryOf, TermBuilder, termsEqual } from '../../terms';
export const structuralInheritance = ([compound, component]) => compound.kind === 'conjunction' && compound.args.some((a) => termsEqual(a, component))
    ? TermBuilder.inheritance(component, compound)
    : undefined;
/** `(S --> (A & B)) ⊢ (S --> A)` — dropping the conjuncts. */
export const structuralReduction = ([inh]) => {
    const pair = binaryOf('inheritance', inh);
    if (!pair)
        return undefined;
    const [subject, predicate] = pair;
    if (predicate.kind !== 'conjunction')
        return undefined;
    return TermBuilder.inheritance(subject, predicate.args[0] ?? predicate);
};
