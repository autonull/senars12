/**
 * Classical extended NAL rules: modus ponens, modus tollens, disjunctive syllogism, conversion.
 */
import type { Term } from '../../terms';
import {
  binaryOf,
  isDisjunction,
  isNegation,
  TermBuilder,
  termsEqual,
} from '../../terms';
import { buildInhRule } from '../impls/rule-builder.js';
import type { RuleFn } from '../types.js';

/** `A==>B, A ⊢ B` */
export const modusPonens: RuleFn = ([imp, antecedent]) => {
  const pair = binaryOf('implication', imp);
  return pair && antecedent.kind === 'atom' && termsEqual(pair[0], antecedent) ? pair[1] : undefined;
};

/** `A==>B, --B ⊢ --A` */
export const modusTollens: RuleFn = ([imp, negConsequent]) => {
  const pair = binaryOf('implication', imp);
  if (!pair || !isNegation(negConsequent)) return undefined;
  const consequent = negConsequent.args[0];
  return consequent && termsEqual(pair[1], consequent) ? TermBuilder.negation(pair[0]) : undefined;
};

/** `A|B, --A ⊢ B` */
export const disjunctiveSyllogism: RuleFn = ([disj, negTerm]) => {
  const sides = isDisjunction(disj) ? disj.args : undefined;
  if (!isNegation(negTerm) || sides?.length !== 2) return undefined;
  const negated = negTerm.args[0];
  const [left, right] = sides as [Term, Term];
  return negated === undefined
    ? undefined
    : termsEqual(left, negated)
      ? right
      : termsEqual(right, negated)
        ? left
        : undefined;
};

/** `S-->P ⊢ P-->S` — the only rule that inverts an inheritance's own arguments. */
export const conversion: RuleFn = buildInhRule(([subject, predicate]) =>
  TermBuilder.inheritance(predicate, subject)
);
