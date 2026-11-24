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

function isInheritance(term: Term): boolean {
  return term.op === TermOp.INHERITANCE;
}

function isSimilarity(term: Term): boolean {
  return term.op === TermOp.SIMILARITY;
}

function getSubject(term: Term): Term {
  const args = getArgs(term);
  if (!args || args.length < 1) throw new SenarsError('Expected compound term with at least 1 arg', 'VALIDATION_ERROR', { term: term.toString(), argCount: args?.length ?? 0 });
  return args[0]!;
}

function getPredicate(term: Term): Term {
  const args = getArgs(term);
  if (!args || args.length < 2) throw new SenarsError('Expected compound term with at least 2 args', 'VALIDATION_ERROR', { term: term.toString(), argCount: args?.length ?? 0 });
  return args[1]!;
}

function createInheritance(subject: Term, predicate: Term): Term {
  return termInterner.inheritance(subject, predicate);
}

function createSimilarity(subject: Term, predicate: Term): Term {
  return termInterner.similarity(subject, predicate);
}

function createNegation(term: Term): Term {
  return termInterner.negation(term);
}

/** Structural rules (NAL-6). */
export const STRUCTURAL_RULES: NALRule[] = [
  // Negation: ~A
  {
    id: 'negation',
    name: 'Negation',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'negation',
    priority: 50,
    condition: withArity(1, () => true),
    buildConclusion: withArity(1, ([p]) => createNegation(p.term)),
  },

  // Conversion (inheritance): S-->P => P-->S
  {
    id: 'conversion_inheritance',
    name: 'Conversion (Inheritance)',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'conversion',
    priority: 55,
    condition: withArity(1, ([p]) => isInheritance(p.term)),
    buildConclusion: withArity(1, ([p]) =>
      createInheritance(getPredicate(p.term), getSubject(p.term))
    ),
  },

  // Conversion (similarity): S<->P => P<->S
  {
    id: 'conversion_similarity',
    name: 'Conversion (Similarity)',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'conversion',
    priority: 55,
    condition: withArity(1, ([p]) => isSimilarity(p.term)),
    buildConclusion: withArity(1, ([p]) =>
      createSimilarity(getPredicate(p.term), getSubject(p.term))
    ),
  },

  // Structural deduction: A ==> B => A ==> B (weaken)
  {
    id: 'structural_deduction',
    name: 'Structural Deduction',
    category: 'structural',
    arity: 1,
    premiseRoles: ['premise'],
    truthOp: 'structuralDeduction',
    priority: 45,
    condition: withArity(1, ([p]) => p.term.op === TermOp.IMPLICATION),
    buildConclusion: withArity(1, ([p]) => p.term),
  },
];