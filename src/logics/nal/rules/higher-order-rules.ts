import { Term, TermOp, termInterner } from '../../../kernel/terms/intern';
import { getArgs } from '../../../kernel/terms/term-internal/compound';
import type { Premise } from '../../../kernel/step';
import { SenarsError } from '../../../errors/senars-error';
import type { NALRule } from './types';

function withArity<const N extends 1 | 2, R>(
  arity: N,
  fn: (premises: N extends 1 ? [Premise] : [Premise, Premise]) => R
): (premises: Premise[]) => R {
  return (premises: Premise[]) => {
    if (premises.length < arity) {
      throw new SenarsError(`Expected at least ${arity} premises, got ${premises.length}`, 'VALIDATION_ERROR', { expected: arity, got: premises.length });
    }
    return fn(premises as N extends 1 ? [Premise] : [Premise, Premise]);
  };
}

function isImplication(term: Term): boolean {
  return term.op === TermOp.IMPLICATION;
}

function isInheritance(term: Term): boolean {
  return term.op === TermOp.INHERITANCE;
}

function getAntecedent(term: Term): Term {
  const args = getArgs(term);
  if (!args || args.length < 1) throw new SenarsError('Expected compound term with at least 1 arg', 'VALIDATION_ERROR', { term: term.toString(), argCount: args?.length ?? 0 });
  return args[0]!;
}

function getConsequent(term: Term): Term {
  const args = getArgs(term);
  if (!args || args.length < 2) throw new SenarsError('Expected compound term with at least 2 args', 'VALIDATION_ERROR', { term: term.toString(), argCount: args?.length ?? 0 });
  return args[1]!;
}

function termsEqual(a: Term, b: Term): boolean {
  return a === b;
}

/** Higher-order rules (NAL-8). */
export const HIGHER_ORDER_RULES: NALRule[] = [
  // Higher-order deduction: (S1-->P1) ==> (S2-->P2), S1-->P1 => S2-->P2
  {
    id: 'higher_order_deduction',
    name: 'Higher-Order Deduction',
    category: 'deduction',
    arity: 2,
    premiseRoles: ['rule', 'fact'],
    truthOp: 'deduction',
    priority: 40,
    condition: withArity(2, ([rule, fact]) =>
      isImplication(rule.term) &&
      isInheritance(fact.term) &&
      termsEqual(getAntecedent(rule.term), fact.term)
    ),
    buildConclusion: withArity(2, ([rule]) => getConsequent(rule.term)),
  },
];