/**
 * Structural extended NAL rules: structural inheritance, structural reduction.
 */
import type { Term } from '../../terms';
import { TermBuilder, getPredicate, getSubject, termsEqual } from '../../terms';
import type { RuleFn } from '../types.js';

export const structuralInheritance: RuleFn = ([compound, component]: [Term, Term]):
  | Term
  | undefined => {
  if (compound.kind !== 'conjunction') return undefined;
  const found = compound.args.find((a) => termsEqual(a, component));
  return found ? TermBuilder.inheritance(component, compound) : undefined;
};

export const structuralReduction: RuleFn = ([inh]: [Term, Term]): Term | undefined => {
  if (inh.kind !== 'inheritance') return undefined;
  const pred = getPredicate(inh);
  if (!pred || pred.kind !== 'conjunction') return undefined;
  const sub = getSubject(inh);
  return sub ? TermBuilder.inheritance(sub, pred.args[0] ?? pred) : undefined;
};
