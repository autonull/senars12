import { describe, expect, it } from 'vitest';
import { comparison, sameness } from '@senars/rules/extended/comparison-ext';
import { getVars } from '@senars/rules/impls/rule-builder';
import { TermBuilder, termsEqual } from '@senars/terms/index';
import type { Term } from '@senars/terms/types';

const atom = (s: string): Term => TermBuilder.atom(s);
const inh = (s: string, p: string): Term => TermBuilder.inheritance(atom(s), atom(p)) as Term;

describe('getVars', () => {
  it('finds a variable at the root', () => {
    expect(getVars(atom('?x')).map(String)).toEqual(['?x']);
  });

  it('finds variables nested at any depth, in pre-order', () => {
    const term = TermBuilder.conjunction(
      atom('?x'),
      TermBuilder.inheritance(atom('?y'), atom('a')) as Term
    );
    expect(getVars(term).map(String)).toEqual(['?x', '?y']);
  });

  it('reports none for a ground term, at the root and nested', () => {
    expect(getVars(atom('a'))).toEqual([]);
    expect(getVars(TermBuilder.negation(atom('b')))).toEqual([]);
  });

  it('does not treat a quoted atom as a variable', () => {
    expect(getVars(atom('"?x"'))).toEqual([]);
  });
});

/**
 * `comparison` and `sameness` are the same derivation. They were two identical
 * `buildBinaryInhRule` bodies, so the rule ids could drift apart while still
 * claiming to be the same rule; the derivation itself is what is pinned here.
 */
describe('extended same-inheritance similarity rule', () => {
  const pair: [Term, Term] = [inh('bird', 'animal'), inh('bird', 'animal')];

  it.each([
    ['comparison', comparison],
    ['sameness', sameness],
  ])('%s concludes S <-> P from two identical inheritances', (_name, rule) => {
    const concluded = rule(pair);
    expect(termsEqual(concluded, TermBuilder.similarity(atom('bird'), atom('animal')))).toBe(true);
  });

  it.each([
    ['comparison', comparison],
    ['sameness', sameness],
  ])('%s declines a pair whose predicates differ', (_name, rule) => {
    expect(rule([inh('bird', 'animal'), inh('bird', 'plant')])).toBeUndefined();
  });

  it.each([
    ['comparison', comparison],
    ['sameness', sameness],
  ])('%s declines a non-inheritance premise', (_name, rule) => {
    expect(rule([atom('a'), atom('b')])).toBeUndefined();
  });
});
