import { Term, termInterner } from '../../../kernel/terms/intern';
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

/** Meta-cognitive rules. */
export const META_RULES: NALRule[] = [
  // Introspection: derive knowledge about own derivations
  {
    id: 'introspection',
    name: 'Introspection',
    category: 'meta',
    arity: 1,
    premiseRoles: ['derivation'],
    truthOp: 'deduction',
    priority: 20,
    condition: withArity(1, ([p]) => p.stamp.derivation.length > 0),
    buildConclusion: withArity(1, ([p]) =>
      termInterner.constant(`derived_by_${p.stamp.derivation.join('_')}`)
    ),
  },
];