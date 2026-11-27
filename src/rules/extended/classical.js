import { binaryOf, isDisjunction, isNegation, TermBuilder, termsEqual } from '../../terms';
import { implicationElim } from '../nal/propositional';
import { buildInhRule } from '../impls/rule-builder';
/**
 * `A==>B, A ⊢ B` — NAL's `implicationElim`, under the name classical logic
 * knows it by. One body, two rule ids, the way `comparison-ext.ts` already
 * re-exports the NAL `analogy`.
 */
export const modusPonens = implicationElim;
/** `A==>B, --B ⊢ --A` */
export const modusTollens = ([imp, negConsequent]) => {
    const pair = binaryOf('implication', imp);
    if (!pair || !isNegation(negConsequent))
        return undefined;
    const consequent = negConsequent.args[0];
    return consequent && termsEqual(pair[1], consequent) ? TermBuilder.negation(pair[0]) : undefined;
};
/** `A|B, --A ⊢ B` */
export const disjunctiveSyllogism = ([disj, negTerm]) => {
    const sides = isDisjunction(disj) ? disj.args : undefined;
    if (!isNegation(negTerm) || sides?.length !== 2)
        return undefined;
    const negated = negTerm.args[0];
    const [left, right] = sides;
    return negated === undefined
        ? undefined
        : termsEqual(left, negated)
            ? right
            : termsEqual(right, negated)
                ? left
                : undefined;
};
/** `S-->P ⊢ P-->S` — the only rule that inverts an inheritance's own arguments. */
export const conversion = buildInhRule(([subject, predicate]) => TermBuilder.inheritance(predicate, subject));
