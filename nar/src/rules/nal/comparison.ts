/**
 * Comparison NAL rules present in the core NAL rule set: analogy, comparison,
 * instantiation, exemplification.
 */
import type { Term } from '../../terms';
import { TermBuilder, termsEqual } from '../../terms';
import type { RuleFn } from '../types.js';
import { matchInhPair, extractInh, sameInhPair } from '../extractors.js';
import { buildBinaryInhRule } from '../rule-builder.js';

export const analogy: RuleFn = ([inh, sim]: [Term, Term]) => {
  if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
  return matchInhPair((s1, p1, s2, p2) =>
    termsEqual(p1, s2) ? TermBuilder.inheritance(s1, p2) : undefined
  )([inh, sim]);
};

export const comparison: RuleFn = matchInhPair((s1, p1, s2, p2) =>
  termsEqual(s1, s2) ? TermBuilder.similarity(p1, p2) : undefined
) as RuleFn;

export const instantiation: RuleFn = ([inh, sim]: [Term, Term]) => {
  if (inh.kind !== 'inheritance' || sim.kind !== 'similarity') return undefined;
  return matchInhPair((s1, p1, s2, p2) =>
    termsEqual(p1, p2) ? TermBuilder.inheritance(s1, s2) : undefined
  )([inh, sim]);
};

export const exemplification: RuleFn = matchInhPair((s1, p1, s2, p2) =>
  termsEqual(p1, p2) ? TermBuilder.inheritance(s1, s2) : undefined
) as RuleFn;
