import { Term, TermOp, termInterner } from '../../../kernel/terms/intern';
import type { Premise } from '../../../kernel/step';
import type { NALRule } from './types';

function withArity<const N extends 1 | 2, R>(
  arity: N,
  fn: (premises: N extends 1 ? [Premise] : [Premise, Premise]) => R
): (premises: Premise[]) => R {
  return (premises: Premise[]) => {
    if (premises.length < arity) {
      throw new Error(`Expected at least ${arity} premises, got ${premises.length}`);
    }
    return fn(premises as N extends 1 ? [Premise] : [Premise, Premise]);
  };
}

function isVariable(term: Term): boolean {
  return term.op === TermOp.VARIABLE;
}

/** Variable rules (NAL-9). */
export const VARIABLE_RULES: NALRule[] = [
  // Variable introduction: A => $x (where $x unifies with A)
  {
    id: 'variable_introduction',
    name: 'Variable Introduction',
    category: 'meta',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'deduction',
    priority: 30,
    condition: withArity(1, ([p]) => !isVariable(p.term)),
    buildConclusion: withArity(1, () => termInterner.variable('$x')),
  },
];