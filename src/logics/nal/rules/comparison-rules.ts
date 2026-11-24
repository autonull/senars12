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

function termsEqual(a: Term, b: Term): boolean {
  return a === b;
}

function createInheritance(subject: Term, predicate: Term): Term {
  return termInterner.inheritance(subject, predicate);
}

function createSimilarity(subject: Term, predicate: Term): Term {
  return termInterner.similarity(subject, predicate);
}

function createProduct(...terms: Term[]): Term {
  return termInterner.product(...terms);
}

/** Comparison and analogy rules (NAL-5). */
export const COMPARISON_RULES: NALRule[] = [
  // Comparison: S1-->P1, S2-->P2 => (S1*S2)-->(P1*P2)
  {
    id: 'comparison',
    name: 'Comparison',
    category: 'comparison',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'analogy',
    priority: 70,
    condition: withArity(2, ([m, n]) =>
      isInheritance(m.term) && isInheritance(n.term)
    ),
    buildConclusion: withArity(2, ([m, n]) =>
      createInheritance(
        createProduct(getSubject(m.term), getSubject(n.term)),
        createProduct(getPredicate(m.term), getPredicate(n.term))
      )
    ),
  },

  // Analogy: S1-->P1, S2-->P2 => (S1*S2)<->(P1*P2)
  {
    id: 'analogy',
    name: 'Analogy',
    category: 'analogy',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'analogy',
    priority: 65,
    condition: withArity(2, ([m, n]) =>
      isInheritance(m.term) && isInheritance(n.term)
    ),
    buildConclusion: withArity(2, ([m, n]) =>
      createSimilarity(
        createProduct(getSubject(m.term), getSubject(n.term)),
        createProduct(getPredicate(m.term), getPredicate(n.term))
      )
    ),
  },

  // Resemblance: S1-->P, S2-->P => S1<->S2
  {
    id: 'resemblance',
    name: 'Resemblance',
    category: 'resemblance',
    arity: 2,
    premiseRoles: ['major', 'minor'],
    truthOp: 'resemblance',
    priority: 75,
    condition: withArity(2, ([m, n]) =>
      isInheritance(m.term) && isInheritance(n.term) &&
      termsEqual(getPredicate(m.term), getPredicate(n.term))
    ),
    buildConclusion: withArity(2, ([m, n]) =>
      createSimilarity(getSubject(m.term), getSubject(n.term))
    ),
  },
];